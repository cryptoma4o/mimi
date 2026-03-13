use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;

use crate::errors::LaunchVaultError;
use crate::state::*;

/// One-time migration: realloc ProtocolConfig PDA and remap data layout.
///
/// OLD layout (132 bytes = 8 disc + 124 data):
///   [8: disc][32: admin][32: executor][32: treasury][8: fixed_fee][2: fee_bps]
///   [2: max_util_bps][8: position_timeout][2: close_reward_bps][2: insurance_split_bps]
///   [2: redemption_fee_bps][1: status][1: bump]
///
/// NEW layout (198 bytes = 8 disc + 190 data):
///   ... same up to redemption_fee_bps ...
///   [8: min_user_contribution][8: max_lp_per_position][2: min_user_ratio_bps]
///   [1: status][4: cb_position_limit][8: cb_window_seconds][8: cb_cooldown_seconds]
///   [8: cb_window_start][4: cb_positions_in_window][8: cb_last_trigger]
///   [8: min_insurance_fund][1: bump]
#[derive(Accounts)]
pub struct MigrateProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: We manually verify seeds and owner, then realloc.
    #[account(mut)]
    pub protocol_config: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<MigrateProtocol>,
    min_user_contribution: u64,
    max_lp_per_position: u64,
    min_user_ratio_bps: u16,
) -> Result<()> {
    let config_info = &ctx.accounts.protocol_config;
    let program_id = ctx.program_id;

    // Verify PDA seeds
    let (expected_pda, bump) =
        Pubkey::find_program_address(&[b"protocol_config"], program_id);
    require!(
        config_info.key() == expected_pda,
        LaunchVaultError::InvalidVaultStatus
    );
    require!(
        config_info.owner == program_id,
        LaunchVaultError::UnauthorizedAdmin
    );

    // Read admin from existing data (discriminator 8 bytes + admin pubkey at offset 8)
    let data = config_info.try_borrow_data()?;
    require!(data.len() >= 40, LaunchVaultError::InvalidVaultStatus);
    let stored_admin = Pubkey::try_from(&data[8..40])
        .map_err(|_| LaunchVaultError::InvalidVaultStatus)?;
    require!(
        ctx.accounts.admin.key() == stored_admin,
        LaunchVaultError::UnauthorizedAdmin
    );

    let current_len = data.len();
    let target_len = 8 + ProtocolConfig::INIT_SPACE;

    // Read old status and bump from old layout (offsets 130, 131)
    // Old layout ends: [2: redemption_fee_bps @ 128][1: status @ 130][1: bump @ 131]
    let old_status = if current_len == 132 { data[130] } else { data[148] };
    drop(data);

    if current_len == target_len {
        msg!("ProtocolConfig already at target size, just fixing data");
    } else if current_len < target_len {
        msg!("Migrating ProtocolConfig: {} -> {} bytes", current_len, target_len);

        // Transfer additional rent
        let rent = Rent::get()?;
        let new_rent = rent.minimum_balance(target_len);
        let current_lamports = config_info.lamports();
        if new_rent > current_lamports {
            let diff = new_rent - current_lamports;
            invoke_signed(
                &system_instruction::transfer(
                    &ctx.accounts.admin.key(),
                    &config_info.key(),
                    diff,
                ),
                &[
                    ctx.accounts.admin.to_account_info(),
                    config_info.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[],
            )?;
        }

        // Realloc (new bytes zeroed by Solana runtime)
        config_info.realloc(target_len, false)?;
    } else {
        msg!("ProtocolConfig larger than expected, skipping realloc");
    }

    // Now remap data to new layout
    let mut data = config_info.try_borrow_mut_data()?;

    // New fields start at offset 130 in new layout
    // min_user_contribution: u64 @ 130
    data[130..138].copy_from_slice(&min_user_contribution.to_le_bytes());
    // max_lp_per_position: u64 @ 138
    data[138..146].copy_from_slice(&max_lp_per_position.to_le_bytes());
    // min_user_ratio_bps: u16 @ 146
    data[146..148].copy_from_slice(&min_user_ratio_bps.to_le_bytes());
    // status: u8 @ 148 (preserve old status)
    data[148] = old_status;
    // cb_position_limit: u32 @ 149 = 0 (disabled)
    data[149..153].copy_from_slice(&0u32.to_le_bytes());
    // cb_window_seconds: i64 @ 153 = 86400
    data[153..161].copy_from_slice(&86400i64.to_le_bytes());
    // cb_cooldown_seconds: i64 @ 161 = 3600
    data[161..169].copy_from_slice(&3600i64.to_le_bytes());
    // cb_window_start: i64 @ 169 = 0
    data[169..177].copy_from_slice(&0i64.to_le_bytes());
    // cb_positions_in_window: u32 @ 177 = 0
    data[177..181].copy_from_slice(&0u32.to_le_bytes());
    // cb_last_trigger: i64 @ 181 = 0
    data[181..189].copy_from_slice(&0i64.to_le_bytes());
    // min_insurance_fund: u64 @ 189 = 0
    data[189..197].copy_from_slice(&0u64.to_le_bytes());
    // bump: u8 @ 197
    data[197] = bump;

    msg!(
        "Migration complete. size={}, min_user_contribution={}, max_lp={}, status={}",
        target_len, min_user_contribution, max_lp_per_position, old_status
    );
    Ok(())
}
