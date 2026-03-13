use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::cpi::token_utils::build_burn_instruction;
use crate::errors::LaunchVaultError;
use crate::events::LpWithdrawnEvent;
use crate::state::LpPool;

#[derive(Accounts)]
pub struct WithdrawLp<'info> {
    #[account(mut)]
    pub withdrawer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    /// CHECK: LP mint PDA — verified against lp_pool.lp_mint
    #[account(
        mut,
        constraint = lp_mint.key() == lp_pool.lp_mint @ LaunchVaultError::InvalidLpTokenAmount,
    )]
    pub lp_mint: UncheckedAccount<'info>,

    /// CHECK: Withdrawer's LP token account (ATA)
    #[account(mut)]
    pub withdrawer_lp_ata: UncheckedAccount<'info>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawLp>, lp_amount: u64) -> Result<()> {
    require!(lp_amount > 0, LaunchVaultError::ZeroWithdrawAmount);

    let lp_pool = &ctx.accounts.lp_pool;
    require!(
        lp_pool.lp_mint_supply > 0,
        LaunchVaultError::InvalidLpTokenAmount
    );

    // Calculate SOL to return based on LP token share
    let sol_out = (lp_amount as u128)
        .checked_mul(lp_pool.total_liquidity as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(lp_pool.lp_mint_supply as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    require!(sol_out > 0, LaunchVaultError::ZeroWithdrawAmount);
    require!(
        sol_out <= lp_pool.available_liquidity,
        LaunchVaultError::InsufficientAvailableLiquidity
    );

    // Rent-exemption check
    let lp_pool_info = ctx.accounts.lp_pool.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(lp_pool_info.data_len());
    require!(
        lp_pool_info.lamports().saturating_sub(sol_out) >= min_balance,
        LaunchVaultError::InsufficientAvailableLiquidity
    );

    // Burn LP tokens from withdrawer (withdrawer is authority over their own ATA)
    let burn_ix = build_burn_instruction(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.withdrawer_lp_ata.key(),
        &ctx.accounts.lp_mint.key(),
        &ctx.accounts.withdrawer.key(),
        lp_amount,
    );

    invoke_signed(
        &burn_ix,
        &[
            ctx.accounts.withdrawer_lp_ata.to_account_info(),
            ctx.accounts.lp_mint.to_account_info(),
            ctx.accounts.withdrawer.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[], // withdrawer signs directly, no PDA
    )?;

    // Transfer SOL from LP pool PDA to withdrawer
    **lp_pool_info.try_borrow_mut_lamports()? -= sol_out;
    **ctx
        .accounts
        .withdrawer
        .to_account_info()
        .try_borrow_mut_lamports()? += sol_out;

    // Update pool state
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_sub(sol_out)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.lp_mint_supply = lp_pool
        .lp_mint_supply
        .checked_sub(lp_amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let lp_token_price = if lp_pool.lp_mint_supply > 0 {
        (lp_pool.total_liquidity as u128)
            .checked_mul(1_000_000_000)
            .unwrap_or(0)
            .checked_div(lp_pool.lp_mint_supply as u128)
            .unwrap_or(0) as u64
    } else {
        1_000_000_000
    };

    let clock = Clock::get()?;
    emit!(LpWithdrawnEvent {
        withdrawer: ctx.accounts.withdrawer.key(),
        lp_tokens_burned: lp_amount,
        sol_amount: sol_out,
        new_total_liquidity: lp_pool.total_liquidity,
        lp_token_price,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
