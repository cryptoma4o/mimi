use anchor_lang::prelude::*;

declare_id!("3oLxq3dPYLBsiyvGQmLyW1jg6QbgKhHpr4cddRxLaRNF");

pub mod cpi;
pub mod events;
pub mod instructions;

use instructions::*;

#[program]
pub mod pumpfun_proxy {
    use super::*;

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
        is_mayhem_mode: bool,
    ) -> Result<()> {
        instructions::create_token::handler(ctx, name, symbol, uri, is_mayhem_mode)
    }
}
