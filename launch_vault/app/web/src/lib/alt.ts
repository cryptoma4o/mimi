import {
  PublicKey,
  Connection,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  PUMP_FUN_PROGRAM_ID,
  MAYHEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  FEE_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  PROGRAM_ID,
} from "./constants";
import {
  deriveProtocolConfig,
  deriveLpPool,
  deriveInsuranceFund,
  derivePumpFeeConfig,
} from "./pda";

// All static accounts that are the same for every openPosition call.
// Only truly static (mint-independent) addresses belong here.
export function getStaticAccounts(): PublicKey[] {
  // Pump.fun static PDAs (no mint dependency)
  const [pumpGlobal] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_FUN_PROGRAM_ID
  );
  const [pumpMintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_FUN_PROGRAM_ID
  );
  const [pumpEventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_FUN_PROGRAM_ID
  );
  const [pumpGlobalVolumeAccumulator] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_FUN_PROGRAM_ID
  );

  // Mayhem static PDAs (no mint dependency)
  const [mayhemGlobalParams] = PublicKey.findProgramAddressSync(
    [Buffer.from("global-params")],
    MAYHEM_PROGRAM_ID
  );
  const [mayhemSolVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol-vault")],
    MAYHEM_PROGRAM_ID
  );

  return [
    deriveProtocolConfig(),
    deriveLpPool(),
    deriveInsuranceFund(),
    PUMP_FUN_PROGRAM_ID,
    pumpGlobal,
    pumpMintAuthority,
    pumpEventAuthority,
    pumpGlobalVolumeAccumulator,
    derivePumpFeeConfig(),
    MAYHEM_PROGRAM_ID,
    mayhemGlobalParams,
    mayhemSolVault,
    FEE_PROGRAM_ID,
    SystemProgram.programId,
    TOKEN_2022_PROGRAM_ID,
    new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
    SYSVAR_RENT_PUBKEY,
    PROGRAM_ID,
  ];
}

// Create and populate an ALT with all static accounts
// Returns the ALT address. Must wait ~1 slot before use.
// If existingAltAddress is provided, validates it first and skips creation if valid.
export async function createOpenPositionALT(
  connection: Connection,
  payer: PublicKey,
  sendTransaction: (tx: VersionedTransaction) => Promise<string>,
  extraAddresses?: PublicKey[],
  existingAltAddress?: PublicKey
): Promise<PublicKey> {
  // Check if an existing ALT is still valid
  if (existingAltAddress) {
    try {
      const result = await connection.getAddressLookupTable(existingAltAddress);
      if (result.value) return existingAltAddress;
    } catch {
      // ALT not found or invalid — create a new one
    }
  }

  const slot = await connection.getSlot();

  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer,
    payer: payer,
    recentSlot: slot,
  });

  const addresses = getStaticAccounts();
  if (extraAddresses) {
    addresses.push(...extraAddresses);
  }

  // Can extend with up to 30 addresses per ix
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer,
    authority: payer,
    lookupTable: altAddress,
    addresses,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [createIx, extendIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  const sig = await sendTransaction(tx);
  await connection.confirmTransaction(sig, "confirmed");

  return altAddress;
}

// Fetch and return a resolved ALT for use in VersionedTransactions
export async function fetchALT(connection: Connection, altAddress: PublicKey) {
  const result = await connection.getAddressLookupTable(altAddress);
  if (!result.value) throw new Error("ALT not found: " + altAddress.toBase58());
  return result.value;
}
