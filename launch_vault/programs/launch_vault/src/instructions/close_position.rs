use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::cpi::token_utils::{build_close_account_instruction, TOKEN_2022_PROGRAM_ID};
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::PositionClosedEvent;

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    /// Closer: vault owner (anytime when Closed) or anyone (after timeout)
    #[account(mut)]
    pub closer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.user.as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, LaunchVaultState>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"lp_pool"],
        bump = lp_pool.bump,
    )]
    pub lp_pool: Account<'info, LpPool>,

    /// CHECK: Original vault owner — receives rent refund
    #[account(
        mut,
        constraint = vault_owner.key() == vault_state.user @ LaunchVaultError::UnauthorizedUser,
    )]
    pub vault_owner: UncheckedAccount<'info>,

    /// CHECK: Vault token account
    #[account(
        mut,
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &vault_state.key(),
            &vault_state.token_mint,
            &TOKEN_2022_PROGRAM_ID,
        ) @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Token2022 program — must be Token2022 for consistency with ATA derivation
    #[account(
        constraint = token_program.key() == TOKEN_2022_PROGRAM_ID @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    let vault = &ctx.accounts.vault_state;
    let is_owner = ctx.accounts.closer.key() == vault.user;
    let clock = Clock::get()?;

    if is_owner {
        // Owner can close when status is Closed or TimedOut
        require!(
            vault.status == VaultStatus::Closed || vault.status == VaultStatus::TimedOut,
            LaunchVaultError::InvalidVaultStatus
        );
    } else {
        // Permissionless close: only after timeout
        let timeout_at = vault
            .open_timestamp
            .checked_add(ctx.accounts.protocol_config.position_timeout)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        require!(
            clock.unix_timestamp > timeout_at,
            LaunchVaultError::PositionNotTimedOut
        );
    }

    // Verify token account is empty (tokens should have been sold first)
    let token_amount = crate::cpi::token_utils::read_token_account_amount(
        &ctx.accounts.vault_token_account.to_account_info(),
    )?;
    require!(
        token_amount == 0,
        LaunchVaultError::VaultTokenAccountNotEmpty
    );

    // Calculate close reward for permissionless closer
    let close_reward = if !is_owner {
        // Reward = close_reward_bps of any remaining LP allocation
        let remaining_lp = vault.remaining_lp_allocation;
        (remaining_lp as u128)
            .checked_mul(ctx.accounts.protocol_config.close_reward_bps as u128)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?
            .checked_div(10_000)
            .ok_or(LaunchVaultError::ArithmeticOverflow)? as u64
    } else {
        0
    };

    // Update LP pool: release any remaining reserved liquidity
    let remaining_lp = vault.remaining_lp_allocation;
    if remaining_lp > 0 {
        let lp_pool = &mut ctx.accounts.lp_pool;
        lp_pool.reserved_liquidity = lp_pool
            .reserved_liquidity
            .checked_sub(remaining_lp)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        // LP is lost (tokens were sold at loss or not sold)
        lp_pool.total_liquidity = lp_pool
            .total_liquidity
            .checked_sub(remaining_lp)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        lp_pool.available_liquidity = lp_pool
            .total_liquidity
            .checked_sub(lp_pool.reserved_liquidity)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        lp_pool.total_defaults = lp_pool.total_defaults.saturating_add(1);
    }

    let lp_pool = &mut ctx.accounts.lp_pool;
    lp_pool.total_positions_closed = lp_pool.total_positions_closed.saturating_add(1);

    // Pay close reward to closer (deducted from pool's total liquidity)
    if close_reward > 0 {
        let lp_pool = &mut ctx.accounts.lp_pool;
        lp_pool.total_liquidity = lp_pool
            .total_liquidity
            .checked_sub(close_reward)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;
        lp_pool.available_liquidity = lp_pool
            .total_liquidity
            .checked_sub(lp_pool.reserved_liquidity)
            .ok_or(LaunchVaultError::ArithmeticOverflow)?;

        let pool_info = ctx.accounts.lp_pool.to_account_info();
        let closer_info = ctx.accounts.closer.to_account_info();
        **pool_info.try_borrow_mut_lamports()? -= close_reward;
        **closer_info.try_borrow_mut_lamports()? += close_reward;
    }

    // Close vault token account, return rent to vault owner
    let user_key = ctx.accounts.vault_state.user;
    let mint_key = ctx.accounts.vault_state.token_mint;
    let bump = ctx.accounts.vault_state.bump;
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];

    let close_ix = build_close_account_instruction(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.vault_token_account.key(),
        &ctx.accounts.vault_owner.key(),
        &ctx.accounts.vault_state.key(),
    );

    invoke_signed(
        &close_ix,
        &[
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.vault_owner.to_account_info(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    // Mark as timed out if permissionless close
    if !is_owner {
        let vault = &mut ctx.accounts.vault_state;
        vault.status = VaultStatus::TimedOut;
    }

    emit!(PositionClosedEvent {
        vault: ctx.accounts.vault_state.key(),
        closer: ctx.accounts.closer.key(),
        is_permissionless: !is_owner,
        close_reward,
        timestamp: clock.unix_timestamp,
    });

    // Close vault_state account, return rent to vault owner
    let vault_info = ctx.accounts.vault_state.to_account_info();
    let owner_info = ctx.accounts.vault_owner.to_account_info();
    let vault_lamports = vault_info.lamports();
    **vault_info.try_borrow_mut_lamports()? = 0;
    **owner_info.try_borrow_mut_lamports()? += vault_lamports;
    vault_info.assign(&anchor_lang::solana_program::system_program::ID);
    vault_info.resize(0)?;

    Ok(())
}
