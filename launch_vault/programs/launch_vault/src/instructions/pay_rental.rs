use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::RentalPaidEvent;

#[derive(Accounts)]
pub struct PayRental<'info> {
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

    /// CHECK: Treasury verified via protocol_config
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ LaunchVaultError::InvalidTreasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PayRental>) -> Result<()> {
    let config = &ctx.accounts.protocol_config;
    let rental_fee = config.rental_fee_rate;

    // Transfer rental fee to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        rental_fee,
    )?;

    // Capture keys before mutable borrow
    let vault_key = ctx.accounts.vault_state.key();
    let user_key = ctx.accounts.user.key();

    // Extend rental period
    let vault = &mut ctx.accounts.vault_state;
    vault.rental_due_timestamp = vault
        .rental_due_timestamp
        .checked_add(config.rental_period)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    vault.rental_status = RentalStatus::Active;

    let clock = Clock::get()?;
    emit!(RentalPaidEvent {
        vault: vault_key,
        user: user_key,
        rental_fee,
        new_rental_due_timestamp: vault.rental_due_timestamp,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
