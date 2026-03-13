use anchor_lang::prelude::*;

use crate::errors::LaunchVaultError;
use crate::events::ProtocolPausedEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct PauseProtocol<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

pub fn handler(ctx: Context<PauseProtocol>, reason: String) -> Result<()> {
    require!(reason.len() <= 200, LaunchVaultError::InvalidCircuitBreakerParam);

    let config = &mut ctx.accounts.protocol_config;

    require!(
        ctx.accounts.signer.key() == config.admin || ctx.accounts.signer.key() == config.executor,
        LaunchVaultError::UnauthorizedPauser
    );

    require!(
        config.status != ProtocolStatus::Paused,
        LaunchVaultError::ProtocolPaused
    );

    config.status = ProtocolStatus::Paused;

    let clock = Clock::get()?;
    emit!(ProtocolPausedEvent {
        pauser: ctx.accounts.signer.key(),
        reason,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
