use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::ProtocolInitializedEvent;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = admin,
        space = 8 + LpPool::INIT_SPACE,
        seeds = [b"lp_pool"],
        bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    executor: Pubkey,
    treasury: Pubkey,
    rental_period: i64,
    rental_fee_rate: u64,
    infrastructure_fee: u64,
    redemption_fee_bps: u16,
    grace_period: i64,
) -> Result<()> {
    require!(rental_period > 0, LaunchVaultError::InvalidRentalPeriod);
    require!(grace_period >= 0, LaunchVaultError::InvalidGracePeriod);
    require!(redemption_fee_bps <= 10_000, LaunchVaultError::InvalidRedemptionFeeBps);

    let config = &mut ctx.accounts.protocol_config;
    config.admin = ctx.accounts.admin.key();
    config.executor = executor;
    config.treasury = treasury;
    config.rental_period = rental_period;
    config.rental_fee_rate = rental_fee_rate;
    config.infrastructure_fee = infrastructure_fee;
    config.redemption_fee_bps = redemption_fee_bps;
    config.grace_period = grace_period;
    config.status = ProtocolStatus::Active;
    config.bump = ctx.bumps.protocol_config;

    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = 0;
    lp_pool.reserved_liquidity = 0;
    lp_pool.available_liquidity = 0;
    lp_pool.authority = ctx.accounts.admin.key();
    lp_pool.bump = ctx.bumps.lp_pool;

    let clock = Clock::get()?;
    emit!(ProtocolInitializedEvent {
        admin: ctx.accounts.admin.key(),
        executor,
        treasury,
        rental_period,
        rental_fee_rate,
        infrastructure_fee,
        redemption_fee_bps,
        grace_period,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
