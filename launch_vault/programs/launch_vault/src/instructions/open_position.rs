use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;

use crate::cpi::pump_fun;
use crate::cpi::token_utils::{
    build_close_account_instruction, build_create_ata_instruction,
    build_transfer_checked_instruction,
};
use crate::errors::LaunchVaultError;
use crate::events::{CircuitBreakerTriggeredEvent, InsuranceFundUpdatedEvent, PositionOpenedEvent};
use crate::state::*;

const MAX_BUYERS: usize = pump_fun::MAX_BUYERS;

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    // === Signers ===
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub mint: Signer<'info>,

    // === Protocol state ===
    /// CHECK: vault_state PDA — initialized manually in handler
    #[account(mut)]
    pub vault_state: UncheckedAccount<'info>,

    #[account(
        mut,
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

    /// CHECK: Treasury verified via protocol_config
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ LaunchVaultError::InvalidTreasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"insurance_fund"],
        bump = insurance_fund.bump,
    )]
    pub insurance_fund: Account<'info, InsuranceFund>,

    // === Pump.fun accounts ===
    /// CHECK: Pump.fun program ID
    #[account(constraint = pump_program.key() == pump_fun::PUMP_FUN_PROGRAM_ID)]
    pub pump_program: UncheckedAccount<'info>,

    /// CHECK: Pump global state PDA
    #[account(mut)]
    pub pump_global: UncheckedAccount<'info>,

    /// CHECK: Mint authority PDA
    pub pump_mint_authority: UncheckedAccount<'info>,

    /// CHECK: Bonding curve PDA
    #[account(mut)]
    pub pump_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Associated bonding curve token account
    #[account(mut)]
    pub pump_associated_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Event authority PDA
    pub pump_event_authority: UncheckedAccount<'info>,

    /// CHECK: Pump.fun fee recipient
    #[account(mut)]
    pub pump_fee_recipient: UncheckedAccount<'info>,

    // === Mayhem accounts ===
    /// CHECK: Mayhem program
    #[account(mut, constraint = mayhem_program.key() == pump_fun::MAYHEM_PROGRAM_ID)]
    pub mayhem_program: UncheckedAccount<'info>,

    /// CHECK: Mayhem global params PDA
    pub mayhem_global_params: UncheckedAccount<'info>,

    /// CHECK: Mayhem SOL vault PDA
    #[account(mut)]
    pub mayhem_sol_vault: UncheckedAccount<'info>,

    /// CHECK: Mayhem state PDA
    #[account(mut)]
    pub mayhem_state: UncheckedAccount<'info>,

    /// CHECK: Mayhem token vault
    #[account(mut)]
    pub mayhem_token_vault: UncheckedAccount<'info>,

    // === PumpFun volume accumulators ===
    /// CHECK: PumpFun global_volume_accumulator PDA
    pub pump_global_volume_accumulator: UncheckedAccount<'info>,

    /// CHECK: PumpFun creator_vault PDA
    #[account(mut)]
    pub pump_creator_vault: UncheckedAccount<'info>,

    /// CHECK: PumpFun fee_config PDA
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: PumpFun bonding_curve_v2 PDA
    pub pump_bonding_curve_v2: UncheckedAccount<'info>,

    /// CHECK: PumpFun Fee Program
    #[account(constraint = pump_fee_program.key() == pump_fun::FEE_PROGRAM_ID)]
    pub pump_fee_program: UncheckedAccount<'info>,

    // === System ===
    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub rent: Sysvar<'info, Rent>,
    // === remaining_accounts ===
    // [vault_token_account, buyer_0_pda, buyer_0_ata, buyer_0_vol, ...]
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, OpenPosition<'info>>,
    name: String,
    symbol: String,
    uri: String,
    is_mayhem_mode: bool,
    lp_allocation: u64,
    user_contribution: u64,
    buy_amounts: Vec<u64>,
    max_sol_costs: Vec<u64>,
    stop_loss_bps: u16,
) -> Result<()> {
    // === Validation ===
    let num_buyers = buy_amounts.len();
    require!(num_buyers > 0, LaunchVaultError::NoBuyers);
    require!(
        num_buyers <= MAX_BUYERS,
        LaunchVaultError::MaxBuyersExceeded
    );
    require!(
        buy_amounts.len() == max_sol_costs.len(),
        LaunchVaultError::BuyParamsMismatch
    );
    require!(lp_allocation > 0, LaunchVaultError::ZeroLpAllocation);
    require!(
        user_contribution > 0,
        LaunchVaultError::ZeroUserContribution
    );
    require!(
        stop_loss_bps == 0 || stop_loss_bps < 10_000,
        LaunchVaultError::InvalidStopLossParam
    );

    // Guardrails: validate user_contribution and lp_allocation
    require!(
        user_contribution >= ctx.accounts.protocol_config.min_user_contribution,
        LaunchVaultError::UserContributionTooLow
    );
    require!(
        lp_allocation <= ctx.accounts.protocol_config.max_lp_per_position,
        LaunchVaultError::LpAllocationTooHigh
    );
    let user_ratio_bps_raw = (user_contribution as u128)
        .checked_mul(10_000)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(lp_allocation as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    // Compare in u128 to avoid u16 overflow when user_contribution >> lp_allocation
    require!(
        user_ratio_bps_raw >= ctx.accounts.protocol_config.min_user_ratio_bps as u128,
        LaunchVaultError::InsufficientUserRatio
    );

    require!(
        lp_allocation <= ctx.accounts.lp_pool.available_liquidity,
        LaunchVaultError::InsufficientLpLiquidity
    );

    // Utilization cap check
    let pool = &ctx.accounts.lp_pool;
    let new_reserved = pool
        .reserved_liquidity
        .checked_add(lp_allocation)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    if pool.total_liquidity > 0 {
        let utilization_bps = (new_reserved as u128)
            .checked_mul(10_000)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?
            .checked_div(pool.total_liquidity as u128)
            .ok_or(LaunchVaultError::ArithmeticOverflow)? as u16;
        require!(
            utilization_bps <= ctx.accounts.protocol_config.max_utilization_bps,
            LaunchVaultError::UtilizationCapReached
        );
    }

    let expected_remaining = 1 + num_buyers * 3;
    require!(
        ctx.remaining_accounts.len() == expected_remaining,
        LaunchVaultError::InvalidRemainingAccounts
    );

    let total_max_sol: u64 = max_sol_costs
        .iter()
        .try_fold(0u64, |acc, &x| acc.checked_add(x))
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let buy_budget = lp_allocation
        .checked_add(user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    require!(
        total_max_sol <= buy_budget,
        LaunchVaultError::BudgetExceeded
    );

    // ========================================================
    // Circuit Breaker Check (after input validation)
    // ========================================================
    let clock = Clock::get()?;
    let config = &mut ctx.accounts.protocol_config;
    let now = clock.unix_timestamp;

    // Only run circuit breaker logic when a position limit is configured
    if config.cb_position_limit > 0 {
        if config.cb_last_trigger > 0
            && now
                < config
                    .cb_last_trigger
                    .checked_add(config.cb_cooldown_seconds)
                    .ok_or(LaunchVaultError::ArithmeticOverflow)?
        {
            return err!(LaunchVaultError::CircuitBreakerTriggered);
        }

        if now >= config.cb_window_start
            .checked_add(config.cb_window_seconds)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?
        {
            config.cb_window_start = now;
            config.cb_positions_in_window = 0;
        }

        if config.cb_positions_in_window >= config.cb_position_limit {
            config.cb_last_trigger = now;
            config.status = ProtocolStatus::Paused;
            emit!(CircuitBreakerTriggeredEvent {
                positions_in_window: config.cb_positions_in_window,
                window_limit: config.cb_position_limit,
                timestamp: now,
            });
            return err!(LaunchVaultError::CircuitBreakerTriggered);
        }

        config.cb_positions_in_window = config
            .cb_positions_in_window
            .checked_add(1)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    }

    // ========================================================
    // STEP 1: Calculate and pay upfront fees
    // ========================================================
    let percentage_fee = (lp_allocation as u128)
        .checked_mul(config.fee_bps as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    let total_fee = config
        .fixed_fee
        .checked_add(percentage_fee)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let insurance_amount = (total_fee as u128)
        .checked_mul(config.insurance_split_bps as u128)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64;

    let treasury_amount = total_fee
        .checked_sub(insurance_amount)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Fee → treasury
    if treasury_amount > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            treasury_amount,
        )?;
    }

    let clock = Clock::get()?;

    // Fee → insurance fund
    if insurance_amount > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.insurance_fund.to_account_info(),
                },
            ),
            insurance_amount,
        )?;

        // Update insurance fund accounting
        ctx.accounts.insurance_fund.total_sol = ctx
            .accounts
            .insurance_fund
            .total_sol
            .checked_add(insurance_amount)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;

        emit!(InsuranceFundUpdatedEvent {
            new_total: ctx.accounts.insurance_fund.total_sol,
            amount_added: insurance_amount,
            timestamp: clock.unix_timestamp,
        });
    }

    // ========================================================
    // STEP 2: CPI create_v2 — create token on Pump.fun
    // ========================================================
    let create_ix = pump_fun::build_create_v2_instruction(
        &ctx.accounts.mint.key(),
        &ctx.accounts.pump_mint_authority.key(),
        &ctx.accounts.pump_bonding_curve.key(),
        &ctx.accounts.pump_associated_bonding_curve.key(),
        &ctx.accounts.pump_global.key(),
        &ctx.accounts.user.key(),
        &ctx.accounts.mayhem_program.key(),
        &ctx.accounts.mayhem_global_params.key(),
        &ctx.accounts.mayhem_sol_vault.key(),
        &ctx.accounts.mayhem_state.key(),
        &ctx.accounts.mayhem_token_vault.key(),
        &ctx.accounts.pump_event_authority.key(),
        &ctx.accounts.system_program.key(),
        &ctx.accounts.token_program.key(),
        &ctx.accounts.associated_token_program.key(),
        name,
        symbol,
        uri,
        ctx.accounts.user.key(),
        is_mayhem_mode,
    );

    invoke(
        &create_ix,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.pump_mint_authority.to_account_info(),
            ctx.accounts.pump_bonding_curve.to_account_info(),
            ctx.accounts.pump_associated_bonding_curve.to_account_info(),
            ctx.accounts.pump_global.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.associated_token_program.to_account_info(),
            ctx.accounts.mayhem_program.to_account_info(),
            ctx.accounts.mayhem_global_params.to_account_info(),
            ctx.accounts.mayhem_sol_vault.to_account_info(),
            ctx.accounts.mayhem_state.to_account_info(),
            ctx.accounts.mayhem_token_vault.to_account_info(),
            ctx.accounts.pump_event_authority.to_account_info(),
            ctx.accounts.pump_program.to_account_info(),
        ],
    )?;

    // ========================================================
    // STEP 3: Initialize vault_state PDA manually
    // ========================================================
    let mint_key = ctx.accounts.mint.key();
    let user_key = ctx.accounts.user.key();
    let program_id = ctx.program_id;

    let (vault_pda, vault_bump) = Pubkey::find_program_address(
        &[b"vault", user_key.as_ref(), mint_key.as_ref()],
        program_id,
    );
    require!(
        ctx.accounts.vault_state.key() == vault_pda,
        LaunchVaultError::InvalidVaultStatus
    );

    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        mint_key.as_ref(),
        &[vault_bump],
    ];

    let vault_space = 8 + LaunchVaultState::INIT_SPACE;
    let vault_rent = ctx.accounts.rent.minimum_balance(vault_space);

    invoke_signed(
        &system_instruction::create_account(
            &user_key,
            &vault_pda,
            vault_rent,
            vault_space as u64,
            program_id,
        ),
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    // ========================================================
    // STEP 4: Create vault ATA
    // ========================================================
    let vault_ata_info = &ctx.remaining_accounts[0];

    invoke(
        &build_create_ata_instruction(
            &user_key,
            &vault_pda,
            &mint_key,
            &ctx.accounts.token_program.key(),
            &ctx.accounts.associated_token_program.key(),
        ),
        &[
            ctx.accounts.user.to_account_info(),
            vault_ata_info.clone(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.associated_token_program.to_account_info(),
        ],
    )?;

    // ========================================================
    // STEP 5: Reserve LP allocation (total_liquidity unchanged —
    // the pool's exposure is tracked via reserved_liquidity)
    // ========================================================
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_add(lp_allocation)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // ========================================================
    // STEP 6: Loop — fund buyer PDAs + CPI buy + transfer tokens to vault
    // ========================================================
    let mut total_tokens_bought: u64 = 0;
    let mut total_sol_spent: u64 = 0;

    for i in 0..num_buyers {
        let buyer_pda_info = &ctx.remaining_accounts[1 + i * 3];
        let buyer_ata_info = &ctx.remaining_accounts[1 + i * 3 + 1];
        let buyer_vol_info = &ctx.remaining_accounts[1 + i * 3 + 2];

        let buyer_index = i as u8;

        let (expected_buyer_pda, buyer_bump) = Pubkey::find_program_address(
            &[pump_fun::BUYER_SEED, vault_pda.as_ref(), &[buyer_index]],
            program_id,
        );
        require!(
            buyer_pda_info.key() == expected_buyer_pda,
            LaunchVaultError::InvalidBuyerPda
        );

        let buyer_seeds: &[&[u8]] = &[
            pump_fun::BUYER_SEED,
            vault_pda.as_ref(),
            &[buyer_index],
            &[buyer_bump],
        ];

        let sol_for_this_buyer = max_sol_costs[i];

        // Fund buyer PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: buyer_pda_info.clone(),
                },
            ),
            sol_for_this_buyer,
        )?;

        // Create buyer ATA
        invoke(
            &build_create_ata_instruction(
                &user_key,
                &expected_buyer_pda,
                &mint_key,
                &ctx.accounts.token_program.key(),
                &ctx.accounts.associated_token_program.key(),
            ),
            &[
                ctx.accounts.user.to_account_info(),
                buyer_ata_info.clone(),
                buyer_pda_info.clone(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.associated_token_program.to_account_info(),
            ],
        )?;

        // CPI buy on Pump.fun
        let buyer_user_vol_acc = pump_fun::derive_user_volume_accumulator(&expected_buyer_pda);

        let buy_ix = pump_fun::build_buy_instruction(
            &ctx.accounts.pump_global.key(),
            &ctx.accounts.pump_fee_recipient.key(),
            &mint_key,
            &ctx.accounts.pump_bonding_curve.key(),
            &ctx.accounts.pump_associated_bonding_curve.key(),
            &buyer_ata_info.key(),
            &expected_buyer_pda,
            &ctx.accounts.system_program.key(),
            &ctx.accounts.token_program.key(),
            &ctx.accounts.pump_creator_vault.key(),
            &ctx.accounts.pump_event_authority.key(),
            &ctx.accounts.pump_global_volume_accumulator.key(),
            &buyer_user_vol_acc,
            &ctx.accounts.pump_fee_config.key(),
            &ctx.accounts.pump_bonding_curve_v2.key(),
            buy_amounts[i],
            sol_for_this_buyer,
        );

        invoke_signed(
            &buy_ix,
            &[
                ctx.accounts.pump_global.to_account_info(),
                ctx.accounts.pump_fee_recipient.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.pump_bonding_curve.to_account_info(),
                ctx.accounts.pump_associated_bonding_curve.to_account_info(),
                buyer_ata_info.clone(),
                buyer_pda_info.clone(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pump_creator_vault.to_account_info(),
                ctx.accounts.pump_event_authority.to_account_info(),
                ctx.accounts.pump_program.to_account_info(),
                ctx.accounts
                    .pump_global_volume_accumulator
                    .to_account_info(),
                buyer_vol_info.clone(),
                ctx.accounts.pump_fee_config.to_account_info(),
                ctx.accounts.pump_fee_program.to_account_info(),
                ctx.accounts.pump_bonding_curve_v2.to_account_info(),
            ],
            &[buyer_seeds],
        )?;

        // Read actual tokens received
        let actual_tokens = crate::cpi::token_utils::read_token_account_amount(buyer_ata_info)?;

        // Transfer tokens: buyer ATA → vault ATA
        let transfer_ix = build_transfer_checked_instruction(
            &ctx.accounts.token_program.key(),
            &buyer_ata_info.key(),
            &mint_key,
            &vault_ata_info.key(),
            &expected_buyer_pda,
            actual_tokens,
            6,
        );

        invoke_signed(
            &transfer_ix,
            &[
                buyer_ata_info.clone(),
                ctx.accounts.mint.to_account_info(),
                vault_ata_info.clone(),
                buyer_pda_info.clone(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[buyer_seeds],
        )?;

        total_tokens_bought = total_tokens_bought
            .checked_add(actual_tokens)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;

        // Close buyer ATA, return rent to user
        let close_ix = build_close_account_instruction(
            &ctx.accounts.token_program.key(),
            &buyer_ata_info.key(),
            &user_key,
            &expected_buyer_pda,
        );
        invoke_signed(
            &close_ix,
            &[
                buyer_ata_info.clone(),
                ctx.accounts.user.to_account_info(),
                buyer_pda_info.clone(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[buyer_seeds],
        )?;

        // Return unused SOL from buyer PDA to user
        let buyer_lamports = buyer_pda_info.lamports();
        if buyer_lamports > 0 {
            let spent = sol_for_this_buyer.saturating_sub(buyer_lamports);
            total_sol_spent = total_sol_spent
                .checked_add(spent)
                .ok_or(LaunchVaultError::ArithmeticOverflow)?;

            invoke_signed(
                &system_instruction::transfer(&expected_buyer_pda, &user_key, buyer_lamports),
                &[
                    buyer_pda_info.clone(),
                    ctx.accounts.user.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[buyer_seeds],
            )?;
        } else {
            total_sol_spent = total_sol_spent
                .checked_add(sol_for_this_buyer)
                .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        }
    }

    // Reimburse user for the LP pool's share of buy costs.
    // User fronted all SOL; pool repays min(total_sol_spent, lp_allocation).
    let pool_share = total_sol_spent.min(lp_allocation);
    if pool_share > 0 {
        **ctx
            .accounts
            .lp_pool
            .to_account_info()
            .try_borrow_mut_lamports()? -= pool_share;
        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += pool_share;
    }

    // Adjust reservation to actual deployment: if buys cost less than
    // lp_allocation (favorable slippage), unreserve the unused portion.
    let actual_lp_deployed = pool_share;
    let unused_allocation = lp_allocation.saturating_sub(actual_lp_deployed);
    if unused_allocation > 0 {
        let lp_pool = &mut ctx.accounts.lp_pool;
        lp_pool.reserved_liquidity = lp_pool
            .reserved_liquidity
            .checked_sub(unused_allocation)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        lp_pool.available_liquidity = lp_pool
            .total_liquidity
            .checked_sub(lp_pool.reserved_liquidity)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    }

    // ========================================================
    // STEP 7: Write vault state
    // ========================================================
    let entry_price = if total_tokens_bought > 0 {
        (total_sol_spent as u128)
            .checked_mul(1_000_000)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?
            .checked_div(total_tokens_bought as u128)
            .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64
    } else {
        0
    };

    let vault_data = LaunchVaultState {
        user: user_key,
        token_mint: mint_key,
        total_token_amount: total_tokens_bought,
        remaining_token_amount: total_tokens_bought,
        total_lp_allocation: actual_lp_deployed,
        remaining_lp_allocation: actual_lp_deployed,
        user_contribution,
        status: VaultStatus::Active,
        open_timestamp: clock.unix_timestamp,
        fee_paid: total_fee,
        num_sub_wallets: num_buyers as u8,
        entry_price,
        stop_loss_bps,
        stop_loss_triggered: false,
        stop_loss_timestamp: 0,
        bump: vault_bump,
    };

    let mut vault_account_data = ctx.accounts.vault_state.try_borrow_mut_data()?;
    let dst = &mut vault_account_data[..];
    let discriminator = LaunchVaultState::DISCRIMINATOR;
    dst[..8].copy_from_slice(&discriminator);
    vault_data.serialize(&mut &mut dst[8..])?;

    emit!(PositionOpenedEvent {
        vault: vault_pda,
        user: user_key,
        token_mint: mint_key,
        num_buyers: num_buyers as u8,
        total_tokens: total_tokens_bought,
        total_sol_spent,
        lp_allocation,
        user_contribution,
        fee_paid: total_fee,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
