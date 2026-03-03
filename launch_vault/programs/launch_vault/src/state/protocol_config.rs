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
    /// Период аренды в секундах (напр. 86400 = 24ч)
    pub rental_period: i64,
    /// Стоимость аренды за период (lamports)
    pub rental_fee_rate: u64,
    /// Разовая комиссия за инфраструктуру (lamports)
    pub infrastructure_fee: u64,
    /// Комиссия при выкупе (bps, 10000 = 100%)
    pub redemption_fee_bps: u16,
    /// Grace period до дефолта (секунды)
    pub grace_period: i64,
    pub status: ProtocolStatus,
    pub bump: u8,
}
