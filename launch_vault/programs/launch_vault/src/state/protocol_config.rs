use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProtocolStatus {
    Active,
    Paused,
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub executor: Pubkey,
    pub treasury: Pubkey,
    /// Fixed fee per position open (lamports)
    pub fixed_fee: u64,
    /// Percentage fee on LP capital (basis points, 200 = 2%)
    pub fee_bps: u16,
    /// Max utilization of LP pool (basis points, 8500 = 85%)
    pub max_utilization_bps: u16,
    /// Position timeout in seconds (after which permissionless close is allowed)
    pub position_timeout: i64,
    /// Reward for permissionless closer (basis points of remaining LP allocation)
    pub close_reward_bps: u16,
    /// Percentage of fees routed to insurance fund (basis points, 2000 = 20%)
    pub insurance_split_bps: u16,
    /// Fee on token redemption (basis points, 10000 = 100%)
    pub redemption_fee_bps: u16,
    /// Minimum user contribution per position in lamports
    pub min_user_contribution: u64,
    /// Maximum LP allocation per position in lamports
    pub max_lp_per_position: u64,
    /// Minimum ratio of user_contribution to lp_allocation in basis points (e.g., 2000 = 20%)
    pub min_user_ratio_bps: u16,
    pub status: ProtocolStatus,
    /// Circuit breaker: max positions per window
    pub cb_position_limit: u32,
    /// Circuit breaker: window duration in seconds
    pub cb_window_seconds: i64,
    /// Circuit breaker: cooldown after trigger in seconds
    pub cb_cooldown_seconds: i64,
    /// Circuit breaker: current window start timestamp
    pub cb_window_start: i64,
    /// Circuit breaker: positions opened in current window
    pub cb_positions_in_window: u32,
    /// Circuit breaker: last trigger timestamp
    pub cb_last_trigger: i64,
    /// Minimum insurance fund required (guard for withdrawals)
    pub min_insurance_fund: u64,
    pub bump: u8,
}
