use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::system_program;

use crate::cpi::pump_fun;
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::TokenBoughtEvent;

#[derive(Accounts)]
pub struct ProxyBuyToken<'info> {
    #[account(
        constraint = executor.key() == protocol_config.executor @ LaunchVaultError::UnauthorizedExecutor,
    )]
    pub executor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.user.as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.status == VaultStatus::ReadyForExecution @ LaunchVaultError::InvalidVaultStatus,
    )]
    pub vault_state: Account<'info, LaunchVaultState>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = protocol_config.status == ProtocolStatus::Active @ LaunchVaultError::ProtocolPaused,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    /// CHECK: Vault's token account — tokens arrive here from Pump.fun buy CPI
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Token mint — passed through to Pump.fun buy CPI
    pub token_mint: UncheckedAccount<'info>,

    /// CHECK: Pump.fun program ID verified in constraint
    #[account(
        constraint = pump_program.key() == pump_fun::PUMP_FUN_PROGRAM_ID
    )]
    pub pump_program: UncheckedAccount<'info>,

    /// CHECK: Pump global state PDA ["global"]
    #[account(mut)]
    pub pump_global: UncheckedAccount<'info>,

    /// CHECK: Pump.fun fee recipient
    #[account(mut)]
    pub pump_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: Bonding curve PDA ["bonding-curve", mint]
    #[account(mut)]
    pub pump_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Associated bonding curve token account
    #[account(mut)]
    pub pump_associated_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Event authority PDA ["__event_authority"]
    pub pump_event_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<ProxyBuyToken>,
    amount: u64,
    max_sol_cost: u64,
) -> Result<()> {
    require!(amount > 0, LaunchVaultError::ZeroTokenAmount);

    let vault = &ctx.accounts.vault_state;
    let buy_budget = vault
        .total_lp_allocation
        .checked_add(vault.user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    require!(max_sol_cost <= buy_budget, LaunchVaultError::BudgetExceeded);

    // --- Step 1: Transfer SOL from lp_pool PDA → vault PDA ---
    let lp_pool_bump = ctx.accounts.lp_pool.bump;
    let lp_pool_seeds: &[&[u8]] = &[b"lp_pool", &[lp_pool_bump]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.lp_pool.to_account_info(),
                to: ctx.accounts.vault_state.to_account_info(),
            },
            &[lp_pool_seeds],
        ),
        buy_budget,
    )?;

    // --- Step 2: CPI buy on Pump.fun with vault PDA as signer ---
    let vault_user = vault.user;
    let vault_token_mint = vault.token_mint;
    let vault_bump = vault.bump;
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        vault_user.as_ref(),
        vault_token_mint.as_ref(),
        &[vault_bump],
    ];

    let ix = pump_fun::build_buy_instruction(
        &ctx.accounts.pump_global.key(),
        &ctx.accounts.pump_fee_recipient.key(),
        &ctx.accounts.token_mint.key(),
        &ctx.accounts.pump_bonding_curve.key(),
        &ctx.accounts.pump_associated_bonding_curve.key(),
        &ctx.accounts.vault_token_account.key(),
        &ctx.accounts.vault_state.key(),
        &ctx.accounts.system_program.key(),
        &ctx.accounts.token_program.key(),
        &ctx.accounts.rent.key(),
        &ctx.accounts.pump_event_authority.key(),
        amount,
        max_sol_cost,
    );

    let account_infos = vec![
        ctx.accounts.pump_global.to_account_info(),
        ctx.accounts.pump_fee_recipient.to_account_info(),
        ctx.accounts.token_mint.to_account_info(),
        ctx.accounts.pump_bonding_curve.to_account_info(),
        ctx.accounts.pump_associated_bonding_curve.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(),
        ctx.accounts.vault_state.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        ctx.accounts.pump_event_authority.to_account_info(),
        ctx.accounts.pump_program.to_account_info(),
    ];

    invoke_signed(&ix, &account_infos, &[vault_seeds])?;

    // --- Step 3: Return unused SOL from vault PDA → lp_pool ---
    let vault_lamports = ctx.accounts.vault_state.to_account_info().lamports();
    let vault_rent = Rent::get()?.minimum_balance(8 + LaunchVaultState::INIT_SPACE);
    let excess_lamports = vault_lamports.saturating_sub(vault_rent);

    if excess_lamports > 0 {
        // Transfer excess SOL back to lp_pool
        let vault_info = ctx.accounts.vault_state.to_account_info();
        let lp_pool_info = ctx.accounts.lp_pool.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= excess_lamports;
        **lp_pool_info.try_borrow_mut_lamports()? += excess_lamports;
    }

    let sol_spent = buy_budget.saturating_sub(excess_lamports);

    // --- Step 4: Update state ---
    let vault_key = ctx.accounts.vault_state.key();
    let executor_key = ctx.accounts.executor.key();

    // Read actual token balance from vault ATA after buy (not the requested amount)
    let vault_ata_info = ctx.accounts.vault_token_account.to_account_info();
    let ata_data = vault_ata_info.try_borrow_data()?;
    let actual_tokens = u64::from_le_bytes(ata_data[64..72].try_into().unwrap());
    drop(ata_data);

    let vault = &mut ctx.accounts.vault_state;
    vault.total_token_amount = actual_tokens;
    vault.remaining_token_amount = actual_tokens;
    vault.status = VaultStatus::Active;

    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_sub(sol_spent)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    // Release user_contribution from reserved (it was spent in the buy).
    // lp_allocation stays reserved until redeem/liquidate.
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(vault.user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let clock = Clock::get()?;
    emit!(TokenBoughtEvent {
        vault: vault_key,
        executor: executor_key,
        token_mint: vault.token_mint,
        token_amount: actual_tokens,
        sol_spent,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
