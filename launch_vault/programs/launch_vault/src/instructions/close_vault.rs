use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::cpi::token_utils::build_close_account_instruction;
use crate::state::*;
use crate::errors::LaunchVaultError;
use crate::events::VaultClosedEvent;

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref(), vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        has_one = user @ LaunchVaultError::UnauthorizedUser,
        constraint = vault_state.status == VaultStatus::Closed @ LaunchVaultError::InvalidVaultStatus,
        close = user,
    )]
    pub vault_state: Account<'info, LaunchVaultState>,

    /// CHECK: Vault token account — verified via ATA derivation + empty check
    #[account(
        mut,
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &vault_state.key(),
            &vault_state.token_mint,
            &token_program.key(),
        ) @ LaunchVaultError::InvalidVaultTokenAccount,
    )]
    pub vault_token_account: UncheckedAccount<'info>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CloseVault>) -> Result<()> {
    // Verify token account is empty before closing
    let token_amount = crate::cpi::token_utils::read_token_account_amount(
        &ctx.accounts.vault_token_account.to_account_info(),
    )?;
    require!(
        token_amount == 0,
        LaunchVaultError::VaultTokenAccountNotEmpty
    );

    let user_key = ctx.accounts.user.key();
    let mint_key = ctx.accounts.vault_state.token_mint;
    let bump = ctx.accounts.vault_state.bump;
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];

    // Close vault token account, return rent to user (Token2022 compatible)
    let close_ix = build_close_account_instruction(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.vault_token_account.key(),
        &ctx.accounts.user.key(),
        &ctx.accounts.vault_state.key(),
    );

    invoke_signed(
        &close_ix,
        &[
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.vault_state.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    // vault_state is auto-closed by Anchor via `close = user`

    let clock = Clock::get()?;
    emit!(VaultClosedEvent {
        vault: ctx.accounts.vault_state.key(),
        user: ctx.accounts.user.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
