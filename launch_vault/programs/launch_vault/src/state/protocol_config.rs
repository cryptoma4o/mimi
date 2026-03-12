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
    pub status: ProtocolStatus,
    pub bump: u8,
}
