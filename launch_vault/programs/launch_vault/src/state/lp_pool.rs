use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LpPool {
    /// Total SOL in pool (lamports) — includes both available and reserved
    pub total_liquidity: u64,
    /// SOL reserved for active positions (lamports)
    pub reserved_liquidity: u64,
    /// SOL available for new positions and LP withdrawals (lamports)
    pub available_liquidity: u64,
    /// LP token mint address (mimi-LP)
    pub lp_mint: Pubkey,
    /// Cached LP token supply (mirrors on-chain mint supply)
    pub lp_mint_supply: u64,
    /// Total number of defaults (for circuit breaker / analytics)
    pub total_defaults: u32,
    /// Total positions closed (for default rate calculation)
    pub total_positions_closed: u32,
    pub authority: Pubkey,
    pub bump: u8,
}
