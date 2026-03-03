use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LpPool {
    /// Общая ликвидность в пуле (lamports)
    pub total_liquidity: u64,
    /// Зарезервированная ликвидность (под активные vault'ы)
    pub reserved_liquidity: u64,
    /// Доступная ликвидность (total - reserved)
    pub available_liquidity: u64,
    pub authority: Pubkey,
    pub bump: u8,
}
