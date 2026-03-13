use anchor_lang::prelude::*;

use crate::errors::LaunchVaultError;
use crate::events::ProtocolConfigUpdatedEvent;
use crate::state::*;

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
    new_fixed_fee: Option<u64>,
    new_fee_bps: Option<u16>,
    new_max_utilization_bps: Option<u16>,
    new_position_timeout: Option<i64>,
    new_close_reward_bps: Option<u16>,
    new_insurance_split_bps: Option<u16>,
    new_redemption_fee_bps: Option<u16>,
    new_admin: Option<Pubkey>,
    new_cb_position_limit: Option<u32>,
    new_cb_window_seconds: Option<i64>,
    new_cb_cooldown_seconds: Option<i64>,
    new_min_insurance_fund: Option<u64>,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;

    if let Some(executor) = new_executor {
        config.executor = executor;
    }
    if let Some(treasury) = new_treasury {
        config.treasury = treasury;
    }
    if let Some(fixed_fee) = new_fixed_fee {
        config.fixed_fee = fixed_fee;
    }
    if let Some(fee_bps) = new_fee_bps {
        require!(fee_bps <= 10_000, LaunchVaultError::InvalidFeeBps);
        config.fee_bps = fee_bps;
    }
    if let Some(max_utilization_bps) = new_max_utilization_bps {
        require!(
            max_utilization_bps > 0 && max_utilization_bps <= 10_000,
            LaunchVaultError::InvalidUtilizationBps
        );
        config.max_utilization_bps = max_utilization_bps;
    }
    if let Some(position_timeout) = new_position_timeout {
        require!(
            position_timeout >= 300,
            LaunchVaultError::InvalidPositionTimeout
        );
        config.position_timeout = position_timeout;
    }
    if let Some(close_reward_bps) = new_close_reward_bps {
        require!(close_reward_bps <= 10_000, LaunchVaultError::InvalidFeeBps);
        config.close_reward_bps = close_reward_bps;
    }
    if let Some(insurance_split_bps) = new_insurance_split_bps {
        require!(
            insurance_split_bps <= 10_000,
            LaunchVaultError::InvalidFeeBps
        );
        config.insurance_split_bps = insurance_split_bps;
    }
    if let Some(redemption_fee_bps) = new_redemption_fee_bps {
        require!(
            redemption_fee_bps <= 10_000,
            LaunchVaultError::InvalidRedemptionFeeBps
        );
        config.redemption_fee_bps = redemption_fee_bps;
    }
    if let Some(admin) = new_admin {
        config.admin = admin;
    }
    if let Some(cb_position_limit) = new_cb_position_limit {
        config.cb_position_limit = cb_position_limit;
    }
    if let Some(cb_window_seconds) = new_cb_window_seconds {
        require!(
            cb_window_seconds > 0,
            LaunchVaultError::InvalidCircuitBreakerParam
        );
        config.cb_window_seconds = cb_window_seconds;
    }
    if let Some(cb_cooldown_seconds) = new_cb_cooldown_seconds {
        require!(
            cb_cooldown_seconds > 0,
            LaunchVaultError::InvalidCircuitBreakerParam
        );
        config.cb_cooldown_seconds = cb_cooldown_seconds;
    }
    if let Some(min_insurance_fund) = new_min_insurance_fund {
        config.min_insurance_fund = min_insurance_fund;
    }

    let clock = Clock::get()?;
    emit!(ProtocolConfigUpdatedEvent {
        admin: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
