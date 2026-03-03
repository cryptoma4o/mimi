use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

/// Pump.fun v2 program ID
pub const PUMP_FUN_PROGRAM_ID: Pubkey =
    pubkey!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

/// Mayhem program ID
pub const MAYHEM_PROGRAM_ID: Pubkey =
    pubkey!("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");

/// Maximum number of buyers in a launch bundle
pub const MAX_BUYERS: usize = 5;

/// Buyer PDA seed prefix
pub const BUYER_SEED: &[u8] = b"buyer";

/// create_v2 instruction discriminator
const CREATE_V2_DISCRIMINATOR: [u8; 8] = [0xd6, 0x90, 0x4c, 0xec, 0x5f, 0x8b, 0x31, 0xb4];

/// buy instruction discriminator (SHA-256 of "global:buy" first 8 bytes)
const BUY_DISCRIMINATOR: [u8; 8] = [0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea];

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

/// Arguments for buy CPI call
#[derive(AnchorSerialize)]
struct BuyArgs {
    amount: u64,
    max_sol_cost: u64,
}

/// Build Pump.fun buy instruction for CPI
pub fn build_buy_instruction(
    global: &Pubkey,
    fee_recipient: &Pubkey,
    mint: &Pubkey,
    bonding_curve: &Pubkey,
    associated_bonding_curve: &Pubkey,
    associated_user: &Pubkey,
    user: &Pubkey,
    system_program: &Pubkey,
    token_program: &Pubkey,
    rent: &Pubkey,
    event_authority: &Pubkey,
    // Args
    amount: u64,
    max_sol_cost: u64,
) -> Instruction {
    let args = BuyArgs {
        amount,
        max_sol_cost,
    };

    let mut data = Vec::with_capacity(24);
    data.extend_from_slice(&BUY_DISCRIMINATOR);
    args.serialize(&mut data).unwrap();

    let accounts = vec![
        AccountMeta::new_readonly(*global, false),
        AccountMeta::new(*fee_recipient, false),
        AccountMeta::new_readonly(*mint, false),
        AccountMeta::new(*bonding_curve, false),
        AccountMeta::new(*associated_bonding_curve, false),
        AccountMeta::new(*associated_user, false),
        AccountMeta::new(*user, true),
        AccountMeta::new_readonly(*system_program, false),
        AccountMeta::new_readonly(*token_program, false),
        AccountMeta::new_readonly(*rent, false),
        AccountMeta::new_readonly(*event_authority, false),
        AccountMeta::new_readonly(PUMP_FUN_PROGRAM_ID, false),
    ];

    Instruction {
        program_id: PUMP_FUN_PROGRAM_ID,
        accounts,
        data,
    }
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
        AccountMeta::new_readonly(*mayhem_program, false),
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
