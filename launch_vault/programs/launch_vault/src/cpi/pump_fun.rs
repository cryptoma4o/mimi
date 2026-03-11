use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

/// Pump.fun v2 program ID
pub const PUMP_FUN_PROGRAM_ID: Pubkey =
    pubkey!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

/// Mayhem program ID
pub const MAYHEM_PROGRAM_ID: Pubkey =
    pubkey!("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");

/// PumpFun Fee program ID
pub const FEE_PROGRAM_ID: Pubkey =
    pubkey!("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

/// Fee config seed constant (hardcoded by PumpFun)
pub const FEE_SEED_CONST: [u8; 32] = [
    1, 86, 224, 246, 147, 102, 90, 207, 68, 219,
    21, 104, 191, 23, 91, 170, 81, 137, 203, 151,
    245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
];

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

/// sell instruction discriminator (SHA-256 of "global:sell" first 8 bytes)
const SELL_DISCRIMINATOR: [u8; 8] = [0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad];

/// Arguments for sell CPI call
#[derive(AnchorSerialize)]
struct SellArgs {
    amount: u64,
    min_sol_output: u64,
}

/// Derive PumpFun global_volume_accumulator PDA
pub fn derive_global_volume_accumulator() -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(
        &[b"global_volume_accumulator"],
        &PUMP_FUN_PROGRAM_ID,
    );
    pda
}

/// Derive PumpFun user_volume_accumulator PDA
pub fn derive_user_volume_accumulator(user: &Pubkey) -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(
        &[b"user_volume_accumulator", user.as_ref()],
        &PUMP_FUN_PROGRAM_ID,
    );
    pda
}

/// Derive PumpFun creator_vault PDA
pub fn derive_creator_vault(creator: &Pubkey) -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(
        &[b"creator-vault", creator.as_ref()],
        &PUMP_FUN_PROGRAM_ID,
    );
    pda
}

/// Derive PumpFun fee_config PDA (from Fee Program)
pub fn derive_fee_config() -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(
        &[b"fee_config", &FEE_SEED_CONST],
        &FEE_PROGRAM_ID,
    );
    pda
}

/// Derive PumpFun bonding_curve_v2 PDA
pub fn derive_bonding_curve_v2(mint: &Pubkey) -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(
        &[b"bonding-curve-v2", mint.as_ref()],
        &PUMP_FUN_PROGRAM_ID,
    );
    pda
}

/// Build Pump.fun v2 buy instruction for CPI (16 accounts)
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
    creator_vault: &Pubkey,
    event_authority: &Pubkey,
    global_volume_accumulator: &Pubkey,
    user_volume_accumulator: &Pubkey,
    fee_config: &Pubkey,
    bonding_curve_v2: &Pubkey,
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
        AccountMeta::new_readonly(*global, false),              // 0
        AccountMeta::new(*fee_recipient, false),                // 1
        AccountMeta::new_readonly(*mint, false),                // 2
        AccountMeta::new(*bonding_curve, false),                // 3
        AccountMeta::new(*associated_bonding_curve, false),     // 4
        AccountMeta::new(*associated_user, false),              // 5
        AccountMeta::new(*user, true),                          // 6
        AccountMeta::new_readonly(*system_program, false),      // 7
        AccountMeta::new_readonly(*token_program, false),       // 8
        AccountMeta::new(*creator_vault, false),                // 9
        AccountMeta::new_readonly(*event_authority, false),     // 10
        AccountMeta::new_readonly(PUMP_FUN_PROGRAM_ID, false),  // 11
        AccountMeta::new_readonly(*global_volume_accumulator, false), // 12
        AccountMeta::new(*user_volume_accumulator, false),      // 13
        AccountMeta::new_readonly(*fee_config, false),          // 14
        AccountMeta::new_readonly(FEE_PROGRAM_ID, false),       // 15
        AccountMeta::new_readonly(*bonding_curve_v2, false),    // 16
    ];

    Instruction {
        program_id: PUMP_FUN_PROGRAM_ID,
        accounts,
        data,
    }
}

/// Build Pump.fun v2 sell instruction for CPI.
/// NOTE: Sell account layout differs from buy:
///   - creator_vault at index 8 (before token_program)
///   - NO volume accumulators (those are buy-only)
///   - 15 accounts total (vs 17 for buy)
pub fn build_sell_instruction(
    global: &Pubkey,
    fee_recipient: &Pubkey,
    mint: &Pubkey,
    bonding_curve: &Pubkey,
    associated_bonding_curve: &Pubkey,
    associated_user: &Pubkey,
    user: &Pubkey,
    system_program: &Pubkey,
    creator_vault: &Pubkey,
    token_program: &Pubkey,
    event_authority: &Pubkey,
    fee_config: &Pubkey,
    bonding_curve_v2: &Pubkey,
    // Args
    amount: u64,
    min_sol_output: u64,
) -> Instruction {
    let args = SellArgs {
        amount,
        min_sol_output,
    };

    let mut data = Vec::with_capacity(24);
    data.extend_from_slice(&SELL_DISCRIMINATOR);
    args.serialize(&mut data).unwrap();

    let accounts = vec![
        AccountMeta::new_readonly(*global, false),              // 0
        AccountMeta::new(*fee_recipient, false),                // 1
        AccountMeta::new_readonly(*mint, false),                // 2
        AccountMeta::new(*bonding_curve, false),                // 3
        AccountMeta::new(*associated_bonding_curve, false),     // 4
        AccountMeta::new(*associated_user, false),              // 5
        AccountMeta::new(*user, true),                          // 6
        AccountMeta::new_readonly(*system_program, false),      // 7
        AccountMeta::new(*creator_vault, false),                // 8
        AccountMeta::new_readonly(*token_program, false),       // 9
        AccountMeta::new_readonly(*event_authority, false),     // 10
        AccountMeta::new_readonly(PUMP_FUN_PROGRAM_ID, false),  // 11
        AccountMeta::new_readonly(*fee_config, false),          // 12
        AccountMeta::new_readonly(FEE_PROGRAM_ID, false),       // 13
        AccountMeta::new_readonly(*bonding_curve_v2, false),    // 14
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
