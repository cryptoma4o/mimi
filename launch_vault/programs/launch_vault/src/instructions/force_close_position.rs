use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::cpi::pump_fun;
use crate::cpi::token_utils::TOKEN_2022_PROGRAM_ID;
use crate::errors::LaunchVaultError;
use crate::events::PositionForceClosedEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct ForceClosePosition<'info> {
    #[account(
        constraint = executor.key() == protocol_config.executor @ LaunchVaultError::UnauthorizedExecutor,
    )]
    pub executor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.user.as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.status == VaultStatus::Active @ LaunchVaultError::InvalidVaultStatus,
    )]
    pub vault_state: Account<'info, LaunchVaultState>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    /// CHECK: Vault token account (ATA derived with Token2022)
    #[account(
        mut,
        // Token2022 for ATA derivation — Pump.fun v2 tokens are Token2022,
        // but Pump.fun sell CPI expects old SPL Token program in token_program position.
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &vault_state.key(),
            &vault_state.token_mint,
            &TOKEN_2022_PROGRAM_ID,
        ) @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Token mint
    #[account(
        constraint = token_mint.key() == vault_state.token_mint @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub token_mint: UncheckedAccount<'info>,

    // === Pump.fun accounts for sell ===
    /// CHECK: Pump.fun program
    #[account(constraint = pump_program.key() == pump_fun::PUMP_FUN_PROGRAM_ID)]
    pub pump_program: UncheckedAccount<'info>,

    /// CHECK: Pump global state
    #[account(mut)]
    pub pump_global: UncheckedAccount<'info>,

    /// CHECK: Pump fee recipient
    #[account(mut)]
    pub pump_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: Bonding curve PDA
    #[account(mut)]
    pub pump_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Associated bonding curve token account
    #[account(mut)]
    pub pump_associated_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Event authority PDA
    pub pump_event_authority: UncheckedAccount<'info>,

    /// CHECK: Creator vault PDA
    #[account(mut)]
    pub pump_creator_vault: UncheckedAccount<'info>,

    /// CHECK: Fee config
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: Bonding curve v2
    pub pump_bonding_curve_v2: UncheckedAccount<'info>,

    /// CHECK: Fee program
    #[account(constraint = pump_fee_program.key() == pump_fun::FEE_PROGRAM_ID)]
    pub pump_fee_program: UncheckedAccount<'info>,

    // === System ===
    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<ForceClosePosition>) -> Result<()> {
    let vault = &ctx.accounts.vault_state;
    let tokens_to_sell = vault.remaining_token_amount;
    let lp_at_risk = vault.remaining_lp_allocation;

    let user_key = vault.user;
    let mint_key = vault.token_mint;
    let bump = vault.bump;
    let vault_pda = ctx.accounts.vault_state.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];

    // Record vault lamports before sell to calculate SOL received
    let vault_lamports_before = ctx.accounts.vault_state.to_account_info().lamports();

    // Sell all remaining tokens via CPI (min_sol_output = 0 for force close)
    if tokens_to_sell > 0 {
        let sell_ix = pump_fun::build_sell_instruction(
            &ctx.accounts.pump_global.key(),
            &ctx.accounts.pump_fee_recipient.key(),
            &mint_key,
            &ctx.accounts.pump_bonding_curve.key(),
            &ctx.accounts.pump_associated_bonding_curve.key(),
            &ctx.accounts.vault_token_account.key(),
            &vault_pda,
            &ctx.accounts.system_program.key(),
            &ctx.accounts.pump_creator_vault.key(),
            &ctx.accounts.token_program.key(),
            &ctx.accounts.pump_event_authority.key(),
            &ctx.accounts.pump_fee_config.key(),
            &ctx.accounts.pump_bonding_curve_v2.key(),
            tokens_to_sell,
            0, // min_sol_output = 0 (force close accepts any price)
        );

        invoke_signed(
            &sell_ix,
            &[
                ctx.accounts.pump_global.to_account_info(),
                ctx.accounts.pump_fee_recipient.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.pump_bonding_curve.to_account_info(),
                ctx.accounts.pump_associated_bonding_curve.to_account_info(),
                ctx.accounts.vault_token_account.to_account_info(),
                ctx.accounts.vault_state.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.pump_creator_vault.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pump_event_authority.to_account_info(),
                ctx.accounts.pump_program.to_account_info(),
                ctx.accounts.pump_fee_config.to_account_info(),
                ctx.accounts.pump_fee_program.to_account_info(),
                ctx.accounts.pump_bonding_curve_v2.to_account_info(),
            ],
            &[vault_seeds],
        )?;
    }

    // Calculate SOL recovered
    let vault_lamports_after = ctx.accounts.vault_state.to_account_info().lamports();
    let sol_recovered = vault_lamports_after.saturating_sub(vault_lamports_before);

    // Transfer recovered SOL to LP pool
    let rent = Rent::get()?;
    let vault_min_rent = rent.minimum_balance(8 + LaunchVaultState::INIT_SPACE);
    let transferable = vault_lamports_after.saturating_sub(vault_min_rent);
    let sol_to_pool = transferable.min(sol_recovered);

    if sol_to_pool > 0 {
        **ctx.accounts.vault_state.to_account_info().try_borrow_mut_lamports()? -= sol_to_pool;
        **ctx.accounts.lp_pool.to_account_info().try_borrow_mut_lamports()? += sol_to_pool;
    }

    // Calculate LP loss
    let lp_loss = lp_at_risk.saturating_sub(sol_to_pool);

    // Update vault state
    let vault = &mut ctx.accounts.vault_state;
    vault.remaining_token_amount = 0;
    vault.remaining_lp_allocation = 0;
    vault.status = VaultStatus::Closed;

    // Update LP pool
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(lp_at_risk)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    if lp_loss > 0 {
        lp_pool.total_liquidity = lp_pool
            .total_liquidity
            .checked_sub(lp_loss)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        lp_pool.total_defaults = lp_pool.total_defaults.saturating_add(1);
    }
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.total_positions_closed = lp_pool.total_positions_closed.saturating_add(1);

    let clock = Clock::get()?;
    emit!(PositionForceClosedEvent {
        vault: ctx.accounts.vault_state.key(),
        executor: ctx.accounts.executor.key(),
        token_mint: mint_key,
        tokens_sold: tokens_to_sell,
        sol_recovered: sol_to_pool,
        lp_loss,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
