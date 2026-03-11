use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VaultStatus {
    Active,
    Closed,
    TimedOut,
}

#[account]
#[derive(InitSpace)]
pub struct LaunchVaultState {
    pub user: Pubkey,
    pub token_mint: Pubkey,
    /// Total tokens bought at position open
    pub total_token_amount: u64,
    /// Remaining tokens in vault
    pub remaining_token_amount: u64,
    /// Total LP allocation from pool (lamports)
    pub total_lp_allocation: u64,
    /// Remaining LP to return (lamports)
    pub remaining_lp_allocation: u64,
    /// User's own SOL contribution (lamports)
    pub user_contribution: u64,
    pub status: VaultStatus,
    /// Unix timestamp when position was opened
    pub open_timestamp: i64,
    /// Total upfront fee paid (lamports)
    pub fee_paid: u64,
    /// Number of PDA sub-wallets used for buying
    pub num_sub_wallets: u8,
    pub bump: u8,
}
