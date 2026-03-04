use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;

use crate::cpi::pump_fun;
use crate::cpi::token_utils;
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::TokenBoughtEvent;

#[derive(Accounts)]
pub struct ProxyBuyToken<'info> {
    #[account(
        mut,
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

    /// CHECK: Vault's token account — final destination for purchased tokens
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Executor's token account — receives tokens from PumpFun buy, then forwards to vault
    #[account(mut)]
    pub executor_token_account: UncheckedAccount<'info>,

    /// CHECK: Token mint — passed through to PumpFun buy CPI
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

    /// CHECK: PumpFun global_volume_accumulator PDA
    pub pump_global_volume_accumulator: UncheckedAccount<'info>,

    /// CHECK: PumpFun user_volume_accumulator PDA (derived from executor)
    #[account(mut)]
    pub pump_user_volume_accumulator: UncheckedAccount<'info>,

    /// CHECK: PumpFun creator_vault PDA ["creator-vault", creator]
    #[account(mut)]
    pub pump_creator_vault: UncheckedAccount<'info>,

    /// CHECK: PumpFun fee_config PDA (from Fee Program)
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: PumpFun bonding_curve_v2 PDA ["bonding-curve-v2", mint]
    pub pump_bonding_curve_v2: UncheckedAccount<'info>,

    /// CHECK: PumpFun Fee Program
    #[account(
        constraint = pump_fee_program.key() == pump_fun::FEE_PROGRAM_ID
    )]
    pub pump_fee_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    /// CHECK: Associated Token Program — for creating executor ATA
    pub associated_token_program: UncheckedAccount<'info>,
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

    // Snapshot executor balance before any operations
    let executor_balance_before = ctx.accounts.executor.to_account_info().lamports();

    // --- Step 1: Create executor ATA if it doesn't exist (idempotent) ---
    {
        let create_ata_ix = token_utils::build_create_ata_idempotent_instruction(
            &ctx.accounts.executor.key(),
            &ctx.accounts.executor.key(),
            &ctx.accounts.token_mint.key(),
            &ctx.accounts.token_program.key(),
            &ctx.accounts.associated_token_program.key(),
        );
        invoke(
            &create_ata_ix,
            &[
                ctx.accounts.executor.to_account_info(),
                ctx.accounts.executor_token_account.to_account_info(),
                ctx.accounts.executor.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.associated_token_program.to_account_info(),
            ],
        )?;
    }

    // --- Step 2: CPI buy on PumpFun — executor pays SOL from their wallet ---
    {
        let ix = pump_fun::build_buy_instruction(
            &ctx.accounts.pump_global.key(),
            &ctx.accounts.pump_fee_recipient.key(),
            &ctx.accounts.token_mint.key(),
            &ctx.accounts.pump_bonding_curve.key(),
            &ctx.accounts.pump_associated_bonding_curve.key(),
            &ctx.accounts.executor_token_account.key(), // tokens go to executor ATA
            &ctx.accounts.executor.key(),               // executor pays SOL
            &ctx.accounts.system_program.key(),
            &ctx.accounts.token_program.key(),
            &ctx.accounts.pump_creator_vault.key(),
            &ctx.accounts.pump_event_authority.key(),
            &ctx.accounts.pump_global_volume_accumulator.key(),
            &ctx.accounts.pump_user_volume_accumulator.key(),
            &ctx.accounts.pump_fee_config.key(),
            &ctx.accounts.pump_bonding_curve_v2.key(),
            amount,
            max_sol_cost,
        );

        invoke(
            &ix,
            &[
                ctx.accounts.pump_global.to_account_info(),
                ctx.accounts.pump_fee_recipient.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.pump_bonding_curve.to_account_info(),
                ctx.accounts.pump_associated_bonding_curve.to_account_info(),
                ctx.accounts.executor_token_account.to_account_info(),
                ctx.accounts.executor.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pump_creator_vault.to_account_info(),
                ctx.accounts.pump_event_authority.to_account_info(),
                ctx.accounts.pump_program.to_account_info(),
                ctx.accounts.pump_global_volume_accumulator.to_account_info(),
                ctx.accounts.pump_user_volume_accumulator.to_account_info(),
                ctx.accounts.pump_fee_config.to_account_info(),
                ctx.accounts.pump_fee_program.to_account_info(),
                ctx.accounts.pump_bonding_curve_v2.to_account_info(),
            ],
        )?;
    }

    // --- Step 3: Transfer tokens from executor ATA → vault ATA ---
    let actual_tokens = token_utils::read_token_account_amount(
        &ctx.accounts.executor_token_account.to_account_info(),
    )?;
    require!(actual_tokens > 0, LaunchVaultError::ZeroTokenAmount);

    {
        let transfer_ix = token_utils::build_token_transfer_instruction(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.executor_token_account.key(),
            &ctx.accounts.vault_token_account.key(),
            &ctx.accounts.executor.key(),
            actual_tokens,
        );
        invoke(
            &transfer_ix,
            &[
                ctx.accounts.executor_token_account.to_account_info(),
                ctx.accounts.vault_token_account.to_account_info(),
                ctx.accounts.executor.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;
    }

    // --- Step 4: Reimburse executor from lp_pool ---
    // Calculate how much SOL the executor spent (buy cost + ATA rent).
    let executor_balance_after = ctx.accounts.executor.to_account_info().lamports();
    let sol_spent_by_executor = executor_balance_before.saturating_sub(executor_balance_after);

    // Reimburse only up to buy_budget (executor covers any excess like ATA rent)
    let reimbursement = sol_spent_by_executor.min(buy_budget);

    if reimbursement > 0 {
        let lp_pool_info = ctx.accounts.lp_pool.to_account_info();
        let executor_info = ctx.accounts.executor.to_account_info();
        **lp_pool_info.try_borrow_mut_lamports()? -= reimbursement;
        **executor_info.try_borrow_mut_lamports()? += reimbursement;
    }

    // --- Step 5: Update state ---
    let vault_key = ctx.accounts.vault_state.key();
    let executor_key = ctx.accounts.executor.key();

    let vault = &mut ctx.accounts.vault_state;
    vault.total_token_amount = actual_tokens;
    vault.remaining_token_amount = actual_tokens;
    vault.status = VaultStatus::Active;

    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_sub(reimbursement)
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
        sol_spent: reimbursement,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
