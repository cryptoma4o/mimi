use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::cpi::token_utils::build_transfer_checked_instruction;
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::VaultLiquidatedEvent;

#[derive(Accounts)]
pub struct LiquidateVault<'info> {
    #[account(
        constraint = executor.key() == protocol_config.executor @ LaunchVaultError::UnauthorizedExecutor,
    )]
    pub executor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.user.as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.status == VaultStatus::Defaulted @ LaunchVaultError::InvalidVaultStatus,
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

    /// CHECK: Vault token account — verified via ATA derivation
    #[account(
        mut,
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &vault_state.key(),
            &vault_state.token_mint,
            &token_program.key(),
        ) @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Executor token account — validated by token program CPI
    #[account(mut)]
    pub executor_token_account: UncheckedAccount<'info>,

    /// CHECK: Token mint — needed for transfer_checked, verified against vault
    #[account(
        constraint = token_mint.key() == vault_state.token_mint @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub token_mint: UncheckedAccount<'info>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<LiquidateVault>) -> Result<()> {
    let vault = &ctx.accounts.vault_state;
    let tokens_to_liquidate = vault.remaining_token_amount;
    let lp_lost = vault.remaining_lp_allocation;

    // CEI: Update state before transfers
    let vault = &mut ctx.accounts.vault_state;
    vault.remaining_token_amount = 0;
    vault.remaining_lp_allocation = 0;
    vault.status = VaultStatus::Closed;

    // LP is lost — remove from reserved and total (penalty)
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_lost)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(lp_lost)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Transfer all remaining tokens to executor (PDA signer, Token2022 compatible)
    let user_key = ctx.accounts.vault_state.user;
    let mint_key = ctx.accounts.vault_state.token_mint;
    let bump = ctx.accounts.vault_state.bump;
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];

    let transfer_ix = build_transfer_checked_instruction(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.vault_token_account.key(),
        &ctx.accounts.token_mint.key(),
        &ctx.accounts.executor_token_account.key(),
        &ctx.accounts.vault_state.key(),
        tokens_to_liquidate,
        6, // Pump.fun tokens use 6 decimals
    );

    invoke_signed(
        &transfer_ix,
        &[
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.executor_token_account.to_account_info(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    let clock = Clock::get()?;
    emit!(VaultLiquidatedEvent {
        vault: ctx.accounts.vault_state.key(),
        executor: ctx.accounts.executor.key(),
        token_mint: mint_key,
        tokens_liquidated: tokens_to_liquidate,
        lp_lost,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
