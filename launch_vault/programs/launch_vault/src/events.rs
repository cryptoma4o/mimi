use anchor_lang::prelude::*;

#[event]
pub struct ProtocolInitializedEvent {
    pub admin: Pubkey,
    pub executor: Pubkey,
    pub treasury: Pubkey,
    pub fixed_fee: u64,
    pub fee_bps: u16,
    pub max_utilization_bps: u16,
    pub position_timeout: i64,
    pub redemption_fee_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct PositionOpenedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub num_buyers: u8,
    pub total_tokens: u64,
    pub total_sol_spent: u64,
    pub lp_allocation: u64,
    pub user_contribution: u64,
    pub fee_paid: u64,
    pub timestamp: i64,
}

#[event]
pub struct PositionSoldEvent {
    pub vault: Pubkey,
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub tokens_sold: u64,
    pub sol_received: u64,
    pub sol_returned_to_pool: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensRedeemedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_amount: u64,
    pub lp_returned: u64,
    pub redemption_fee: u64,
    pub remaining_tokens: u64,
    pub remaining_lp: u64,
    pub vault_closed: bool,
    pub timestamp: i64,
}

#[event]
pub struct PositionClosedEvent {
    pub vault: Pubkey,
    pub closer: Pubkey,
    pub is_permissionless: bool,
    pub close_reward: u64,
    pub timestamp: i64,
}

#[event]
pub struct PositionForceClosedEvent {
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub token_mint: Pubkey,
    pub tokens_sold: u64,
    pub sol_recovered: u64,
    pub lp_loss: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolConfigUpdatedEvent {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct LpDepositedEvent {
    pub depositor: Pubkey,
    pub sol_amount: u64,
    pub lp_tokens_minted: u64,
    pub new_total_liquidity: u64,
    pub lp_token_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct LpWithdrawnEvent {
    pub withdrawer: Pubkey,
    pub lp_tokens_burned: u64,
    pub sol_amount: u64,
    pub new_total_liquidity: u64,
    pub lp_token_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenCreatedEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub is_mayhem_mode: bool,
    pub timestamp: i64,
}

#[event]
pub struct InsuranceFundUpdatedEvent {
    pub new_total: u64,
    pub amount_added: u64,
    pub timestamp: i64,
}
