use anchor_lang::prelude::*;

declare_id!("2hpb3dPckVbTf81WoeYt2BybcUZQCevxi1N5DwjaRsL7");

pub mod state;
pub mod instructions;
pub mod cpi;
pub mod errors;
pub mod events;

use instructions::*;
use state::ProtocolStatus;

#[program]
pub mod launch_vault {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        executor: Pubkey,
        treasury: Pubkey,
        rental_period: i64,
        rental_fee_rate: u64,
        infrastructure_fee: u64,
        redemption_fee_bps: u16,
        grace_period: i64,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(
            ctx,
            executor,
            treasury,
            rental_period,
            rental_fee_rate,
            infrastructure_fee,
            redemption_fee_bps,
            grace_period,
        )
    }

    pub fn deposit_lp(ctx: Context<DepositLp>, amount: u64) -> Result<()> {
        instructions::deposit_lp::handler(ctx, amount)
    }

    pub fn withdraw_lp(ctx: Context<WithdrawLp>, amount: u64) -> Result<()> {
        instructions::withdraw_lp::handler(ctx, amount)
    }

    pub fn create_vault(
        ctx: Context<CreateVault>,
        lp_allocation: u64,
        user_contribution: u64,
    ) -> Result<()> {
        instructions::create_vault::handler(ctx, lp_allocation, user_contribution)
    }

    pub fn proxy_buy_token(
        ctx: Context<ProxyBuyToken>,
        amount: u64,
        max_sol_cost: u64,
    ) -> Result<()> {
        instructions::proxy_buy_token::handler(ctx, amount, max_sol_cost)
    }

    pub fn pay_rental(ctx: Context<PayRental>) -> Result<()> {
        instructions::pay_rental::handler(ctx)
    }

    pub fn redeem_tokens(ctx: Context<RedeemTokens>, amount: u64) -> Result<()> {
        instructions::redeem_tokens::handler(ctx, amount)
    }

    pub fn mark_defaulted(ctx: Context<MarkDefaulted>) -> Result<()> {
        instructions::mark_defaulted::handler(ctx)
    }

    pub fn liquidate_vault(ctx: Context<LiquidateVault>) -> Result<()> {
        instructions::liquidate_vault::handler(ctx)
    }

    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        instructions::close_vault::handler(ctx)
    }

    pub fn update_protocol_config(
        ctx: Context<UpdateProtocolConfig>,
        new_executor: Option<Pubkey>,
        new_treasury: Option<Pubkey>,
        new_rental_period: Option<i64>,
        new_rental_fee_rate: Option<u64>,
        new_infrastructure_fee: Option<u64>,
        new_redemption_fee_bps: Option<u16>,
        new_grace_period: Option<i64>,
        new_admin: Option<Pubkey>,
        new_status: Option<ProtocolStatus>,
    ) -> Result<()> {
        instructions::update_protocol_config::handler(
            ctx,
            new_executor,
            new_treasury,
            new_rental_period,
            new_rental_fee_rate,
            new_infrastructure_fee,
            new_redemption_fee_bps,
            new_grace_period,
            new_admin,
            new_status,
        )
    }

    pub fn proxy_create_token(
        ctx: Context<ProxyCreateToken>,
        name: String,
        symbol: String,
        uri: String,
        is_mayhem_mode: bool,
    ) -> Result<()> {
        instructions::proxy_create_token::handler(ctx, name, symbol, uri, is_mayhem_mode)
    }

    pub fn launch_bundle<'info>(
        ctx: Context<'_, '_, '_, 'info, LaunchBundle<'info>>,
        name: String,
        symbol: String,
        uri: String,
        is_mayhem_mode: bool,
        lp_allocation: u64,
        user_contribution: u64,
        buy_amounts: Vec<u64>,
        max_sol_costs: Vec<u64>,
    ) -> Result<()> {
        instructions::launch_bundle::handler(
            ctx,
            name,
            symbol,
            uri,
            is_mayhem_mode,
            lp_allocation,
            user_contribution,
            buy_amounts,
            max_sol_costs,
        )
    }
}
