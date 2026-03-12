use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

/// Token2022 program ID — used for ATA derivation of Pump.fun v2 tokens.
/// Pump.fun sell CPI expects the legacy SPL Token program in the `token_program`
/// account position, but ATAs are created under Token2022, so we cannot rely on
/// `token_program.key()` when deriving the ATA address.
pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// Safely read the token amount from a Token/Token2022 account.
/// The `amount` field is at byte offset 64 in the SPL Token Account layout:
/// mint[32] + owner[32] + amount[8] = offset 64.
pub fn read_token_account_amount(account_info: &AccountInfo) -> Result<u64> {
    let data = account_info.try_borrow_data()?;
    require!(
        data.len() >= 72,
        crate::errors::LaunchVaultError::InvalidVaultTokenAccount
    );
    Ok(u64::from_le_bytes(
        data[64..72]
            .try_into()
            .map_err(|_| error!(crate::errors::LaunchVaultError::InvalidVaultTokenAccount))?,
    ))
}

/// Build Token2022/SPL Token transfer_checked instruction
pub fn build_transfer_checked_instruction(
    token_program: &Pubkey,
    source: &Pubkey,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
    decimals: u8,
) -> Instruction {
    // TransferChecked instruction index = 12
    let mut data = Vec::with_capacity(10);
    data.push(12);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*source, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data,
    }
}

/// Build Token2022/SPL Token close_account instruction
pub fn build_close_account_instruction(
    token_program: &Pubkey,
    account: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
) -> Instruction {
    // CloseAccount instruction index = 9
    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*account, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data: vec![9],
    }
}

/// Build SPL Token/Token2022 MintTo instruction (discriminator 7)
pub fn build_mint_to_instruction(
    token_program: &Pubkey,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = Vec::with_capacity(9);
    data.push(7); // MintTo instruction discriminator
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*mint, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data,
    }
}

/// Build SPL Token/Token2022 Burn instruction (discriminator 8)
pub fn build_burn_instruction(
    token_program: &Pubkey,
    account: &Pubkey,
    mint: &Pubkey,
    authority: &Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = Vec::with_capacity(9);
    data.push(8); // Burn instruction discriminator
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*account, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data,
    }
}

/// Build SPL Token/Token2022 InitializeMint2 instruction (discriminator 20)
/// Sets decimals, mint authority, and optional freeze authority
pub fn build_initialize_mint2_instruction(
    token_program: &Pubkey,
    mint: &Pubkey,
    decimals: u8,
    mint_authority: &Pubkey,
    freeze_authority: Option<&Pubkey>,
) -> Instruction {
    let mut data = Vec::with_capacity(67);
    data.push(20); // InitializeMint2 instruction discriminator
    data.push(decimals);
    data.extend_from_slice(mint_authority.as_ref());
    match freeze_authority {
        Some(key) => {
            data.push(1); // COption::Some
            data.extend_from_slice(key.as_ref());
        }
        None => {
            data.push(0); // COption::None
            data.extend_from_slice(&[0u8; 32]);
        }
    }

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*mint, false),
        ],
        data,
    }
}

/// Build basic SPL Token transfer instruction (discriminator 3).
/// Works for both Token and Token2022 (tokens without transfer hooks/fees).
pub fn build_token_transfer_instruction(
    token_program: &Pubkey,
    source: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = Vec::with_capacity(9);
    data.push(3); // Transfer instruction discriminator
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*source, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data,
    }
}

/// Build idempotent instruction to create an Associated Token Account (works with Token2022).
/// Uses discriminator 1 (CreateIdempotent) — safe to call even if ATA already exists.
pub fn build_create_ata_idempotent_instruction(
    payer: &Pubkey,
    wallet: &Pubkey,
    mint: &Pubkey,
    token_program: &Pubkey,
    ata_program: &Pubkey,
) -> Instruction {
    let ata = anchor_spl::associated_token::get_associated_token_address_with_program_id(
        wallet,
        mint,
        token_program,
    );

    Instruction {
        program_id: *ata_program,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(ata, false),
            AccountMeta::new_readonly(*wallet, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            AccountMeta::new_readonly(*token_program, false),
        ],
        data: vec![1], // CreateAssociatedTokenAccountIdempotent = 1
    }
}

/// Build instruction to create an Associated Token Account (works with Token2022)
pub fn build_create_ata_instruction(
    payer: &Pubkey,
    wallet: &Pubkey,
    mint: &Pubkey,
    token_program: &Pubkey,
    ata_program: &Pubkey,
) -> Instruction {
    let ata = anchor_spl::associated_token::get_associated_token_address_with_program_id(
        wallet,
        mint,
        token_program,
    );

    Instruction {
        program_id: *ata_program,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(ata, false),
            AccountMeta::new_readonly(*wallet, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            AccountMeta::new_readonly(*token_program, false),
        ],
        data: vec![0], // CreateAssociatedTokenAccount instruction = 0
    }
}
