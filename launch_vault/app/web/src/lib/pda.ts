import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  PROGRAM_ID,
  PUMP_FUN_PROGRAM_ID,
  MAYHEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  FEE_PROGRAM_ID,
  FEE_SEED_CONST,
} from "./constants";

export function deriveProtocolConfig(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    PROGRAM_ID
  );
  return pda;
}

export function deriveLpPool(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_pool")],
    PROGRAM_ID
  );
  return pda;
}

export function deriveVaultPDA(user: PublicKey, mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function deriveVaultATA(vault: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, vault, true, TOKEN_2022_PROGRAM_ID);
}

export function derivePumpFunPDAs(mint: PublicKey) {
  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_FUN_PROGRAM_ID
  );
  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_FUN_PROGRAM_ID
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_FUN_PROGRAM_ID
  );
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const [globalVolumeAccumulator] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_FUN_PROGRAM_ID
  );
  return {
    global,
    mintAuthority,
    bondingCurve,
    eventAuthority,
    associatedBondingCurve,
    globalVolumeAccumulator,
  };
}

export function derivePumpUserVolumeAccumulator(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

export function derivePumpCreatorVault(creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

export function derivePumpFeeConfig(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), FEE_SEED_CONST],
    FEE_PROGRAM_ID
  );
  return pda;
}

export function derivePumpBondingCurveV2(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve-v2"), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

export function deriveBuyerPDA(vaultPDA: PublicKey, index: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyer"), vaultPDA.toBuffer(), Buffer.from([index])],
    PROGRAM_ID
  );
  return pda;
}

export function deriveMayhemPDAs(mint: PublicKey) {
  const [globalParams] = PublicKey.findProgramAddressSync(
    [Buffer.from("global-params")],
    MAYHEM_PROGRAM_ID
  );
  const [solVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol-vault")],
    MAYHEM_PROGRAM_ID
  );
  const [state] = PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-state"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID
  );
  const tokenVault = getAssociatedTokenAddressSync(
    mint,
    solVault,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  return { globalParams, solVault, state, tokenVault };
}
