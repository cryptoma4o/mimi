use anchor_lang::prelude::*;

declare_id!("oNm4QmXFFUXYSYvDkMxW7azSihrViER4Qr1pAUnPvYg");

pub mod cpi;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod launch_vault {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        executor: Pubkey,
        treasury: Pubkey,
        fixed_fee: u64,
        fee_bps: u16,
        max_utilization_bps: u16,
        position_timeout: i64,
        close_reward_bps: u16,
        insurance_split_bps: u16,
        redemption_fee_bps: u16,
        min_user_contribution: u64,
        max_lp_per_position: u64,
        min_user_ratio_bps: u16,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(
            ctx,
            executor,
            treasury,
            fixed_fee,
            fee_bps,
            max_utilization_bps,
            position_timeout,
            close_reward_bps,
            insurance_split_bps,
            redemption_fee_bps,
            min_user_contribution,
            max_lp_per_position,
            min_user_ratio_bps,
        )
    }

    pub fn update_protocol_config(
        ctx: Context<UpdateProtocolConfig>,
        new_executor: Option<Pubkey>,
        new_treasury: Option<Pubkey>,
        new_fixed_fee: Option<u64>,
        new_fee_bps: Option<u16>,
        new_max_utilization_bps: Option<u16>,
        new_position_timeout: Option<i64>,
        new_close_reward_bps: Option<u16>,
        new_insurance_split_bps: Option<u16>,
        new_redemption_fee_bps: Option<u16>,
        new_admin: Option<Pubkey>,
        new_cb_position_limit: Option<u32>,
        new_cb_window_seconds: Option<i64>,
        new_cb_cooldown_seconds: Option<i64>,
        new_min_insurance_fund: Option<u64>,
    ) -> Result<()> {
        instructions::update_protocol_config::handler(
            ctx,
            new_executor,
            new_treasury,
            new_fixed_fee,
            new_fee_bps,
            new_max_utilization_bps,
            new_position_timeout,
            new_close_reward_bps,
            new_insurance_split_bps,
            new_redemption_fee_bps,
            new_admin,
            new_cb_position_limit,
            new_cb_window_seconds,
            new_cb_cooldown_seconds,
            new_min_insurance_fund,
        )
    }

    /// One-time migration: realloc ProtocolConfig and remap data layout
    pub fn migrate_protocol(
        ctx: Context<MigrateProtocol>,
        min_user_contribution: u64,
        max_lp_per_position: u64,
        min_user_ratio_bps: u16,
    ) -> Result<()> {
        instructions::migrate_protocol::handler(ctx, min_user_contribution, max_lp_per_position, min_user_ratio_bps)
    }

    pub fn deposit_lp(ctx: Context<DepositLp>, amount: u64) -> Result<()> {
        instructions::deposit_lp::handler(ctx, amount)
    }

    pub fn withdraw_lp(ctx: Context<WithdrawLp>, lp_amount: u64) -> Result<()> {
        instructions::withdraw_lp::handler(ctx, lp_amount)
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

    pub fn open_position<'info>(
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
        instructions::open_position::handler(
            ctx,
            name,
            symbol,
            uri,
            is_mayhem_mode,
            lp_allocation,
            user_contribution,
            buy_amounts,
            max_sol_costs,
            stop_loss_bps,
        )
    }

    pub fn sell_position(
        ctx: Context<SellPosition>,
        amount: u64,
        min_sol_output: u64,
    ) -> Result<()> {
        instructions::sell_position::handler(ctx, amount, min_sol_output)
    }

    pub fn redeem_tokens(ctx: Context<RedeemTokens>, amount: u64) -> Result<()> {
        instructions::redeem_tokens::handler(ctx, amount)
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
    }

    pub fn force_close_position(ctx: Context<ForceClosePosition>) -> Result<()> {
        instructions::force_close_position::handler(ctx)
    }

    pub fn trigger_stop_loss(
        ctx: Context<TriggerStopLoss>,
        amount: u64,
        min_sol_output: u64,
    ) -> Result<()> {
        instructions::trigger_stop_loss::handler(ctx, amount, min_sol_output)
    }

    pub fn deposit_insurance_fund(ctx: Context<DepositInsuranceFund>, amount: u64) -> Result<()> {
        instructions::deposit_insurance_fund::handler(ctx, amount)
    }

    pub fn withdraw_insurance_fund(ctx: Context<WithdrawInsuranceFund>, amount: u64) -> Result<()> {
        instructions::withdraw_insurance_fund::handler(ctx, amount)
    }

    pub fn pause_protocol(ctx: Context<PauseProtocol>, reason: String) -> Result<()> {
        instructions::pause_protocol::handler(ctx, reason)
    }

    pub fn resume_protocol(ctx: Context<ResumeProtocol>) -> Result<()> {
        instructions::resume_protocol::handler(ctx)
    }
}
