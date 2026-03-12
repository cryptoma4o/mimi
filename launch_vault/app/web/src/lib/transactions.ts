import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  Connection,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
} from "@solana/web3.js";
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
  deriveInsuranceFund,
  deriveLpMint,
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
import { fetchALT } from "./alt";

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

// ── openPosition (atomic: create token + vault + buy) ───────────────────

export async function buildOpenPosition(
  program: Program<LaunchVault>,
  connection: Connection,
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
    altAddress?: PublicKey;
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
  const insuranceFund = deriveInsuranceFund();
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

  // Build instruction (not .rpc()) so we can wrap in VersionedTransaction
  const ix = await program.methods
    .openPosition(
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
      vaultState: vaultPDA,
      protocolConfig,
      lpPool,
      treasury,
      insuranceFund,
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
    .instruction();

  // Build VersionedTransaction with ALT for compression
  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const lookupTables: AddressLookupTableAccount[] = [];
  if (args.altAddress) {
    const alt = await fetchALT(connection, args.altAddress);
    lookupTables.push(alt);
  }

  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: [computeIx, ix],
  }).compileToV0Message(lookupTables);

  const vtx = new VersionedTransaction(message);
  vtx.sign([mintKeypair]);

  return { vtx, mint, vaultPDA, mintKeypair, blockhash, lastValidBlockHeight };
}

// ── sellPosition ────────────────────────────────────────────────────────

export async function buildSellPosition(
  program: Program<LaunchVault>,
  connection: { getAccountInfo: (pubkey: PublicKey) => Promise<any> },
  seller: PublicKey,
  vaultState: PublicKey,
  tokenMint: PublicKey,
  amount: BN,
  minSolOutput: BN,
  vaultOwner?: PublicKey
) {
  const protocolConfig = deriveProtocolConfig();
  const lpPool = deriveLpPool();
  const vaultTokenAccount = deriveVaultATA(vaultState, tokenMint);
  const pumpPDAs = derivePumpFunPDAs(tokenMint);
  // creator_vault must derive from the token creator (vault owner), not the seller
  const creatorVault = derivePumpCreatorVault(vaultOwner ?? seller);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(tokenMint);

  // Read fee_recipient from PumpFun global state
  const globalInfo = await connection.getAccountInfo(pumpPDAs.global);
  if (!globalInfo) throw new Error("Cannot read PumpFun global account");
  const feeRecipient = new PublicKey(globalInfo.data.subarray(41, 73));

  return program.methods
    .sellPosition(amount, minSolOutput)
    .accounts({
      seller,
      vaultState,
      protocolConfig,
      lpPool,
      vaultTokenAccount,
      tokenMint,
      pumpProgram: PUMP_FUN_PROGRAM_ID,
      pumpGlobal: pumpPDAs.global,
      pumpFeeRecipient: feeRecipient,
      pumpBondingCurve: pumpPDAs.bondingCurve,
      pumpAssociatedBondingCurve: pumpPDAs.associatedBondingCurve,
      pumpEventAuthority: pumpPDAs.eventAuthority,
      pumpCreatorVault: creatorVault,
      pumpFeeConfig: feeConfig,
      pumpBondingCurveV2: bondingCurveV2,
      pumpFeeProgram: FEE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    } as any)
    .rpc();
}

// ── closePosition ──────────────────────────────────────────────────────

export async function buildClosePosition(
  program: Program<LaunchVault>,
  closer: PublicKey,
  vaultState: PublicKey,
  vaultOwner: PublicKey,
  vaultTokenAccount: PublicKey
) {
  const protocolConfig = deriveProtocolConfig();
  const lpPool = deriveLpPool();

  return program.methods
    .closePosition()
    .accounts({
      closer,
      vaultState,
      protocolConfig,
      lpPool,
      vaultOwner,
      vaultTokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
}

// ── forceClosePosition (executor) ──────────────────────────────────────

export async function buildForceClosePosition(
  program: Program<LaunchVault>,
  connection: { getAccountInfo: (pubkey: PublicKey) => Promise<any> },
  executor: PublicKey,
  vaultState: PublicKey,
  tokenMint: PublicKey,
  vaultOwner: PublicKey
) {
  const protocolConfig = deriveProtocolConfig();
  const lpPool = deriveLpPool();
  const vaultTokenAccount = deriveVaultATA(vaultState, tokenMint);
  const pumpPDAs = derivePumpFunPDAs(tokenMint);
  // creator_vault must derive from the token creator (vault owner), not the executor
  const creatorVault = derivePumpCreatorVault(vaultOwner);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(tokenMint);

  // Read fee_recipient from PumpFun global state
  const globalInfo = await connection.getAccountInfo(pumpPDAs.global);
  if (!globalInfo) throw new Error("Cannot read PumpFun global account");
  const feeRecipient = new PublicKey(globalInfo.data.subarray(41, 73));

  return program.methods
    .forceClosePosition()
    .accounts({
      executor,
      vaultState,
      protocolConfig,
      lpPool,
      vaultTokenAccount,
      tokenMint,
      pumpProgram: PUMP_FUN_PROGRAM_ID,
      pumpGlobal: pumpPDAs.global,
      pumpFeeRecipient: feeRecipient,
      pumpBondingCurve: pumpPDAs.bondingCurve,
      pumpAssociatedBondingCurve: pumpPDAs.associatedBondingCurve,
      pumpEventAuthority: pumpPDAs.eventAuthority,
      pumpCreatorVault: creatorVault,
      pumpFeeConfig: feeConfig,
      pumpBondingCurveV2: bondingCurveV2,
      pumpFeeProgram: FEE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
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
    user,
    userTokenAccount,
    user,
    tokenMint,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return program.methods
    .redeemTokens(amount)
    .accounts({
      user,
      vaultState,
      protocolConfig,
      lpPool,
      treasury,
      vaultTokenAccount,
      userTokenAccount,
      tokenMint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    } as any)
    .preInstructions([createAtaIx])
    .rpc();
}

// ── depositLp ───────────────────────────────────────────────────────────

export async function buildDepositLp(
  program: Program<LaunchVault>,
  depositor: PublicKey,
  amountSol: number
) {
  const lpPool = deriveLpPool();
  const lpMint = deriveLpMint();
  const depositorLpAta = getAssociatedTokenAddressSync(
    lpMint,
    depositor,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Create depositor's LP ATA if it doesn't exist yet
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    depositor,
    depositorLpAta,
    depositor,
    lpMint,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return program.methods
    .depositLp(new BN(Math.round(amountSol * LAMPORTS_PER_SOL)))
    .accounts({
      depositor,
      lpPool,
      lpMint,
      depositorLpAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .preInstructions([createAtaIx])
    .rpc();
}

// ── withdrawLp ──────────────────────────────────────────────────────────

export async function buildWithdrawLp(
  program: Program<LaunchVault>,
  withdrawer: PublicKey,
  lpAmount: BN
) {
  const lpPool = deriveLpPool();
  const lpMint = deriveLpMint();
  const withdrawerLpAta = getAssociatedTokenAddressSync(
    lpMint,
    withdrawer,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  return program.methods
    .withdrawLp(lpAmount)
    .accounts({
      withdrawer,
      lpPool,
      lpMint,
      withdrawerLpAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
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
    newFixedFee?: BN | null;
    newFeeBps?: number | null;
    newMaxUtilizationBps?: number | null;
    newPositionTimeout?: BN | null;
    newCloseRewardBps?: number | null;
    newInsuranceSplitBps?: number | null;
    newRedemptionFeeBps?: number | null;
    newAdmin?: PublicKey | null;
    newStatus?: any | null;
  }
) {
  const protocolConfig = deriveProtocolConfig();

  return program.methods
    .updateProtocolConfig(
      updates.newExecutor ?? null,
      updates.newTreasury ?? null,
      updates.newFixedFee ?? null,
      updates.newFeeBps ?? null,
      updates.newMaxUtilizationBps ?? null,
      updates.newPositionTimeout ?? null,
      updates.newCloseRewardBps ?? null,
      updates.newInsuranceSplitBps ?? null,
      updates.newRedemptionFeeBps ?? null,
      updates.newAdmin ?? null,
      updates.newStatus ?? null
    )
    .accounts({
      admin,
      protocolConfig,
    } as any)
    .rpc();
}
