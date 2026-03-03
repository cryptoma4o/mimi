use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;

use crate::cpi::token_utils::build_create_ata_instruction;
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::VaultCreatedEvent;

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Token mint (Token2022) — passed through for ATA creation
    pub token_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + LaunchVaultState::INIT_SPACE,
        seeds = [b"vault", user.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, LaunchVaultState>,

    /// CHECK: Vault token account — created via CPI in handler
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = protocol_config.status == ProtocolStatus::Active @ LaunchVaultError::ProtocolPaused,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    /// CHECK: Treasury verified via protocol_config
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ LaunchVaultError::InvalidTreasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<CreateVault>,
    lp_allocation: u64,
    user_contribution: u64,
) -> Result<()> {
    require!(lp_allocation > 0, LaunchVaultError::ZeroLpAllocation);
    require!(user_contribution > 0, LaunchVaultError::ZeroUserContribution);
    require!(
        lp_allocation <= ctx.accounts.lp_pool.available_liquidity,
        LaunchVaultError::InsufficientLpLiquidity
    );

    // Create vault ATA via CPI (Token2022 compatible)
    invoke(
        &build_create_ata_instruction(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault_state.key(),
            &ctx.accounts.token_mint.key(),
            &ctx.accounts.token_program.key(),
            &ctx.accounts.associated_token_program.key(),
        ),
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.associated_token_program.to_account_info(),
        ],
    )?;

    let config = &ctx.accounts.protocol_config;

    // Calculate total payment: infrastructure_fee + first rental_fee + user_contribution
    let fees_to_treasury = config
        .infrastructure_fee
        .checked_add(config.rental_fee_rate)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Transfer fees to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        fees_to_treasury,
    )?;

    // Transfer user_contribution to LP pool
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.lp_pool.to_account_info(),
            },
        ),
        user_contribution,
    )?;

    // Track user_contribution in total_liquidity (SOL just arrived in lp_pool)
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_add(user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Reserve full buy_budget (lp_allocation + user_contribution)
    let buy_budget = lp_allocation
        .checked_add(user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_add(buy_budget)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Initialize vault state
    let clock = Clock::get()?;
    let rental_due = clock
        .unix_timestamp
        .checked_add(config.rental_period)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let vault = &mut ctx.accounts.vault_state;
    vault.user = ctx.accounts.user.key();
    vault.token_mint = ctx.accounts.token_mint.key();
    vault.total_token_amount = 0;
    vault.remaining_token_amount = 0;
    vault.total_lp_allocation = lp_allocation;
    vault.remaining_lp_allocation = lp_allocation;
    vault.user_contribution = user_contribution;
    vault.status = VaultStatus::ReadyForExecution;
    vault.rental_start_timestamp = clock.unix_timestamp;
    vault.rental_due_timestamp = rental_due;
    vault.rental_status = RentalStatus::Active;
    vault.bump = ctx.bumps.vault_state;

    emit!(VaultCreatedEvent {
        user: ctx.accounts.user.key(),
        token_mint: ctx.accounts.token_mint.key(),
        vault: ctx.accounts.vault_state.key(),
        lp_allocation,
        user_contribution,
        rental_due_timestamp: rental_due,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
