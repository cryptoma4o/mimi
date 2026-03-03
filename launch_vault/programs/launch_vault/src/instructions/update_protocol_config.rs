use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::ProtocolConfigUpdatedEvent;

#[derive(Accounts)]
pub struct UpdateProtocolConfig<'info> {
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

pub fn handler(
    ctx: Context<UpdateProtocolConfig>,
    new_executor: Option<Pubkey>,
    new_treasury: Option<Pubkey>,
    new_rental_period: Option<i64>,
    new_rental_fee_rate: Option<u64>,
    new_infrastructure_fee: Option<u64>,
    new_redemption_fee_bps: Option<u16>,
    new_grace_period: Option<i64>,
    new_admin: Option<Pubkey>,
    new_status: Option<ProtocolStatus>,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;

    if let Some(executor) = new_executor {
        config.executor = executor;
    }
    if let Some(treasury) = new_treasury {
        config.treasury = treasury;
    }
    if let Some(rental_period) = new_rental_period {
        require!(rental_period > 0, LaunchVaultError::InvalidRentalPeriod);
        config.rental_period = rental_period;
    }
    if let Some(rental_fee_rate) = new_rental_fee_rate {
        config.rental_fee_rate = rental_fee_rate;
    }
    if let Some(infrastructure_fee) = new_infrastructure_fee {
        config.infrastructure_fee = infrastructure_fee;
    }
    if let Some(redemption_fee_bps) = new_redemption_fee_bps {
        require!(
            redemption_fee_bps <= 10_000,
            LaunchVaultError::InvalidRedemptionFeeBps
        );
        config.redemption_fee_bps = redemption_fee_bps;
    }
    if let Some(grace_period) = new_grace_period {
        require!(grace_period >= 0, LaunchVaultError::InvalidGracePeriod);
        config.grace_period = grace_period;
    }
    if let Some(admin) = new_admin {
        config.admin = admin;
    }
    if let Some(status) = new_status {
        config.status = status;
    }

    let clock = Clock::get()?;
    emit!(ProtocolConfigUpdatedEvent {
        admin: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
