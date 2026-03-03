use anchor_lang::prelude::*;

#[event]
pub struct ProtocolInitializedEvent {
    pub admin: Pubkey,
    pub executor: Pubkey,
    pub treasury: Pubkey,
    pub rental_period: i64,
    pub rental_fee_rate: u64,
    pub infrastructure_fee: u64,
    pub redemption_fee_bps: u16,
    pub grace_period: i64,
    pub timestamp: i64,
}

#[event]
pub struct VaultCreatedEvent {
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub lp_allocation: u64,
    pub user_contribution: u64,
    pub rental_due_timestamp: i64,
    pub timestamp: i64,
}

#[event]
pub struct TokenBoughtEvent {
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub token_mint: Pubkey,
    pub token_amount: u64,
    pub sol_spent: u64,
    pub timestamp: i64,
}

#[event]
pub struct RentalPaidEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub rental_fee: u64,
    pub new_rental_due_timestamp: i64,
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
pub struct VaultDefaultedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub remaining_tokens: u64,
    pub remaining_lp: u64,
    pub cranker: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultLiquidatedEvent {
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub token_mint: Pubkey,
    pub tokens_liquidated: u64,
    pub lp_lost: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultClosedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolConfigUpdatedEvent {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct LpDepositedEvent {
    pub authority: Pubkey,
    pub amount: u64,
    pub new_total_liquidity: u64,
    pub new_available_liquidity: u64,
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
pub struct LaunchBundleEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub num_buyers: u8,
    pub total_tokens: u64,
    pub total_sol_spent: u64,
    pub lp_allocation: u64,
    pub user_contribution: u64,
    pub timestamp: i64,
}

#[event]
pub struct LpWithdrawnEvent {
    pub authority: Pubkey,
    pub amount: u64,
    pub new_total_liquidity: u64,
    pub new_available_liquidity: u64,
    pub timestamp: i64,
}
