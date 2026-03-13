use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;

use crate::cpi::pump_fun;
use crate::cpi::token_utils::{read_token_account_amount, TOKEN_2022_PROGRAM_ID};
use crate::errors::LaunchVaultError;
use crate::events::{PositionSoldEvent, StopLossTriggeredEvent};
use crate::state::*;

#[derive(Accounts)]
pub struct TriggerStopLoss<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault.user.as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
        constraint = vault.status == VaultStatus::Active @ LaunchVaultError::InvalidVaultStatus,
        constraint = vault.stop_loss_bps > 0 @ LaunchVaultError::StopLossNotConfigured,
        constraint = !vault.stop_loss_triggered @ LaunchVaultError::StopLossAlreadyTriggered,
    )]
    pub vault: Account<'info, LaunchVaultState>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = protocol_config.status == ProtocolStatus::Active @ LaunchVaultError::ProtocolPaused,
        constraint = signer.key() == protocol_config.executor @ LaunchVaultError::UnauthorizedExecutor,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    /// CHECK: Token mint
    #[account(
        constraint = token_mint.key() == vault.token_mint @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub token_mint: UncheckedAccount<'info>,

    /// CHECK: Pump.fun program ID
    #[account(constraint = pump_program.key() == pump_fun::PUMP_FUN_PROGRAM_ID)]
    pub pump_program: UncheckedAccount<'info>,

    /// CHECK: Pump global state PDA
    #[account(mut)]
    pub pump_global: UncheckedAccount<'info>,

    /// CHECK: Bonding curve PDA
    #[account(mut)]
    pub pump_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Associated bonding curve token account
    #[account(mut)]
    pub pump_associated_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Event authority PDA
    pub pump_event_authority: UncheckedAccount<'info>,

    /// CHECK: Pump.fun fee recipient
    #[account(mut)]
    pub pump_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: PumpFun creator_vault PDA
    #[account(mut)]
    pub pump_creator_vault: UncheckedAccount<'info>,

    /// CHECK: PumpFun fee_config PDA
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: PumpFun fee program
    #[account(constraint = pump_fee_program.key() == pump_fun::FEE_PROGRAM_ID @ LaunchVaultError::InvalidPumpFeeProgram)]
    pub pump_fee_program: UncheckedAccount<'info>,

    /// CHECK: PumpFun bonding_curve_v2 PDA — verified via seed derivation + owner check
    #[account(
        constraint = pump_bonding_curve_v2.key() == pump_fun::derive_bonding_curve_v2(&vault.token_mint)
            @ LaunchVaultError::InvalidBondingCurveData,
        constraint = pump_bonding_curve_v2.owner == &pump_fun::PUMP_FUN_PROGRAM_ID
            @ LaunchVaultError::InvalidBondingCurveData,
    )]
    pub pump_bonding_curve_v2: UncheckedAccount<'info>,

    /// CHECK: Token2022 program
    #[account(
        constraint = token_program.key() == crate::cpi::token_utils::TOKEN_2022_PROGRAM_ID @ LaunchVaultError::InvalidTokenProgram,
    )]
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: Vault token account (ATA derived with Token2022)
    #[account(
        mut,
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &vault.key(),
            &vault.token_mint,
            &TOKEN_2022_PROGRAM_ID,
        ) @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub vault_token_account: UncheckedAccount<'info>,
}

/// Trigger stop-loss sell for a vault position.
///
/// **Access:** Restricted to the protocol `executor` (keeper bot) only.
/// Price is read on-chain from the bonding curve v2 account.
/// The actual sale executes at real market price via Pump.fun.
pub fn handler(
    ctx: Context<TriggerStopLoss>,
    amount: u64,
    min_sol_output: u64,
) -> Result<()> {
    let vault_key = ctx.accounts.vault.key();
    let signer_key = ctx.accounts.signer.key();

    let vault_token_account_info = ctx.accounts.vault_token_account.to_account_info();
    let lp_pool_info = ctx.accounts.lp_pool.to_account_info();
    let vault_info = ctx.accounts.vault.to_account_info();

    let user_key = ctx.accounts.vault.user;
    let mint_key = ctx.accounts.vault.token_mint;
    let bump = ctx.accounts.vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", user_key.as_ref(), mint_key.as_ref(), &[bump]];

    let vault = &mut ctx.accounts.vault;

    require!(
        vault.stop_loss_bps < 10_000,
        LaunchVaultError::InvalidStopLossParam
    );

    require!(
        vault.entry_price > 0,
        LaunchVaultError::StopLossConditionNotMet
    );

    let current_price = pump_fun::read_bonding_curve_price(
        &ctx.accounts.pump_bonding_curve_v2.to_account_info(),
    )?;

    let stop_loss_threshold = (vault.entry_price as u128)
        .checked_mul((10_000 - vault.stop_loss_bps) as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    require!(
        current_price <= stop_loss_threshold,
        LaunchVaultError::StopLossConditionNotMet
    );

    let pre_sell_remaining = vault.remaining_token_amount;
    require!(pre_sell_remaining > 0, LaunchVaultError::StopLossConditionNotMet);

    // Always sell all remaining tokens on stop-loss to prevent partial sells
    // from blocking subsequent calls (stop_loss_triggered is set once).
    let tokens_to_sell = vault.remaining_token_amount;

    let sell_ix = pump_fun::build_sell_instruction(
        &ctx.accounts.pump_global.key(),
        &ctx.accounts.pump_fee_recipient.key(),
        &mint_key,
        &ctx.accounts.pump_bonding_curve.key(),
        &ctx.accounts.pump_associated_bonding_curve.key(),
        &ctx.accounts.vault_token_account.key(),
        &vault_key,
        &ctx.accounts.system_program.key(),
        &ctx.accounts.pump_creator_vault.key(),
        &ctx.accounts.token_program.key(),
        &ctx.accounts.pump_event_authority.key(),
        &ctx.accounts.pump_fee_config.key(),
        &ctx.accounts.pump_bonding_curve_v2.key(),
        tokens_to_sell,
        min_sol_output,
    );

    let vault_lamports_before = vault_info.lamports();

    invoke_signed(
        &sell_ix,
        &[
            ctx.accounts.pump_global.to_account_info(),
            ctx.accounts.pump_fee_recipient.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.pump_bonding_curve.to_account_info(),
            ctx.accounts.pump_associated_bonding_curve.to_account_info(),
            vault_token_account_info.clone(),
            vault_info.clone(),
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

    let vault_lamports_after = vault_info.lamports();
    let sol_received = vault_lamports_after.saturating_sub(vault_lamports_before);

    let after_balance = read_token_account_amount(&vault_token_account_info)?;

    let tokens_sold = vault
        .remaining_token_amount
        .checked_sub(after_balance)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let proportional_return = (tokens_sold as u128)
        .checked_mul(vault.remaining_lp_allocation as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(pre_sell_remaining as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    let sol_to_pool = sol_received.min(proportional_return);

    if sol_to_pool > 0 {
        **vault_info.try_borrow_mut_lamports()? -= sol_to_pool;
        **lp_pool_info.try_borrow_mut_lamports()? += sol_to_pool;
    }

    // Always update LP pool accounting (mirroring sell_position logic)
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(proportional_return)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    let lp_loss = proportional_return.saturating_sub(sol_to_pool);
    if lp_loss > 0 {
        lp_pool.total_liquidity = lp_pool
            .total_liquidity
            .checked_sub(lp_loss)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    }
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    vault.remaining_token_amount = after_balance;
    vault.remaining_lp_allocation = vault
        .remaining_lp_allocation
        .checked_sub(proportional_return)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let clock = Clock::get()?;

    // Always mark stop-loss as triggered after the first execution to prevent
    // unbounded repeated calls. The constraint `!vault.stop_loss_triggered`
    // ensures this instruction can only fire once per position.
    vault.stop_loss_triggered = true;
    vault.stop_loss_timestamp = clock.unix_timestamp;

    if vault.remaining_token_amount == 0 {
        vault.status = VaultStatus::Closed;
    }

    emit!(StopLossTriggeredEvent {
        vault: vault_key,
        token_mint: mint_key,
        entry_price: vault.entry_price,
        trigger_price: current_price,
        tokens_sold,
        sol_received,
        timestamp: clock.unix_timestamp,
    });

    emit!(PositionSoldEvent {
        vault: vault_key,
        seller: signer_key,
        token_mint: mint_key,
        tokens_sold,
        sol_received,
        sol_returned_to_pool: sol_to_pool,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
