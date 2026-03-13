use anchor_lang::prelude::*;

use crate::errors::LaunchVaultError;
use crate::events::ProtocolResumedEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct ResumeProtocol<'info> {
    #[account(
        constraint = admin.key() == protocol_config.admin @ LaunchVaultError::UnauthorizedAdmin,
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

pub fn handler(ctx: Context<ResumeProtocol>) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;

    require!(
        config.status == ProtocolStatus::Paused,
        LaunchVaultError::ProtocolNotPaused
    );

    let clock = Clock::get()?;
    let can_resume = clock.unix_timestamp >= config.cb_last_trigger
        .checked_add(config.cb_cooldown_seconds)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    if config.cb_last_trigger > 0 {
        require!(can_resume, LaunchVaultError::CircuitBreakerInCooldown);
    }

    config.status = ProtocolStatus::Active;
    config.cb_window_start = clock.unix_timestamp;
    config.cb_positions_in_window = 0;

    emit!(ProtocolResumedEvent {
        resumer: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
