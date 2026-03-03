use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VaultStatus {
    ReadyForExecution,
    Active,
    Closed,
    Defaulted,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RentalStatus {
    Active,
    Overdue,
}

#[account]
#[derive(InitSpace)]
pub struct LaunchVaultState {
    pub user: Pubkey,
    pub token_mint: Pubkey,
    /// Всего куплено токенов (устанавливается при execute_bundle_buy)
    pub total_token_amount: u64,
    /// Осталось токенов в vault
    pub remaining_token_amount: u64,
    /// Общая LP ликвидность задействована (lamports)
    pub total_lp_allocation: u64,
    /// LP ликвидность к возврату (lamports)
    pub remaining_lp_allocation: u64,
    /// Вклад создателя (lamports)
    pub user_contribution: u64,
    pub status: VaultStatus,
    /// Unix timestamp начала аренды
    pub rental_start_timestamp: i64,
    /// Дедлайн текущего периода аренды
    pub rental_due_timestamp: i64,
    pub rental_status: RentalStatus,
    pub bump: u8,
}
