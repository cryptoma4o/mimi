use anchor_lang::prelude::*;

use crate::errors::LaunchVaultError;
use crate::events::InsuranceFundWithdrawnEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct WithdrawInsuranceFund<'info> {
    #[account(
        mut,
        constraint = admin.key() == insurance_fund.authority @ LaunchVaultError::InvalidInsuranceFundAuthority,
    )]
    pub admin: Signer<'info>,

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

    #[account(mut)]
    pub destination: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawInsuranceFund>, amount: u64) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroInsuranceFundAmount);

    require!(
        ctx.accounts.insurance_fund.total_sol >= amount,
        LaunchVaultError::InsuranceFundBelowMinimum
    );

    let new_total = ctx
        .accounts
        .insurance_fund
        .total_sol
        .checked_sub(amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    require!(
        new_total >= ctx.accounts.protocol_config.min_insurance_fund,
        LaunchVaultError::InsuranceFundBelowMinimum
    );

    **ctx
        .accounts
        .insurance_fund
        .to_account_info()
        .try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .destination
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    ctx.accounts.insurance_fund.total_sol = new_total;

    let clock = Clock::get()?;
    emit!(InsuranceFundWithdrawnEvent {
        amount,
        new_total,
        destination: ctx.accounts.destination.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
