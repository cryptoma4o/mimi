use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct InsuranceFund {
    /// Total SOL accumulated in insurance fund (lamports)
    pub total_sol: u64,
    /// Authority who can withdraw (admin/multisig)
    pub authority: Pubkey,
    pub bump: u8,
}
