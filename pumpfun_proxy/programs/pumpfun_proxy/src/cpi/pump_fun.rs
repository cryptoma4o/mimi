use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

/// Pump.fun v2 program ID
pub const PUMP_FUN_PROGRAM_ID: Pubkey =
    pubkey!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

/// Mayhem program ID
pub const MAYHEM_PROGRAM_ID: Pubkey =
    pubkey!("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");

/// create_v2 instruction discriminator
const CREATE_V2_DISCRIMINATOR: [u8; 8] = [0xd6, 0x90, 0x4c, 0xec, 0x5f, 0x8b, 0x31, 0xb4];

/// OptionBool for Pump.fun (Anchor serialization: 0=None, 1=Some(false), 2=Some(true))
#[derive(AnchorSerialize)]
enum OptionBool {
    None,
}

/// Arguments for create_v2 CPI call
#[derive(AnchorSerialize)]
struct CreateV2Args {
    name: String,
    symbol: String,
    uri: String,
    creator: Pubkey,
    is_mayhem_mode: bool,
    is_cashback_enabled: OptionBool,
}

/// Build Pump.fun create_v2 instruction for CPI
pub fn build_create_v2_instruction(
    // Accounts
    mint: &Pubkey,
    mint_authority: &Pubkey,
    bonding_curve: &Pubkey,
    associated_bonding_curve: &Pubkey,
    global: &Pubkey,
    user: &Pubkey,
    mayhem_program: &Pubkey,
    mayhem_global_params: &Pubkey,
    mayhem_sol_vault: &Pubkey,
    mayhem_state: &Pubkey,
    mayhem_token_vault: &Pubkey,
    event_authority: &Pubkey,
    system_program: &Pubkey,
    token_program: &Pubkey,
    associated_token_program: &Pubkey,
    // Args
    name: String,
    symbol: String,
    uri: String,
    creator: Pubkey,
    is_mayhem_mode: bool,
) -> Instruction {
    let args = CreateV2Args {
        name,
        symbol,
        uri,
        creator,
        is_mayhem_mode,
        is_cashback_enabled: OptionBool::None,
    };

    let mut data = Vec::with_capacity(256);
    data.extend_from_slice(&CREATE_V2_DISCRIMINATOR);
    args.serialize(&mut data).unwrap();

    let accounts = vec![
        AccountMeta::new(*mint, true),
        AccountMeta::new_readonly(*mint_authority, false),
        AccountMeta::new(*bonding_curve, false),
        AccountMeta::new(*associated_bonding_curve, false),
        AccountMeta::new(*global, false),
        AccountMeta::new(*user, true),
        AccountMeta::new_readonly(*system_program, false),
        AccountMeta::new_readonly(*token_program, false),
        AccountMeta::new_readonly(*associated_token_program, false),
        AccountMeta::new(*mayhem_program, false),
        AccountMeta::new_readonly(*mayhem_global_params, false),
        AccountMeta::new(*mayhem_sol_vault, false),
        AccountMeta::new(*mayhem_state, false),
        AccountMeta::new(*mayhem_token_vault, false),
        AccountMeta::new_readonly(*event_authority, false),
        AccountMeta::new_readonly(PUMP_FUN_PROGRAM_ID, false),
    ];

    Instruction {
        program_id: PUMP_FUN_PROGRAM_ID,
        accounts,
        data,
    }
}
