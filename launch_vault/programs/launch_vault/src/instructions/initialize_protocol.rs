use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;

use crate::cpi::token_utils::build_initialize_mint2_instruction;
use crate::errors::LaunchVaultError;
use crate::events::ProtocolInitializedEvent;
use crate::state::*;

/// Token2022 program ID
const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = admin,
        space = 8 + LpPool::INIT_SPACE,
        seeds = [b"lp_pool"],
        bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    #[account(
        init,
        payer = admin,
        space = 8 + InsuranceFund::INIT_SPACE,
        seeds = [b"insurance_fund"],
        bump,
    )]
    pub insurance_fund: Account<'info, InsuranceFund>,

    /// CHECK: LP mint PDA — initialized manually via CPI to Token2022
    #[account(mut)]
    pub lp_mint: UncheckedAccount<'info>,

    /// CHECK: Token2022 program
    #[account(
        constraint = token_program.key() == TOKEN_2022_PROGRAM_ID
    )]
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    executor: Pubkey,
    treasury: Pubkey,
    fixed_fee: u64,
    fee_bps: u16,
    max_utilization_bps: u16,
    position_timeout: i64,
    close_reward_bps: u16,
    insurance_split_bps: u16,
    redemption_fee_bps: u16,
    min_user_contribution: u64,
    max_lp_per_position: u64,
    min_user_ratio_bps: u16,
) -> Result<()> {
    require!(fee_bps <= 10_000, LaunchVaultError::InvalidFeeBps);
    require!(
        max_utilization_bps > 0 && max_utilization_bps <= 10_000,
        LaunchVaultError::InvalidUtilizationBps
    );
    require!(
        position_timeout >= 300,
        LaunchVaultError::InvalidPositionTimeout
    );
    require!(close_reward_bps <= 10_000, LaunchVaultError::InvalidFeeBps);
    require!(
        insurance_split_bps <= 10_000,
        LaunchVaultError::InvalidFeeBps
    );
    require!(
        redemption_fee_bps <= 10_000,
        LaunchVaultError::InvalidRedemptionFeeBps
    );
    require!(min_user_ratio_bps <= 10_000, LaunchVaultError::InvalidFeeBps);
    require!(
        max_lp_per_position > 0,
        LaunchVaultError::InvalidCircuitBreakerParam
    );
    require!(
        min_user_contribution > 0,
        LaunchVaultError::UserContributionTooLow
    );

    // === Create LP mint PDA via Token2022 ===
    let program_id = ctx.program_id;
    let (lp_mint_pda, lp_mint_bump) = Pubkey::find_program_address(&[b"lp_mint"], program_id);
    require!(
        ctx.accounts.lp_mint.key() == lp_mint_pda,
        LaunchVaultError::InvalidVaultStatus // reuse for PDA mismatch
    );

    let lp_mint_seeds: &[&[u8]] = &[b"lp_mint", &[lp_mint_bump]];

    // Allocate mint account (82 bytes for SPL Token mint)
    let mint_space: u64 = 82;
    let mint_rent = ctx.accounts.rent.minimum_balance(mint_space as usize);

    invoke_signed(
        &system_instruction::create_account(
            &ctx.accounts.admin.key(),
            &lp_mint_pda,
            mint_rent,
            mint_space,
            &TOKEN_2022_PROGRAM_ID,
        ),
        &[
            ctx.accounts.admin.to_account_info(),
            ctx.accounts.lp_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[lp_mint_seeds],
    )?;

    // Initialize mint: 9 decimals (same as SOL), authority = lp_mint PDA itself
    let init_mint_ix = build_initialize_mint2_instruction(
        &TOKEN_2022_PROGRAM_ID,
        &lp_mint_pda,
        9,            // decimals (match SOL)
        &lp_mint_pda, // mint authority = PDA
        None,         // no freeze authority
    );

    invoke_signed(
        &init_mint_ix,
        &[ctx.accounts.lp_mint.to_account_info()],
        &[lp_mint_seeds],
    )?;

    // === Set protocol config ===
    let config = &mut ctx.accounts.protocol_config;
    config.admin = ctx.accounts.admin.key();
    config.executor = executor;
    config.treasury = treasury;
    config.fixed_fee = fixed_fee;
    config.fee_bps = fee_bps;
    config.max_utilization_bps = max_utilization_bps;
    config.position_timeout = position_timeout;
    config.close_reward_bps = close_reward_bps;
    config.insurance_split_bps = insurance_split_bps;
    config.redemption_fee_bps = redemption_fee_bps;
    config.min_user_contribution = min_user_contribution;
    config.max_lp_per_position = max_lp_per_position;
    config.min_user_ratio_bps = min_user_ratio_bps;
    config.status = ProtocolStatus::Active;
    config.cb_position_limit = 0;
    config.cb_window_seconds = 86400;
    config.cb_cooldown_seconds = 3600;
    config.cb_window_start = 0;
    config.cb_positions_in_window = 0;
    config.cb_last_trigger = 0;
    config.min_insurance_fund = 0;
    config.bump = ctx.bumps.protocol_config;

    // === Set LP pool ===
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = 0;
    lp_pool.reserved_liquidity = 0;
    lp_pool.available_liquidity = 0;
    lp_pool.lp_mint = lp_mint_pda;
    lp_pool.lp_mint_supply = 0;
    lp_pool.total_defaults = 0;
    lp_pool.total_positions_closed = 0;
    lp_pool.authority = ctx.accounts.admin.key();
    lp_pool.bump = ctx.bumps.lp_pool;

    // === Set insurance fund ===
    let insurance = &mut ctx.accounts.insurance_fund;
    insurance.total_sol = 0;
    insurance.authority = ctx.accounts.admin.key();
    insurance.bump = ctx.bumps.insurance_fund;

    let clock = Clock::get()?;
    emit!(ProtocolInitializedEvent {
        admin: ctx.accounts.admin.key(),
        executor,
        treasury,
        fixed_fee,
        fee_bps,
        max_utilization_bps,
        position_timeout,
        redemption_fee_bps,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
