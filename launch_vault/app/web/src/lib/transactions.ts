import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { BN, Program } from "@coral-xyz/anchor";
import type { LaunchVault } from "@/lib/idl";
import {
  PUMP_FUN_PROGRAM_ID,
  MAYHEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  FEE_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "./constants";
import {
  deriveProtocolConfig,
  deriveLpPool,
  deriveVaultPDA,
  deriveVaultATA,
  derivePumpFunPDAs,
  derivePumpUserVolumeAccumulator,
  derivePumpCreatorVault,
  derivePumpFeeConfig,
  derivePumpBondingCurveV2,
  deriveMayhemPDAs,
  deriveBuyerPDA,
} from "./pda";

// ── proxyCreateToken ────────────────────────────────────────────────────

export async function buildProxyCreateToken(
  program: Program<LaunchVault>,
  user: PublicKey,
  args: { name: string; symbol: string; uri: string; isMayhem: boolean }
) {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const pumpPDAs = derivePumpFunPDAs(mint);
  const mayhemPDAs = deriveMayhemPDAs(mint);

  const tx = await program.methods
    .proxyCreateToken(args.name, args.symbol, args.uri, args.isMayhem)
    .accounts({
      user,
      mint,
      pumpProgram: PUMP_FUN_PROGRAM_ID,
      pumpGlobal: pumpPDAs.global,
      pumpMintAuthority: pumpPDAs.mintAuthority,
      pumpBondingCurve: pumpPDAs.bondingCurve,
      pumpAssociatedBondingCurve: pumpPDAs.associatedBondingCurve,
      mayhemProgram: MAYHEM_PROGRAM_ID,
      mayhemGlobalParams: mayhemPDAs.globalParams,
      mayhemSolVault: mayhemPDAs.solVault,
      mayhemState: mayhemPDAs.state,
      mayhemTokenVault: mayhemPDAs.tokenVault,
      pumpEventAuthority: pumpPDAs.eventAuthority,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    } as any)
    .signers([mintKeypair])
    .rpc();

  return { tx, mint };
}

// ── createVault ─────────────────────────────────────────────────────────

export async function buildCreateVault(
  program: Program<LaunchVault>,
  user: PublicKey,
  tokenMint: PublicKey,
  lpAllocationSol: number,
  userContributionSol: number,
  treasury: PublicKey
) {
  const vaultState = deriveVaultPDA(user, tokenMint);
  const vaultTokenAccount = deriveVaultATA(vaultState, tokenMint);
  const protocolConfig = deriveProtocolConfig();
  const lpPool = deriveLpPool();

  const tx = await program.methods
    .createVault(
      new BN(Math.round(lpAllocationSol * LAMPORTS_PER_SOL)),
      new BN(Math.round(userContributionSol * LAMPORTS_PER_SOL))
    )
    .accounts({
      user,
      tokenMint,
      vaultState,
      vaultTokenAccount,
      protocolConfig,
      lpPool,
      treasury,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  return { tx, vaultState };
}

// ── payRental ───────────────────────────────────────────────────────────

export async function buildPayRental(
  program: Program<LaunchVault>,
  user: PublicKey,
  vaultState: PublicKey,
  treasury: PublicKey
) {
  const protocolConfig = deriveProtocolConfig();

  return program.methods
    .payRental()
    .accounts({
      user,
      vaultState,
      protocolConfig,
      treasury,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
}

// ── redeemTokens ────────────────────────────────────────────────────────

export async function buildRedeemTokens(
  program: Program<LaunchVault>,
  user: PublicKey,
  vaultState: PublicKey,
  tokenMint: PublicKey,
  amount: BN
) {
  const vaultTokenAccount = deriveVaultATA(vaultState, tokenMint);
  const userTokenAccount = getAssociatedTokenAddressSync(
    tokenMint,
    user,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const lpPool = deriveLpPool();
  const protocolConfig = deriveProtocolConfig();

  // Read treasury from config
  const config = await program.account.protocolConfig.fetch(protocolConfig);
  const treasury = (config as any).treasury as PublicKey;

  // Create user's Token2022 ATA if it doesn't exist yet
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    user,            // payer
    userTokenAccount, // ata
    user,            // owner
    tokenMint,       // mint
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return program.methods
    .redeemTokens(amount)
    .accounts({
      user,
      vaultState,
      userTokenAccount,
      vaultTokenAccount,
      tokenMint,
      lpPool,
      treasury,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .preInstructions([createAtaIx])
    .rpc();
}

// ── closeVault ──────────────────────────────────────────────────────────

export async function buildCloseVault(
  program: Program<LaunchVault>,
  user: PublicKey,
  vaultState: PublicKey,
  vaultTokenAccount: PublicKey
) {
  return program.methods
    .closeVault()
    .accounts({
      user,
      vaultState,
      vaultTokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
}

// ── depositLp ───────────────────────────────────────────────────────────

export async function buildDepositLp(
  program: Program<LaunchVault>,
  authority: PublicKey,
  amountSol: number
) {
  const lpPool = deriveLpPool();

  return program.methods
    .depositLp(new BN(Math.round(amountSol * LAMPORTS_PER_SOL)))
    .accounts({
      authority,
      lpPool,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
}

// ── withdrawLp ──────────────────────────────────────────────────────────

export async function buildWithdrawLp(
  program: Program<LaunchVault>,
  authority: PublicKey,
  amountSol: number
) {
  const lpPool = deriveLpPool();

  return program.methods
    .withdrawLp(new BN(Math.round(amountSol * LAMPORTS_PER_SOL)))
    .accounts({
      authority,
      lpPool,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
}

// ── proxyBuyToken (executor) ────────────────────────────────────────────

export async function buildProxyBuyToken(
  program: Program<LaunchVault>,
  executor: PublicKey,
  vaultState: PublicKey,
  tokenMint: PublicKey,
  tokenAmount: BN,
  maxSolLamports: BN,
  feeRecipient: PublicKey
) {
  const protocolConfig = deriveProtocolConfig();
  const lpPool = deriveLpPool();
  const vaultTokenAccount = deriveVaultATA(vaultState, tokenMint);
  const executorTokenAccount = getAssociatedTokenAddressSync(
    tokenMint,
    executor,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const pumpPDAs = derivePumpFunPDAs(tokenMint);
  const userVolumeAccumulator = derivePumpUserVolumeAccumulator(executor);
  const creatorVault = derivePumpCreatorVault(executor);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(tokenMint);

  return program.methods
    .proxyBuyToken(tokenAmount, maxSolLamports)
    .accounts({
      executor,
      vaultState,
      protocolConfig,
      lpPool,
      vaultTokenAccount,
      executorTokenAccount,
      tokenMint,
      pumpProgram: PUMP_FUN_PROGRAM_ID,
      pumpGlobal: pumpPDAs.global,
      pumpFeeRecipient: feeRecipient,
      pumpBondingCurve: pumpPDAs.bondingCurve,
      pumpAssociatedBondingCurve: pumpPDAs.associatedBondingCurve,
      pumpEventAuthority: pumpPDAs.eventAuthority,
      pumpGlobalVolumeAccumulator: pumpPDAs.globalVolumeAccumulator,
      pumpUserVolumeAccumulator: userVolumeAccumulator,
      pumpCreatorVault: creatorVault,
      pumpFeeConfig: feeConfig,
      pumpBondingCurveV2: bondingCurveV2,
      pumpFeeProgram: FEE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    } as any)
    .rpc();
}

// ── updateProtocolConfig (admin) ────────────────────────────────────────

export async function buildUpdateProtocolConfig(
  program: Program<LaunchVault>,
  admin: PublicKey,
  updates: {
    newExecutor?: PublicKey | null;
    newTreasury?: PublicKey | null;
    newRentalPeriod?: BN | null;
    newRentalFee?: BN | null;
    newInfraFee?: BN | null;
    newRedeemBps?: number | null;
    newGracePeriod?: BN | null;
    newAdmin?: PublicKey | null;
    newStatus?: any | null;
  }
) {
  const protocolConfig = deriveProtocolConfig();

  return program.methods
    .updateProtocolConfig(
      updates.newExecutor ?? null,
      updates.newTreasury ?? null,
      updates.newRentalPeriod ?? null,
      updates.newRentalFee ?? null,
      updates.newInfraFee ?? null,
      updates.newRedeemBps ?? null,
      updates.newGracePeriod ?? null,
      updates.newAdmin ?? null,
      updates.newStatus ?? null
    )
    .accounts({
      admin,
      protocolConfig,
    } as any)
    .rpc();
}

// ── launchBundle (atomic: create token + vault + buy) ───────────────────

export async function buildLaunchBundle(
  program: Program<LaunchVault>,
  connection: { getAccountInfo: (pubkey: PublicKey) => Promise<any> },
  user: PublicKey,
  args: {
    name: string;
    symbol: string;
    uri: string;
    isMayhem: boolean;
    lpAllocationSol: number;
    userContributionSol: number;
    buyAmounts: BN[];
    maxSolCosts: BN[];
  }
) {
  if (args.buyAmounts.length !== args.maxSolCosts.length) {
    throw new Error("buyAmounts and maxSolCosts must have equal length");
  }
  if (args.buyAmounts.length === 0 || args.buyAmounts.length > 5) {
    throw new Error("Number of buyers must be 1-5");
  }

  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  const protocolConfig = deriveProtocolConfig();
  const lpPool = deriveLpPool();
  const vaultPDA = deriveVaultPDA(user, mint);
  const vaultATA = deriveVaultATA(vaultPDA, mint);
  const pumpPDAs = derivePumpFunPDAs(mint);
  const mayhemPDAs = deriveMayhemPDAs(mint);
  const creatorVault = derivePumpCreatorVault(user);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(mint);

  // Read fee_recipient from PumpFun global state (offset 41)
  const globalInfo = await connection.getAccountInfo(pumpPDAs.global);
  if (!globalInfo) throw new Error("Cannot read PumpFun global account");
  const feeRecipient = new PublicKey(globalInfo.data.subarray(41, 73));

  // Read treasury from protocol config
  const config = await program.account.protocolConfig.fetch(protocolConfig);
  const treasury = (config as any).treasury as PublicKey;

  // Build remaining_accounts: [vaultATA, buyer0_pda, buyer0_ata, buyer0_vol, ...]
  const numBuyers = args.buyAmounts.length;
  const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [
    { pubkey: vaultATA, isSigner: false, isWritable: true },
  ];

  for (let i = 0; i < numBuyers; i++) {
    const buyerPDA = deriveBuyerPDA(vaultPDA, i);
    const buyerATA = getAssociatedTokenAddressSync(mint, buyerPDA, true, TOKEN_2022_PROGRAM_ID);
    const buyerVol = derivePumpUserVolumeAccumulator(buyerPDA);
    remainingAccounts.push({ pubkey: buyerPDA, isSigner: false, isWritable: true });
    remainingAccounts.push({ pubkey: buyerATA, isSigner: false, isWritable: true });
    remainingAccounts.push({ pubkey: buyerVol, isSigner: false, isWritable: true });
  }

  const tx = await program.methods
    .launchBundle(
      args.name,
      args.symbol,
      args.uri,
      args.isMayhem,
      new BN(Math.round(args.lpAllocationSol * LAMPORTS_PER_SOL)),
      new BN(Math.round(args.userContributionSol * LAMPORTS_PER_SOL)),
      args.buyAmounts,
      args.maxSolCosts
    )
    .accounts({
      user,
      mint,
      executor: user,
      vaultState: vaultPDA,
      protocolConfig,
      lpPool,
      treasury,
      pumpProgram: PUMP_FUN_PROGRAM_ID,
      pumpGlobal: pumpPDAs.global,
      pumpMintAuthority: pumpPDAs.mintAuthority,
      pumpBondingCurve: pumpPDAs.bondingCurve,
      pumpAssociatedBondingCurve: pumpPDAs.associatedBondingCurve,
      pumpEventAuthority: pumpPDAs.eventAuthority,
      pumpFeeRecipient: feeRecipient,
      mayhemProgram: MAYHEM_PROGRAM_ID,
      mayhemGlobalParams: mayhemPDAs.globalParams,
      mayhemSolVault: mayhemPDAs.solVault,
      mayhemState: mayhemPDAs.state,
      mayhemTokenVault: mayhemPDAs.tokenVault,
      pumpGlobalVolumeAccumulator: pumpPDAs.globalVolumeAccumulator,
      pumpCreatorVault: creatorVault,
      pumpFeeConfig: feeConfig,
      pumpBondingCurveV2: bondingCurveV2,
      pumpFeeProgram: FEE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .remainingAccounts(remainingAccounts)
    .signers([mintKeypair])
    .rpc();

  return { tx, mint, vaultPDA };
}
