use anchor_lang::prelude::*;

#[event]
pub struct TokenCreatedEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub is_mayhem_mode: bool,
    pub timestamp: i64,
}
