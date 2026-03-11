use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::cpi::pump_fun;
use crate::cpi::token_utils::read_token_account_amount;
use crate::errors::LaunchVaultError;
use crate::events::PositionSoldEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct SellPosition<'info> {
    /// Seller: must be vault owner OR executor (keeper)
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.user.as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.status == VaultStatus::Active @ LaunchVaultError::InvalidVaultStatus,
        constraint = (
            seller.key() == vault_state.user ||
            seller.key() == protocol_config.executor
        ) @ LaunchVaultError::UnauthorizedSeller,
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
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &vault_state.key(),
            &vault_state.token_mint,
            // Hardcode Token2022 for ATA derivation — Pump.fun v2 tokens are Token2022,
            // but Pump.fun sell CPI expects old SPL Token program in token_program position.
            &pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
        ) @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Token mint
    #[account(
        constraint = token_mint.key() == vault_state.token_mint @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub token_mint: UncheckedAccount<'info>,

    // === Pump.fun accounts for sell ===
    /// CHECK: Pump.fun program ID
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

    /// CHECK: PumpFun creator_vault PDA
    #[account(mut)]
    pub pump_creator_vault: UncheckedAccount<'info>,

    /// CHECK: PumpFun fee_config PDA
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: PumpFun bonding_curve_v2 PDA
    pub pump_bonding_curve_v2: UncheckedAccount<'info>,

    /// CHECK: PumpFun Fee Program
    #[account(constraint = pump_fee_program.key() == pump_fun::FEE_PROGRAM_ID)]
    pub pump_fee_program: UncheckedAccount<'info>,

    // === System ===
    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SellPosition>, amount: u64, min_sol_output: u64) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroTokenAmount);
    require!(
        amount <= ctx.accounts.vault_state.remaining_token_amount,
        LaunchVaultError::RedeemAmountExceedsRemaining
    );

    let user_key = ctx.accounts.vault_state.user;
    let mint_key = ctx.accounts.vault_state.token_mint;
    let bump = ctx.accounts.vault_state.bump;
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];

    // Record vault lamports before sell to calculate SOL received
    let vault_lamports_before = ctx.accounts.vault_state.to_account_info().lamports();

    let vault_pda = ctx.accounts.vault_state.key();

    // Build sell instruction — vault PDA sells tokens back into bonding curve
    // SOL received goes to vault PDA, then we transfer to LP pool
    // NOTE: Sell has different account layout than buy (no volume accumulators,
    // creator_vault before token_program)
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
        amount,
        min_sol_output,
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

    // Calculate SOL received from sell
    let vault_lamports_after = ctx.accounts.vault_state.to_account_info().lamports();
    let sol_received = vault_lamports_after.saturating_sub(vault_lamports_before);

    // Read actual remaining tokens to verify sell
    let remaining_tokens = read_token_account_amount(
        &ctx.accounts.vault_token_account.to_account_info(),
    )?;
    let tokens_sold = ctx.accounts.vault_state.remaining_token_amount
        .checked_sub(remaining_tokens)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Calculate proportional LP allocation for tokens sold
    let vault = &ctx.accounts.vault_state;
    let proportional_lp = (tokens_sold as u128)
        .checked_mul(vault.remaining_lp_allocation as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(vault.remaining_token_amount as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    // Pool recovers up to proportional_lp from the sell proceeds.
    // Any excess SOL (user's profit) stays on the vault PDA and is
    // returned to the vault owner when close_position is called.
    let pool_recovery = sol_received.min(proportional_lp);

    if pool_recovery > 0 {
        **ctx.accounts.vault_state.to_account_info().try_borrow_mut_lamports()? -= pool_recovery;
        **ctx.accounts.lp_pool.to_account_info().try_borrow_mut_lamports()? += pool_recovery;
    }

    // Update vault state
    let vault = &mut ctx.accounts.vault_state;
    vault.remaining_token_amount = remaining_tokens;
    vault.remaining_lp_allocation = vault
        .remaining_lp_allocation
        .checked_sub(proportional_lp)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    if vault.remaining_token_amount == 0 {
        vault.status = VaultStatus::Closed;
    }

    // Update LP pool accounting
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(proportional_lp)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    let lp_loss = proportional_lp.saturating_sub(pool_recovery);
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

    let clock = Clock::get()?;
    emit!(PositionSoldEvent {
        vault: ctx.accounts.vault_state.key(),
        seller: ctx.accounts.seller.key(),
        token_mint: mint_key,
        tokens_sold,
        sol_received,
        sol_returned_to_pool: pool_recovery,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
