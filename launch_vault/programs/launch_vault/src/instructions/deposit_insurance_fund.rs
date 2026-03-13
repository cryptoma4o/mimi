use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::LaunchVaultError;
use crate::events::InsuranceFundDepositedEvent;
use crate::state::*;

/// Deposit SOL into the insurance fund.
///
/// **Access:** Permissionless — any wallet can contribute to the insurance fund.
/// This is by design: the fund accepts donations from any source.
#[derive(Accounts)]
pub struct DepositInsuranceFund<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"insurance_fund"],
        bump = insurance_fund.bump,
    )]
    pub insurance_fund: Account<'info, InsuranceFund>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositInsuranceFund>, amount: u64) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroInsuranceFundAmount);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.insurance_fund.to_account_info(),
            },
        ),
        amount,
    )?;

    let clock = Clock::get()?;
    ctx.accounts.insurance_fund.total_sol = ctx
        .accounts
        .insurance_fund
        .total_sol
        .checked_add(amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    emit!(InsuranceFundDepositedEvent {
        amount,
        new_total: ctx.accounts.insurance_fund.total_sol,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
