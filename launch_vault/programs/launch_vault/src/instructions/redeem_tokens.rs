use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::system_program;

use crate::cpi::token_utils::build_transfer_checked_instruction;
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::TokensRedeemedEvent;

#[derive(Accounts)]
pub struct RedeemTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        has_one = user @ LaunchVaultError::UnauthorizedUser,
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

    /// CHECK: Treasury verified via protocol_config
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ LaunchVaultError::InvalidTreasury,
    )]
    pub treasury: UncheckedAccount<'info>,

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

    /// CHECK: User token account — validated by token program CPI
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: Token mint — needed for transfer_checked, verified against vault
    #[account(
        constraint = token_mint.key() == vault_state.token_mint @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub token_mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<RedeemTokens>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault_state;

    require!(amount > 0, LaunchVaultError::ZeroRedeemAmount);
    require!(
        amount <= vault.remaining_token_amount,
        LaunchVaultError::RedeemAmountExceedsRemaining
    );

    // Calculate proportional LP to return (u128 to avoid overflow)
    let proportional_lp = (amount as u128)
        .checked_mul(vault.remaining_lp_allocation as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(vault.remaining_token_amount as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    // Calculate redemption fee
    let redemption_fee = (proportional_lp as u128)
        .checked_mul(ctx.accounts.protocol_config.redemption_fee_bps as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    // CEI: Update state BEFORE transfers
    let vault = &mut ctx.accounts.vault_state;
    vault.remaining_token_amount = vault
        .remaining_token_amount
        .checked_sub(amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    vault.remaining_lp_allocation = vault
        .remaining_lp_allocation
        .checked_sub(proportional_lp)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let vault_closed = vault.remaining_token_amount == 0;
    if vault_closed {
        vault.status = VaultStatus::Closed;
    }

    // Update LP pool: new SOL arrives from user, release reservation
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_add(proportional_lp)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(proportional_lp)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Transfer proportional LP from user to LP pool
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.lp_pool.to_account_info(),
            },
        ),
        proportional_lp,
    )?;

    // Transfer redemption fee from user to treasury
    if redemption_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            redemption_fee,
        )?;
    }

    // Transfer tokens from vault to user (PDA signer, Token2022 compatible)
    let user_key = ctx.accounts.user.key();
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
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.vault_state.key(),
        amount,
        6, // Pump.fun tokens use 6 decimals
    );

    invoke_signed(
        &transfer_ix,
        &[
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    let clock = Clock::get()?;
    emit!(TokensRedeemedEvent {
        vault: ctx.accounts.vault_state.key(),
        user: ctx.accounts.user.key(),
        token_amount: amount,
        lp_returned: proportional_lp,
        redemption_fee,
        remaining_tokens: ctx.accounts.vault_state.remaining_token_amount,
        remaining_lp: ctx.accounts.vault_state.remaining_lp_allocation,
        vault_closed,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
