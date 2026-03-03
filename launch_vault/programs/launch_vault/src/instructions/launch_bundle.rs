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
use crate::events::LaunchBundleEvent;
use crate::state::*;

/// Maximum number of buyers in a single bundle
const MAX_BUYERS: usize = pump_fun::MAX_BUYERS;

#[derive(Accounts)]
pub struct LaunchBundle<'info> {
    // === Signers ===
    /// Token creator, pays fees + user_contribution
    #[account(mut)]
    pub user: Signer<'info>,

    /// Fresh keypair for new token mint
    #[account(mut)]
    pub mint: Signer<'info>,

    /// Authorized executor
    #[account(
        constraint = executor.key() == protocol_config.executor @ LaunchVaultError::UnauthorizedExecutor,
    )]
    pub executor: Signer<'info>,

    // === Protocol state ===
    /// CHECK: vault_state PDA — initialized manually in handler (mint doesn't exist at deserialization time)
    #[account(mut)]
    pub vault_state: UncheckedAccount<'info>,

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

    /// CHECK: Treasury verified via protocol_config
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ LaunchVaultError::InvalidTreasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    // === Pump.fun accounts (shared for create + buy) ===
    /// CHECK: Pump.fun program ID verified in constraint
    #[account(
        constraint = pump_program.key() == pump_fun::PUMP_FUN_PROGRAM_ID
    )]
    pub pump_program: UncheckedAccount<'info>,

    /// CHECK: Pump global state PDA ["global"]
    #[account(mut)]
    pub pump_global: UncheckedAccount<'info>,

    /// CHECK: Mint authority PDA ["mint-authority"]
    pub pump_mint_authority: UncheckedAccount<'info>,

    /// CHECK: Bonding curve PDA ["bonding-curve", mint]
    #[account(mut)]
    pub pump_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Associated bonding curve token account
    #[account(mut)]
    pub pump_associated_bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Event authority PDA ["__event_authority"]
    pub pump_event_authority: UncheckedAccount<'info>,

    /// CHECK: Pump.fun fee recipient
    #[account(mut)]
    pub pump_fee_recipient: UncheckedAccount<'info>,

    // === Mayhem accounts (for create_v2) ===
    /// CHECK: Mayhem program
    #[account(
        mut,
        constraint = mayhem_program.key() == pump_fun::MAYHEM_PROGRAM_ID
    )]
    pub mayhem_program: UncheckedAccount<'info>,

    /// CHECK: Mayhem global params PDA
    pub mayhem_global_params: UncheckedAccount<'info>,

    /// CHECK: Mayhem SOL vault PDA
    #[account(mut)]
    pub mayhem_sol_vault: UncheckedAccount<'info>,

    /// CHECK: Mayhem state PDA ["mayhem-state", mint]
    #[account(mut)]
    pub mayhem_state: UncheckedAccount<'info>,

    /// CHECK: Mayhem token vault
    #[account(mut)]
    pub mayhem_token_vault: UncheckedAccount<'info>,

    // === System ===
    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub rent: Sysvar<'info, Rent>,

    // === remaining_accounts ===
    // [vault_token_account, buyer_0_pda, buyer_0_ata, buyer_1_pda, buyer_1_ata, ...]
    // Count: 1 + num_buyers * 2
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, LaunchBundle<'info>>,
    // Token creation params
    name: String,
    symbol: String,
    uri: String,
    is_mayhem_mode: bool,
    // Vault params
    lp_allocation: u64,
    user_contribution: u64,
    // Buy params (per buyer)
    buy_amounts: Vec<u64>,
    max_sol_costs: Vec<u64>,
) -> Result<()> {
    // === Validation ===
    let num_buyers = buy_amounts.len();
    require!(num_buyers > 0, LaunchVaultError::NoBuyers);
    require!(num_buyers <= MAX_BUYERS, LaunchVaultError::MaxBuyersExceeded);
    require!(
        buy_amounts.len() == max_sol_costs.len(),
        LaunchVaultError::BuyParamsMismatch
    );
    require!(lp_allocation > 0, LaunchVaultError::ZeroLpAllocation);
    require!(user_contribution > 0, LaunchVaultError::ZeroUserContribution);
    require!(
        lp_allocation <= ctx.accounts.lp_pool.available_liquidity,
        LaunchVaultError::InsufficientLpLiquidity
    );

    // remaining_accounts: [vault_ata, buyer0_pda, buyer0_ata, buyer1_pda, buyer1_ata, ...]
    let expected_remaining = 1 + num_buyers * 2;
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

    require!(total_max_sol <= buy_budget, LaunchVaultError::BudgetExceeded);

    // ========================================================
    // STEP 1: CPI create_v2 — create token on Pump.fun
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
    // STEP 2: Initialize vault_state PDA manually
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
        LaunchVaultError::InvalidVaultStatus // reuse error for PDA mismatch
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
    // STEP 3: Create vault ATA via CPI
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
    // STEP 4: Pay fees + reserve LP
    // ========================================================
    let config = &ctx.accounts.protocol_config;
    let fees_to_treasury = config
        .infrastructure_fee
        .checked_add(config.rental_fee_rate)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // Fees → treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        fees_to_treasury,
    )?;

    // user_contribution → lp_pool
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.lp_pool.to_account_info(),
            },
        ),
        user_contribution,
    )?;

    // Track user_contribution in total_liquidity + reserve full buy_budget
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_add(user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_add(buy_budget)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // ========================================================
    // STEP 5: Loop — fund buyer PDAs + CPI buy + transfer tokens to vault
    // ========================================================
    let lp_pool_bump = ctx.accounts.lp_pool.bump;
    let lp_pool_seeds: &[&[u8]] = &[b"lp_pool", &[lp_pool_bump]];

    let mut total_tokens_bought: u64 = 0;
    let mut total_sol_spent: u64 = 0;

    // Distribute buy_budget proportionally based on max_sol_costs
    for i in 0..num_buyers {
        let buyer_pda_info = &ctx.remaining_accounts[1 + i * 2];
        let buyer_ata_info = &ctx.remaining_accounts[1 + i * 2 + 1];

        let buyer_index = i as u8;

        // Verify buyer PDA
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

        // a) Transfer SOL: lp_pool → buyer PDA
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.lp_pool.to_account_info(),
                    to: buyer_pda_info.clone(),
                },
                &[lp_pool_seeds],
            ),
            sol_for_this_buyer,
        )?;

        // b) Create buyer ATA via CPI
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

        // c) CPI buy on Pump.fun (buyer PDA as signer)
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
            &ctx.accounts.rent.key(),
            &ctx.accounts.pump_event_authority.key(),
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
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.pump_event_authority.to_account_info(),
                ctx.accounts.pump_program.to_account_info(),
            ],
            &[buyer_seeds],
        )?;

        // d) Read actual tokens received from Pump.fun buy
        let ata_data = buyer_ata_info.try_borrow_data()?;
        let actual_tokens = u64::from_le_bytes(ata_data[64..72].try_into().unwrap());
        drop(ata_data);

        // e) Transfer tokens: buyer ATA → vault ATA (Token2022 transfer_checked)
        let transfer_ix = build_transfer_checked_instruction(
            &ctx.accounts.token_program.key(),
            &buyer_ata_info.key(),
            &mint_key,
            &vault_ata_info.key(),
            &expected_buyer_pda,
            actual_tokens,
            6, // Pump.fun tokens typically have 6 decimals
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

        // f) Close buyer ATA, return rent to user
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

        // g) Return unused SOL from buyer PDA to lp_pool
        let buyer_lamports = buyer_pda_info.lamports();
        if buyer_lamports > 0 {
            let spent = sol_for_this_buyer.saturating_sub(buyer_lamports);
            total_sol_spent = total_sol_spent
                .checked_add(spent)
                .ok_or(LaunchVaultError::ArithmeticOverflow)?;

            // Return all remaining lamports
            **buyer_pda_info.try_borrow_mut_lamports()? -= buyer_lamports;
            **ctx.accounts.lp_pool.to_account_info().try_borrow_mut_lamports()? += buyer_lamports;
        } else {
            total_sol_spent = total_sol_spent
                .checked_add(sol_for_this_buyer)
                .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        }
    }

    // ========================================================
    // STEP 6: Write vault state manually
    // ========================================================
    let clock = Clock::get()?;
    let rental_due = clock
        .unix_timestamp
        .checked_add(config.rental_period)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    let vault_data = LaunchVaultState {
        user: user_key,
        token_mint: mint_key,
        total_token_amount: total_tokens_bought,
        remaining_token_amount: total_tokens_bought,
        total_lp_allocation: lp_allocation,
        remaining_lp_allocation: lp_allocation,
        user_contribution,
        status: VaultStatus::Active,
        rental_start_timestamp: clock.unix_timestamp,
        rental_due_timestamp: rental_due,
        rental_status: RentalStatus::Active,
        bump: vault_bump,
    };

    // Write discriminator + data to vault account
    let mut vault_account_data = ctx.accounts.vault_state.try_borrow_mut_data()?;
    let dst = &mut vault_account_data[..];
    // Anchor discriminator for LaunchVaultState
    let discriminator = LaunchVaultState::DISCRIMINATOR;
    dst[..8].copy_from_slice(&discriminator);
    vault_data.serialize(&mut &mut dst[8..])?;

    // ========================================================
    // STEP 7: Update LP pool accounting
    // ========================================================
    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_liquidity = lp_pool
        .total_liquidity
        .checked_sub(total_sol_spent)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    // Release user_contribution from reserved; lp_allocation stays reserved
    lp_pool.reserved_liquidity = lp_pool
        .reserved_liquidity
        .checked_sub(user_contribution)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;
    lp_pool.available_liquidity = lp_pool
        .total_liquidity
        .checked_sub(lp_pool.reserved_liquidity)
        .ok_or(LaunchVaultError::ArithmeticOverflow)?;

    // ========================================================
    // STEP 8: Emit event
    // ========================================================
    emit!(LaunchBundleEvent {
        vault: vault_pda,
        user: user_key,
        token_mint: mint_key,
        num_buyers: num_buyers as u8,
        total_tokens: total_tokens_bought,
        total_sol_spent,
        lp_allocation,
        user_contribution,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

