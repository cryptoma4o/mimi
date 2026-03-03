use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::VaultDefaultedEvent;

#[derive(Accounts)]
pub struct MarkDefaulted<'info> {
    /// Permissionless cranker — anyone can call
    pub cranker: Signer<'info>,

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
}

pub fn handler(ctx: Context<MarkDefaulted>) -> Result<()> {
    let clock = Clock::get()?;
    let vault = &ctx.accounts.vault_state;
    let config = &ctx.accounts.protocol_config;

    let default_deadline = vault
        .rental_due_timestamp
        .checked_add(config.grace_period)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    require!(
        clock.unix_timestamp > default_deadline,
        LaunchVaultError::GracePeriodNotExpired
    );

    // Capture keys before mutable borrow
    let vault_key = ctx.accounts.vault_state.key();
    let cranker_key = ctx.accounts.cranker.key();

    let vault = &mut ctx.accounts.vault_state;
    vault.status = VaultStatus::Defaulted;
    vault.rental_status = RentalStatus::Overdue;

    emit!(VaultDefaultedEvent {
        vault: vault_key,
        user: vault.user,
        token_mint: vault.token_mint,
        remaining_tokens: vault.remaining_token_amount,
        remaining_lp: vault.remaining_lp_allocation,
        cranker: cranker_key,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
