use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::LpPool;
use crate::errors::LaunchVaultError;
use crate::events::LpDepositedEvent;

#[derive(Accounts)]
pub struct DepositLp<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
        constraint = authority.key() == lp_pool.authority @ LaunchVaultError::UnauthorizedAdmin,
    )]
    pub lp_pool: Account<'info, LpPool>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositLp>, amount: u64) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroLpAllocation);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.lp_pool.to_account_info(),
            },
        ),
        amount,
    )?;

    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_add(amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let clock = Clock::get()?;
    emit!(LpDepositedEvent {
        authority: ctx.accounts.authority.key(),
        amount,
        new_total_liquidity: lp_pool.total_liquidity,
        new_available_liquidity: lp_pool.available_liquidity,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
