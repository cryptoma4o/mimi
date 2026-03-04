use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::associated_token::AssociatedToken;

use crate::cpi::pump_fun;
use crate::events::TokenCreatedEvent;

#[derive(Accounts)]
pub struct CreateToken<'info> {
    /// Token creator, pays for creation
    #[account(mut)]
    pub user: Signer<'info>,

    /// Fresh keypair for new token mint
    #[account(mut)]
    pub mint: Signer<'info>,

    /// CHECK: Pump.fun program ID verified by constraint
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

    /// CHECK: Mayhem program verified by constraint
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

    /// CHECK: Event authority PDA ["__event_authority"]
    pub pump_event_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token2022 program
    pub token_program: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    uri: String,
    is_mayhem_mode: bool,
) -> Result<()> {
    let ix = pump_fun::build_create_v2_instruction(
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
        name.clone(),
        symbol.clone(),
        uri.clone(),
        ctx.accounts.user.key(),
        is_mayhem_mode,
    );

    let account_infos = vec![
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
    ];

    invoke(&ix, &account_infos)?;

    let clock = Clock::get()?;
    emit!(TokenCreatedEvent {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.user.key(),
        name,
        symbol,
        is_mayhem_mode,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
