use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::system_program;

use crate::cpi::token_utils::{build_mint_to_instruction, build_create_ata_idempotent_instruction};
use crate::state::LpPool;
use crate::errors::LaunchVaultError;
use crate::events::LpDepositedEvent;

#[derive(Accounts)]
pub struct DepositLp<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

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

    /// CHECK: Depositor's LP token account (ATA) — created idempotently
    #[account(mut)]
    pub depositor_lp_ata: UncheckedAccount<'info>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositLp>, amount: u64) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroDepositAmount);

    let lp_pool = &ctx.accounts.lp_pool;

    // Calculate LP tokens to mint
    let lp_tokens_to_mint = if lp_pool.lp_mint_supply == 0 || lp_pool.total_liquidity == 0 {
        amount // First deposit (or pool fully drained by defaults): 1:1 ratio
    } else {
        (amount as u128)
            .checked_mul(lp_pool.lp_mint_supply as u128)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?
            .checked_div(lp_pool.total_liquidity as u128)
            .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64
    };

    require!(lp_tokens_to_mint > 0, LaunchVaultError::InvalidLpTokenAmount);

    // Transfer SOL from depositor to LP pool
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.lp_pool.to_account_info(),
            },
        ),
        amount,
    )?;

    // Create depositor's LP ATA if needed (idempotent)
    invoke_signed(
        &build_create_ata_idempotent_instruction(
            &ctx.accounts.depositor.key(),
            &ctx.accounts.depositor.key(),
            &ctx.accounts.lp_mint.key(),
            &ctx.accounts.token_program.key(),
            &ctx.accounts.associated_token_program.key(),
        ),
        &[
            ctx.accounts.depositor.to_account_info(),
            ctx.accounts.depositor_lp_ata.to_account_info(),
            ctx.accounts.depositor.to_account_info(),
            ctx.accounts.lp_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.associated_token_program.to_account_info(),
        ],
        &[],
    )?;

    // Mint LP tokens to depositor (LP mint PDA as authority)
    let (_, lp_mint_bump) = Pubkey::find_program_address(
        &[b"lp_mint"],
        ctx.program_id,
    );
    let lp_mint_seeds: &[&[u8]] = &[b"lp_mint", &[lp_mint_bump]];

    let mint_ix = build_mint_to_instruction(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.lp_mint.key(),
        &ctx.accounts.depositor_lp_ata.key(),
        &ctx.accounts.lp_mint.key(), // authority = lp_mint PDA
        lp_tokens_to_mint,
    );

    invoke_signed(
        &mint_ix,
        &[
            ctx.accounts.lp_mint.to_account_info(),
            ctx.accounts.depositor_lp_ata.to_account_info(),
            ctx.accounts.lp_mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[lp_mint_seeds],
    )?;

    // Update pool state
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_add(amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.lp_mint_supply = lp_pool
        .lp_mint_supply
        .checked_add(lp_tokens_to_mint)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let lp_token_price = if lp_pool.lp_mint_supply > 0 {
        (lp_pool.total_liquidity as u128)
            .checked_mul(1_000_000_000) // 9 decimals precision
            .unwrap_or(0)
            .checked_div(lp_pool.lp_mint_supply as u128)
            .unwrap_or(0) as u64
    } else {
        1_000_000_000
    };

    let clock = Clock::get()?;
    emit!(LpDepositedEvent {
        depositor: ctx.accounts.depositor.key(),
        sol_amount: amount,
        lp_tokens_minted: lp_tokens_to_mint,
        new_total_liquidity: lp_pool.total_liquidity,
        lp_token_price,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
