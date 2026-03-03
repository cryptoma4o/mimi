use anchor_lang::prelude::*;

use crate::state::LpPool;
use crate::errors::LaunchVaultError;
use crate::events::LpWithdrawnEvent;

#[derive(Accounts)]
pub struct WithdrawLp<'info> {
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

pub fn handler(ctx: Context<WithdrawLp>, amount: u64) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroLpAllocation);
    require!(
        amount <= ctx.accounts.lp_pool.available_liquidity,
        LaunchVaultError::InsufficientAvailableLiquidity
    );

    // Rent-exemption check: ensure LP pool account stays rent-exempt
    let lp_pool_info = ctx.accounts.lp_pool.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(lp_pool_info.data_len());
    require!(
        lp_pool_info.lamports().saturating_sub(amount) >= min_balance,
        LaunchVaultError::InsufficientAvailableLiquidity
    );

    // Transfer SOL from LP pool PDA to authority
    let authority_info = ctx.accounts.authority.to_account_info();

    **lp_pool_info.try_borrow_mut_lamports()? -= amount;
    **authority_info.try_borrow_mut_lamports()? += amount;

    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_sub(amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let clock = Clock::get()?;
    emit!(LpWithdrawnEvent {
        authority: ctx.accounts.authority.key(),
        amount,
        new_total_liquidity: lp_pool.total_liquidity,
        new_available_liquidity: lp_pool.available_liquidity,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
