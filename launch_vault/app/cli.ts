import * as anchor from "@coral-xyz/anchor";
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Constants ───────────────────────────────────────────────────────────────

const PUMP_FUN_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);
const MAYHEM_PROGRAM_ID = new PublicKey(
  "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e"
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
const FEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
);
const FEE_SEED_CONST = Buffer.from([
  1, 86, 224, 246, 147, 102, 90, 207, 68, 219,
  21, 104, 191, 23, 91, 170, 81, 137, 203, 151,
  245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
]);

// ─── PDA Derivation ──────────────────────────────────────────────────────────

function deriveProtocolPDAs(programId: PublicKey) {
  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );
  const [lpPool] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_pool")],
    programId
  );
  return { protocolConfig, lpPool };
}

function deriveVaultPDA(programId: PublicKey, user: PublicKey, mint: PublicKey) {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.toBuffer(), mint.toBuffer()],
    programId
  );
  return vault;
}

function derivePumpFunPDAs(mint: PublicKey) {
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
  return { global, mintAuthority, bondingCurve, eventAuthority, associatedBondingCurve, globalVolumeAccumulator };
}

function derivePumpUserVolumeAccumulator(user: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpCreatorVault(creator: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpFeeConfig() {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), FEE_SEED_CONST],
    FEE_PROGRAM_ID
  );
  return pda;
}

function derivePumpBondingCurveV2(mint: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve-v2"), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function deriveBuyerPDA(programId: PublicKey, vaultPDA: PublicKey, index: number) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyer"), vaultPDA.toBuffer(), Buffer.from([index])],
    programId
  );
  return pda;
}

function deriveMayhemPDAs(mint: PublicKey) {
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

// ─── Wallet Loader ───────────────────────────────────────────────────────────

function loadKeypair(filepath: string): Keypair {
  const resolved = filepath.startsWith("~")
    ? path.join(os.homedir(), filepath.slice(1))
    : path.resolve(filepath);

  if (!fs.existsSync(resolved)) {
    console.error(`Keypair file not found: ${resolved}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseGlobalArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--mayhem" || arg === "--dry-run") {
      flags[arg.slice(2)] = true;
    } else if (arg.startsWith("--") && i + 1 < args.length) {
      flags[arg.slice(2)] = args[++i];
    }
  }

  const keypairPath =
    (flags.keypair as string) ||
    path.join(os.homedir(), "solana-wallet.json");
  const rpc = (flags.rpc as string) || null;
  const cluster = ((flags.cluster as string) || "devnet") as "devnet" | "mainnet-beta";
  const priorityFee = flags["priority-fee"]
    ? parseInt(flags["priority-fee"] as string, 10)
    : 50_000;

  return { command, flags, keypairPath, rpc, cluster, priorityFee };
}

async function setupProvider(keypairPath: string, rpc: string | null, cluster: string) {
  const walletKeypair = loadKeypair(keypairPath);
  const rpcUrl = rpc || clusterApiUrl(cluster as any);
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const idlPath = path.join(__dirname, "..", "target", "idl", "launch_vault.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, provider);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Wallet:  ${walletKeypair.publicKey.toBase58()}`);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Cluster: ${cluster}`);
  console.log();

  return { walletKeypair, connection, provider, program };
}

function preInstructions(priorityFee: number) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
  ];
}

function explorerUrl(sig: string, cluster: string) {
  const param = cluster === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://solscan.io/tx/${sig}${param}`;
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdInit(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Initialize Protocol ===\n");
  const { walletKeypair, program, connection } = await setupProvider(keypairPath, rpc, cluster);
  const { protocolConfig, lpPool } = deriveProtocolPDAs(program.programId);

  // Check if already initialized
  const existing = await connection.getAccountInfo(protocolConfig);
  if (existing) {
    console.log("Protocol already initialized!");
    console.log(`ProtocolConfig: ${protocolConfig.toBase58()}`);
    console.log(`LpPool:         ${lpPool.toBase58()}`);
    return;
  }

  const fixedFee = parseInt((flags["fixed-fee"] as string) || "10000000", 10); // 0.01 SOL
  const feeBps = parseInt((flags["fee-bps"] as string) || "200", 10); // 2%
  const maxUtilBps = parseInt((flags["max-util-bps"] as string) || "8500", 10); // 85%
  const positionTimeout = parseInt((flags["position-timeout"] as string) || "3600", 10); // 1h
  const closeRewardBps = parseInt((flags["close-reward-bps"] as string) || "100", 10); // 1%
  const insuranceSplitBps = parseInt((flags["insurance-split-bps"] as string) || "2000", 10); // 20%
  const redeemBps = parseInt((flags["redeem-bps"] as string) || "250", 10); // 2.5%

  console.log(`Fixed fee:         ${fixedFee} lamports (${fixedFee / LAMPORTS_PER_SOL} SOL)`);
  console.log(`Fee BPS:           ${feeBps} bps`);
  console.log(`Max utilization:   ${maxUtilBps} bps`);
  console.log(`Position timeout:  ${positionTimeout}s`);
  console.log(`Close reward:      ${closeRewardBps} bps`);
  console.log(`Insurance split:   ${insuranceSplitBps} bps`);
  console.log(`Redemption fee:    ${redeemBps} bps`);
  console.log();

  // Derive insurance fund and LP mint PDAs
  const [insuranceFund] = PublicKey.findProgramAddressSync(
    [Buffer.from("insurance_fund")],
    program.programId
  );
  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint")],
    program.programId
  );

  try {
    const tx = await program.methods
      .initializeProtocol(
        walletKeypair.publicKey, // executor
        walletKeypair.publicKey, // treasury
        new anchor.BN(fixedFee),
        feeBps,
        maxUtilBps,
        new anchor.BN(positionTimeout),
        closeRewardBps,
        insuranceSplitBps,
        redeemBps,
      )
      .accounts({
        admin: walletKeypair.publicKey,
        protocolConfig,
        lpPool,
        insuranceFund,
        lpMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions(preInstructions(priorityFee))
      .rpc({ commitment: "confirmed" });

    console.log("=== Protocol Initialized ===\n");
    console.log(`TX:             ${tx}`);
    console.log(`ProtocolConfig: ${protocolConfig.toBase58()}`);
    console.log(`LpPool:         ${lpPool.toBase58()}`);
    console.log(`Explorer:       ${explorerUrl(tx, cluster)}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

async function cmdDepositLp(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Deposit LP ===\n");
  const { walletKeypair, program } = await setupProvider(keypairPath, rpc, cluster);
  const { lpPool } = deriveProtocolPDAs(program.programId);

  const amountSol = parseFloat((flags.amount as string) || "0");
  if (amountSol <= 0) {
    console.error("Usage: yarn cli deposit-lp --amount <SOL>");
    process.exit(1);
  }
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  console.log(`Depositing: ${amountSol} SOL (${amountLamports} lamports)\n`);

  // Derive LP mint and depositor's LP ATA
  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint")],
    program.programId
  );
  const depositorLpAta = getAssociatedTokenAddressSync(
    lpMint,
    walletKeypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  try {
    const tx = await program.methods
      .depositLp(new anchor.BN(amountLamports))
      .accounts({
        depositor: walletKeypair.publicKey,
        lpPool,
        lpMint,
        depositorLpAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions(preInstructions(priorityFee))
      .rpc({ commitment: "confirmed" });

    console.log("=== LP Deposited ===\n");
    console.log(`TX:       ${tx}`);
    console.log(`Explorer: ${explorerUrl(tx, cluster)}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

async function cmdCreateToken(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Create Token (PumpFun v2 CPI) ===\n");
  const { walletKeypair, program } = await setupProvider(keypairPath, rpc, cluster);

  const name = flags.name as string;
  const symbol = flags.symbol as string;
  const uri = flags.uri as string;
  const isMayhem = !!flags.mayhem;

  if (!name || !symbol || !uri) {
    console.error("Usage: yarn cli create-token --name <NAME> --symbol <SYM> --uri <URI> [--mayhem]");
    process.exit(1);
  }

  const mintKeypair = Keypair.generate();
  const pumpPDAs = derivePumpFunPDAs(mintKeypair.publicKey);
  const mayhemPDAs = deriveMayhemPDAs(mintKeypair.publicKey);

  console.log(`Name:    ${name}`);
  console.log(`Symbol:  ${symbol}`);
  console.log(`URI:     ${uri}`);
  console.log(`Mayhem:  ${isMayhem}`);
  console.log(`Mint:    ${mintKeypair.publicKey.toBase58()}`);
  console.log();

  try {
    const tx = await program.methods
      .proxyCreateToken(name, symbol, uri, isMayhem)
      .accounts({
        user: walletKeypair.publicKey,
        mint: mintKeypair.publicKey,
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
      })
      .preInstructions(preInstructions(priorityFee))
      .signers([mintKeypair])
      .rpc({ commitment: "confirmed" });

    const clusterParam = cluster === "mainnet-beta" ? "" : "?cluster=devnet";
    console.log("=== Token Created ===\n");
    console.log(`TX:    ${tx}`);
    console.log(`Mint:  ${mintKeypair.publicKey.toBase58()}`);
    console.log(`\nExplorer:`);
    console.log(`  TX:    https://solscan.io/tx/${tx}${clusterParam}`);
    console.log(`  Token: https://solscan.io/token/${mintKeypair.publicKey.toBase58()}${clusterParam}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

async function cmdCreateVault(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Create Vault ===\n");
  const { walletKeypair, program } = await setupProvider(keypairPath, rpc, cluster);

  const mint = flags.mint as string;
  const lpSol = parseFloat((flags["lp-allocation"] as string) || "0");
  const contribSol = parseFloat((flags["user-contribution"] as string) || "0");

  if (!mint || lpSol <= 0 || contribSol <= 0) {
    console.error("Usage: yarn cli create-vault --mint <MINT> --lp-allocation <SOL> --user-contribution <SOL>");
    process.exit(1);
  }

  const mintPubkey = new PublicKey(mint);
  const lpLamports = Math.floor(lpSol * LAMPORTS_PER_SOL);
  const contribLamports = Math.floor(contribSol * LAMPORTS_PER_SOL);

  const { protocolConfig, lpPool } = deriveProtocolPDAs(program.programId);
  const vault = deriveVaultPDA(program.programId, walletKeypair.publicKey, mintPubkey);

  // Derive vault ATA
  const vaultAta = getAssociatedTokenAddressSync(
    mintPubkey,
    vault,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  // Read treasury from protocol config
  const configData = await (program.account as any).protocolConfig.fetch(protocolConfig);
  const treasury = configData.treasury as PublicKey;

  console.log(`Mint:              ${mint}`);
  console.log(`LP allocation:     ${lpSol} SOL`);
  console.log(`User contribution: ${contribSol} SOL`);
  console.log(`Vault PDA:         ${vault.toBase58()}`);
  console.log(`Vault ATA:         ${vaultAta.toBase58()}`);
  console.log();

  try {
    const tx = await program.methods
      .createVault(new anchor.BN(lpLamports), new anchor.BN(contribLamports))
      .accounts({
        user: walletKeypair.publicKey,
        tokenMint: mintPubkey,
        vaultState: vault,
        vaultTokenAccount: vaultAta,
        protocolConfig,
        lpPool,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions(priorityFee))
      .rpc({ commitment: "confirmed" });

    console.log("=== Vault Created ===\n");
    console.log(`TX:       ${tx}`);
    console.log(`Vault:    ${vault.toBase58()}`);
    console.log(`Explorer: ${explorerUrl(tx, cluster)}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

async function cmdWithdrawLp(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Withdraw LP ===\n");
  const { walletKeypair, program } = await setupProvider(keypairPath, rpc, cluster);
  const { lpPool } = deriveProtocolPDAs(program.programId);

  const amountSol = parseFloat((flags.amount as string) || "0");
  if (amountSol <= 0) {
    console.error("Usage: yarn cli withdraw-lp --amount <SOL>");
    process.exit(1);
  }
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  console.log(`Withdrawing: ${amountSol} SOL (${amountLamports} lamports)\n`);

  try {
    const tx = await program.methods
      .withdrawLp(new anchor.BN(amountLamports))
      .accounts({
        authority: walletKeypair.publicKey,
        lpPool,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions(preInstructions(priorityFee))
      .rpc({ commitment: "confirmed" });

    console.log("=== LP Withdrawn ===\n");
    console.log(`TX:       ${tx}`);
    console.log(`Explorer: ${explorerUrl(tx, cluster)}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

async function cmdProxyBuy(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Proxy Buy Token (PumpFun v2) ===\n");
  const { walletKeypair, program, connection } = await setupProvider(keypairPath, rpc, cluster);

  const mint = flags.mint as string;
  const amount = parseFloat((flags.amount as string) || "0");
  const maxSolCost = parseFloat((flags["max-sol-cost"] as string) || "0");

  if (!mint || amount <= 0 || maxSolCost <= 0) {
    console.error("Usage: yarn cli proxy-buy --mint <MINT> --amount <TOKENS> --max-sol-cost <SOL>");
    console.error("\n  --mint <PUBKEY>        Token mint address");
    console.error("  --amount <NUM>         Token amount (in raw units, e.g. 1000000)");
    console.error("  --max-sol-cost <SOL>   Maximum SOL to spend");
    process.exit(1);
  }

  const mintPubkey = new PublicKey(mint);
  const tokenAmount = new anchor.BN(amount);
  const maxSolLamports = new anchor.BN(Math.floor(maxSolCost * LAMPORTS_PER_SOL));

  const { protocolConfig, lpPool } = deriveProtocolPDAs(program.programId);
  const vault = deriveVaultPDA(program.programId, walletKeypair.publicKey, mintPubkey);
  const vaultAta = getAssociatedTokenAddressSync(mintPubkey, vault, true, TOKEN_2022_PROGRAM_ID);
  const executorAta = getAssociatedTokenAddressSync(mintPubkey, walletKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const pumpPDAs = derivePumpFunPDAs(mintPubkey);

  // Read fee_recipient from PumpFun global state (offset 41: 8 discrim + 1 bool + 32 authority)
  const globalInfo = await connection.getAccountInfo(pumpPDAs.global);
  if (!globalInfo) {
    console.error("Cannot read PumpFun global account. Is PumpFun deployed on this cluster?");
    process.exit(1);
  }
  const feeRecipient = (flags["fee-recipient"] as string)
    ? new PublicKey(flags["fee-recipient"] as string)
    : new PublicKey(globalInfo.data.subarray(41, 73));

  // Derive new PumpFun v2 accounts
  const creatorVault = derivePumpCreatorVault(walletKeypair.publicKey);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(mintPubkey);

  console.log(`Mint:             ${mint}`);
  console.log(`Token amount:     ${amount}`);
  console.log(`Max SOL cost:     ${maxSolCost} SOL`);
  console.log(`Vault PDA:        ${vault.toBase58()}`);
  console.log(`Vault ATA:        ${vaultAta.toBase58()}`);
  console.log(`Executor ATA:     ${executorAta.toBase58()}`);
  console.log(`Fee recipient:    ${feeRecipient.toBase58()}`);
  console.log(`Creator vault:    ${creatorVault.toBase58()}`);
  console.log(`Fee config:       ${feeConfig.toBase58()}`);
  console.log(`Bonding curve v2: ${bondingCurveV2.toBase58()}`);
  console.log();

  try {
    const tx = await program.methods
      .proxyBuyToken(tokenAmount, maxSolLamports)
      .accounts({
        executor: walletKeypair.publicKey,
        vaultState: vault,
        protocolConfig,
        lpPool,
        vaultTokenAccount: vaultAta,
        executorTokenAccount: executorAta,
        tokenMint: mintPubkey,
        pumpProgram: PUMP_FUN_PROGRAM_ID,
        pumpGlobal: pumpPDAs.global,
        pumpFeeRecipient: feeRecipient,
        pumpBondingCurve: pumpPDAs.bondingCurve,
        pumpAssociatedBondingCurve: pumpPDAs.associatedBondingCurve,
        pumpEventAuthority: pumpPDAs.eventAuthority,
        pumpGlobalVolumeAccumulator: pumpPDAs.globalVolumeAccumulator,
        pumpUserVolumeAccumulator: derivePumpUserVolumeAccumulator(walletKeypair.publicKey),
        pumpCreatorVault: creatorVault,
        pumpFeeConfig: feeConfig,
        pumpBondingCurveV2: bondingCurveV2,
        pumpFeeProgram: FEE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions(priorityFee))
      .rpc({ commitment: "confirmed" });

    console.log("=== Proxy Buy Complete ===\n");
    console.log(`TX:       ${tx}`);
    console.log(`Vault:    ${vault.toBase58()}`);
    console.log(`Status:   Active (tokens purchased via PumpFun v2)`);
    console.log(`Explorer: ${explorerUrl(tx, cluster)}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

// ── cmdSellPosition ─────────────────────────────────────────────────────────

async function cmdSellPosition(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Sell Position (PumpFun v2 CPI) ===\n");
  const { walletKeypair, program, connection } = await setupProvider(keypairPath, rpc, cluster);

  const mint = flags.mint as string;
  const amountRaw = flags.amount as string;
  const minSolStr = (flags["min-sol"] as string) || "0";

  if (!mint) {
    console.error("Usage: yarn cli sell-position --mint <MINT> [--amount <RAW_TOKENS>] [--min-sol <SOL>]");
    console.error("\n  --mint <PUBKEY>        Token mint address");
    console.error("  --amount <NUM>         Token amount in raw units (default: sell all)");
    console.error("  --min-sol <SOL>        Minimum SOL output (default: 0)");
    process.exit(1);
  }

  const mintPubkey = new PublicKey(mint);
  const minSolLamports = new anchor.BN(Math.floor(parseFloat(minSolStr) * LAMPORTS_PER_SOL));

  const { protocolConfig, lpPool } = deriveProtocolPDAs(program.programId);
  const vaultPDA = deriveVaultPDA(program.programId, walletKeypair.publicKey, mintPubkey);

  // Fetch vault state to get remaining_token_amount and user
  let vaultData: any;
  try {
    vaultData = await (program.account as any).launchVaultState.fetch(vaultPDA);
  } catch {
    console.error(`Vault not found for mint ${mint} and wallet ${walletKeypair.publicKey.toBase58()}`);
    process.exit(1);
  }

  const remainingTokens = (vaultData.remainingTokenAmount as anchor.BN).toNumber();
  const sellAmount = amountRaw
    ? new anchor.BN(amountRaw)
    : new anchor.BN(remainingTokens);

  if (sellAmount.toNumber() <= 0) {
    console.error("No tokens to sell (remaining_token_amount = 0)");
    process.exit(1);
  }
  if (sellAmount.toNumber() > remainingTokens) {
    console.error(`Amount ${sellAmount.toString()} exceeds remaining tokens ${remainingTokens}`);
    process.exit(1);
  }

  const vaultTokenAccount = getAssociatedTokenAddressSync(mintPubkey, vaultPDA, true, TOKEN_2022_PROGRAM_ID);
  const pumpPDAs = derivePumpFunPDAs(mintPubkey);

  // Read fee_recipient from PumpFun global state
  const globalInfo = await connection.getAccountInfo(pumpPDAs.global);
  if (!globalInfo) {
    console.error("Cannot read PumpFun global account. Is PumpFun deployed on this cluster?");
    process.exit(1);
  }
  const feeRecipient = new PublicKey(globalInfo.data.subarray(41, 73));

  // creator_vault: derive from vault owner (token creator), NOT from seller
  const vaultOwner = vaultData.user as PublicKey;
  const creatorVault = derivePumpCreatorVault(vaultOwner);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(mintPubkey);

  console.log(`Mint:              ${mint}`);
  console.log(`Vault PDA:         ${vaultPDA.toBase58()}`);
  console.log(`Vault owner:       ${vaultOwner.toBase58()}`);
  console.log(`Remaining tokens:  ${remainingTokens}`);
  console.log(`Selling:           ${sellAmount.toString()} tokens`);
  console.log(`Min SOL output:    ${minSolStr} SOL`);
  console.log(`Fee recipient:     ${feeRecipient.toBase58()}`);
  console.log(`Creator vault:     ${creatorVault.toBase58()}`);
  console.log();

  try {
    const tx = await program.methods
      .sellPosition(sellAmount, minSolLamports)
      .accounts({
        seller: walletKeypair.publicKey,
        vaultState: vaultPDA,
        protocolConfig,
        lpPool,
        vaultTokenAccount,
        tokenMint: mintPubkey,
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
      .preInstructions(preInstructions(priorityFee))
      .rpc({ commitment: "confirmed" });

    console.log("=== Sell Position Complete ===\n");
    console.log(`TX:       ${tx}`);
    console.log(`Vault:    ${vaultPDA.toBase58()}`);
    console.log(`Explorer: ${explorerUrl(tx, cluster)}`);

    // Fetch updated vault state
    try {
      const updatedVault = await (program.account as any).launchVaultState.fetch(vaultPDA);
      const newRemaining = (updatedVault.remainingTokenAmount as anchor.BN).toNumber();
      const newLpAlloc = (updatedVault.remainingLpAllocation as anchor.BN).toNumber();
      console.log(`\nUpdated vault state:`);
      console.log(`  Remaining tokens:  ${newRemaining}`);
      console.log(`  Remaining LP alloc: ${(newLpAlloc / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      console.log(`  Status:            ${JSON.stringify(updatedVault.status)}`);
    } catch {}
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

// ── ALT (Address Lookup Table) helpers for launch-bundle ─────────────────────

const ALT_FILE_PREFIX = ".launch-alt-";

function getAltFilePath(cluster: string): string {
  return path.join(__dirname, `${ALT_FILE_PREFIX}${cluster}.json`);
}

async function getOrCreateALT(
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[],
  cluster: string
): Promise<PublicKey> {
  const altFile = getAltFilePath(cluster);

  // Try cached ALT
  try {
    const data = JSON.parse(fs.readFileSync(altFile, "utf-8"));
    const altAddress = new PublicKey(data.address);
    const altAccount = await connection.getAddressLookupTable(altAddress);
    if (altAccount.value) {
      // Check if all addresses are in the ALT
      const existing = new Set(altAccount.value.state.addresses.map(a => a.toBase58()));
      const missing = addresses.filter(a => !existing.has(a.toBase58()));
      if (missing.length === 0) {
        console.log(`Using cached ALT: ${altAddress.toBase58()}`);
        return altAddress;
      }
      // Extend with missing addresses
      if (missing.length > 0) {
        console.log(`Extending ALT with ${missing.length} new addresses...`);
        const extendIx = AddressLookupTableProgram.extendLookupTable({
          lookupTable: altAddress,
          authority: payer.publicKey,
          payer: payer.publicKey,
          addresses: missing,
        });
        const tx = new Transaction().add(extendIx);
        await sendAndConfirmTransaction(connection, tx, [payer]);
        // Wait for activation
        await new Promise(r => setTimeout(r, 2000));
        return altAddress;
      }
    }
  } catch {}

  // Create new ALT
  console.log("Creating Address Lookup Table for launch-bundle...");
  const slot = await connection.getSlot("finalized");
  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  // Split addresses into chunks of 20 (extend limit)
  const chunks: PublicKey[][] = [];
  for (let i = 0; i < addresses.length; i += 20) {
    chunks.push(addresses.slice(i, i + 20));
  }

  const tx = new Transaction().add(createIx);
  tx.add(AddressLookupTableProgram.extendLookupTable({
    lookupTable: altAddress,
    authority: payer.publicKey,
    payer: payer.publicKey,
    addresses: chunks[0],
  }));
  await sendAndConfirmTransaction(connection, tx, [payer]);

  // Extend with remaining chunks
  for (let i = 1; i < chunks.length; i++) {
    const extTx = new Transaction().add(AddressLookupTableProgram.extendLookupTable({
      lookupTable: altAddress,
      authority: payer.publicKey,
      payer: payer.publicKey,
      addresses: chunks[i],
    }));
    await sendAndConfirmTransaction(connection, extTx, [payer]);
  }

  // Save
  fs.writeFileSync(altFile, JSON.stringify({ address: altAddress.toBase58() }));
  console.log(`ALT created: ${altAddress.toBase58()}`);

  // Wait for activation (~1 slot)
  console.log("Waiting for ALT activation...");
  await new Promise(r => setTimeout(r, 2000));

  return altAddress;
}

// ── cmdLaunchBundle ──────────────────────────────────────────────────────────

async function cmdLaunchBundle(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string, priorityFee: number) {
  console.log("=== Launch Vault — Launch Bundle (Atomic) ===\n");
  const { walletKeypair, program, connection } = await setupProvider(keypairPath, rpc, cluster);

  const name = flags.name as string;
  const symbol = flags.symbol as string;
  const uri = flags.uri as string;
  const isMayhem = !!flags.mayhem;
  const lpSol = parseFloat((flags["lp-allocation"] as string) || "0");
  const contribSol = parseFloat((flags["user-contribution"] as string) || "0");
  const buyAmountsStr = flags["buy-amounts"] as string;
  const maxCostsStr = flags["max-sol-costs"] as string;

  if (!name || !symbol || !uri || lpSol <= 0 || !buyAmountsStr || !maxCostsStr) {
    console.error("Usage: yarn cli launch-bundle --name <NAME> --symbol <SYM> --uri <URI> \\");
    console.error("  --lp-allocation <SOL> --user-contribution <SOL> \\");
    console.error("  --buy-amounts <comma-separated raw tokens> --max-sol-costs <comma-separated SOL>");
    process.exit(1);
  }

  const buyAmounts = buyAmountsStr.split(",").map(s => new anchor.BN(s.trim()));
  const maxSolCosts = maxCostsStr.split(",").map(s => new anchor.BN(Math.round(parseFloat(s.trim()) * LAMPORTS_PER_SOL)));

  if (buyAmounts.length !== maxSolCosts.length) {
    console.error("buy-amounts and max-sol-costs must have the same number of entries");
    process.exit(1);
  }
  if (buyAmounts.length === 0 || buyAmounts.length > 5) {
    console.error("Number of buyers must be 1-5");
    process.exit(1);
  }

  const numBuyers = buyAmounts.length;
  const lpLamports = new anchor.BN(Math.round(lpSol * LAMPORTS_PER_SOL));
  const contribLamports = new anchor.BN(Math.round(contribSol * LAMPORTS_PER_SOL));

  // Generate fresh mint
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  // Derive all PDAs
  const { protocolConfig, lpPool } = deriveProtocolPDAs(program.programId);
  const vaultPDA = deriveVaultPDA(program.programId, walletKeypair.publicKey, mint);
  const vaultATA = getAssociatedTokenAddressSync(mint, vaultPDA, true, TOKEN_2022_PROGRAM_ID);
  const pumpPDAs = derivePumpFunPDAs(mint);
  const mayhemPDAs = deriveMayhemPDAs(mint);

  // Read fee_recipient from PumpFun global state
  const globalInfo = await connection.getAccountInfo(pumpPDAs.global);
  if (!globalInfo) {
    console.error("Cannot read PumpFun global account.");
    process.exit(1);
  }
  const feeRecipient = new PublicKey(globalInfo.data.subarray(41, 73));
  const creatorVault = derivePumpCreatorVault(walletKeypair.publicKey);
  const feeConfig = derivePumpFeeConfig();
  const bondingCurveV2 = derivePumpBondingCurveV2(mint);

  // Read treasury from protocol config
  const configData = await (program.account as any).protocolConfig.fetch(protocolConfig);
  const treasury = configData.treasury as PublicKey;

  // Build remaining_accounts: [vaultATA, buyer0_pda, buyer0_ata, buyer0_vol, ...]
  const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [
    { pubkey: vaultATA, isSigner: false, isWritable: true },
  ];

  for (let i = 0; i < numBuyers; i++) {
    const buyerPDA = deriveBuyerPDA(program.programId, vaultPDA, i);
    const buyerATA = getAssociatedTokenAddressSync(mint, buyerPDA, true, TOKEN_2022_PROGRAM_ID);
    const buyerVol = derivePumpUserVolumeAccumulator(buyerPDA);
    remainingAccounts.push({ pubkey: buyerPDA, isSigner: false, isWritable: true });
    remainingAccounts.push({ pubkey: buyerATA, isSigner: false, isWritable: true });
    remainingAccounts.push({ pubkey: buyerVol, isSigner: false, isWritable: true });
  }

  console.log(`Name:              ${name}`);
  console.log(`Symbol:            ${symbol}`);
  console.log(`URI:               ${uri}`);
  console.log(`Mayhem:            ${isMayhem}`);
  console.log(`Mint:              ${mint.toBase58()}`);
  console.log(`LP allocation:     ${lpSol} SOL`);
  console.log(`User contribution: ${contribSol} SOL`);
  console.log(`Buyers:            ${numBuyers}`);
  console.log(`Vault PDA:         ${vaultPDA.toBase58()}`);
  console.log(`Vault ATA:         ${vaultATA.toBase58()}`);
  for (let i = 0; i < numBuyers; i++) {
    const buyerPDA = deriveBuyerPDA(program.programId, vaultPDA, i);
    console.log(`  Buyer ${i}: PDA=${buyerPDA.toBase58().slice(0, 12)}... amount=${buyAmounts[i].toString()} maxSOL=${(maxSolCosts[i].toNumber() / LAMPORTS_PER_SOL).toFixed(4)}`);
  }
  console.log();

  // --- Build instruction (not legacy TX) ---
  const mainIx = await program.methods
    .openPosition(
      name, symbol, uri, isMayhem,
      lpLamports, contribLamports,
      buyAmounts, maxSolCosts
    )
    .accounts({
      user: walletKeypair.publicKey,
      mint,
      vaultState: vaultPDA,
      protocolConfig,
      lpPool,
      treasury,
      insuranceFund: PublicKey.findProgramAddressSync([Buffer.from("insurance_fund")], program.programId)[0],
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
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    } as any)
    .remainingAccounts(remainingAccounts)
    .instruction();

  // --- Get or create ALT with static accounts ---
  const altAddresses = [
    PUMP_FUN_PROGRAM_ID,
    MAYHEM_PROGRAM_ID,
    FEE_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    SystemProgram.programId,
    anchor.web3.SYSVAR_RENT_PUBKEY,
    pumpPDAs.global,
    pumpPDAs.mintAuthority,
    pumpPDAs.eventAuthority,
    pumpPDAs.globalVolumeAccumulator,
    feeConfig,
    mayhemPDAs.globalParams,
    mayhemPDAs.solVault,
    protocolConfig,
    lpPool,
    treasury,
    feeRecipient,
    program.programId,
    ComputeBudgetProgram.programId,
  ];

  const altAddress = await getOrCreateALT(connection, walletKeypair, altAddresses, cluster);
  const altAccount = await connection.getAddressLookupTable(altAddress);
  if (!altAccount.value) {
    console.error("ALT not found or not activated. Try again.");
    process.exit(1);
  }

  // --- Build v0 versioned transaction ---
  const computeIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
  ];

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const messageV0 = new TransactionMessage({
    payerKey: walletKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [...computeIxs, mainIx],
  }).compileToV0Message([altAccount.value]);

  const vTx = new VersionedTransaction(messageV0);
  vTx.sign([walletKeypair, mintKeypair]);

  try {
    const sig = await connection.sendTransaction(vTx, { skipPreflight: false });
    console.log("Confirming...");
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

    const clusterParam = cluster === "mainnet-beta" ? "" : "?cluster=devnet";
    console.log("=== Launch Bundle Complete ===\n");
    console.log(`TX:     ${sig}`);
    console.log(`Mint:   ${mint.toBase58()}`);
    console.log(`Vault:  ${vaultPDA.toBase58()}`);
    console.log(`Status: Active (token created + purchased atomically)`);
    console.log(`\nExplorer:`);
    console.log(`  TX:    https://solscan.io/tx/${sig}${clusterParam}`);
    console.log(`  Token: https://solscan.io/token/${mint.toBase58()}${clusterParam}`);
  } catch (err: any) {
    console.error("Transaction failed:");
    if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
    console.error(err.message || err);
    process.exit(1);
  }
}

async function cmdStatus(flags: Record<string, string | boolean>, keypairPath: string, rpc: string | null, cluster: string) {
  console.log("=== Launch Vault — Protocol Status ===\n");
  const { program, connection } = await setupProvider(keypairPath, rpc, cluster);
  const { protocolConfig, lpPool } = deriveProtocolPDAs(program.programId);

  const configInfo = await connection.getAccountInfo(protocolConfig);
  if (!configInfo) {
    console.log("Protocol NOT initialized yet.");
    console.log(`Expected ProtocolConfig: ${protocolConfig.toBase58()}`);
    return;
  }

  try {
    const config = await (program.account as any).protocolConfig.fetch(protocolConfig);
    const pool = await (program.account as any).lpPool.fetch(lpPool);

    console.log("--- Protocol Config ---");
    console.log(`  Address:           ${protocolConfig.toBase58()}`);
    console.log(`  Admin:             ${(config as any).admin.toBase58()}`);
    console.log(`  Executor:          ${(config as any).executor.toBase58()}`);
    console.log(`  Treasury:          ${(config as any).treasury.toBase58()}`);
    console.log(`  Rental period:     ${(config as any).rentalPeriod.toString()}s`);
    console.log(`  Rental fee rate:   ${(config as any).rentalFeeRate.toString()} lamports`);
    console.log(`  Infrastructure fee: ${(config as any).infrastructureFee.toString()} lamports`);
    console.log(`  Redemption fee:    ${(config as any).redemptionFeeBps} bps`);
    console.log(`  Grace period:      ${(config as any).gracePeriod.toString()}s`);
    console.log(`  Status:            ${JSON.stringify((config as any).status)}`);
    console.log();
    console.log("--- LP Pool ---");
    console.log(`  Address:           ${lpPool.toBase58()}`);
    console.log(`  Authority:         ${(pool as any).authority.toBase58()}`);
    console.log(`  Total liquidity:   ${((pool as any).totalLiquidity.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`  Reserved:          ${((pool as any).reservedLiquidity.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`  Available:         ${((pool as any).availableLiquidity.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  } catch (err: any) {
    console.error("Failed to read state:", err.message || err);
    process.exit(1);
  }
}

// ─── Upload Metadata ─────────────────────────────────────────────────────────

async function cmdUploadMetadata(
  flags: Record<string, string | boolean>,
) {
  const name = flags.name as string;
  const symbol = flags.symbol as string;
  const description = flags.description as string;
  const image = flags.image as string;

  if (!name || !symbol || !description || !image) {
    console.error(
      "Usage: yarn cli upload-metadata --name <NAME> --symbol <SYM> --description <DESC> --image <URL> [--twitter <URL>] [--telegram <URL>] [--website <URL>]"
    );
    process.exit(1);
  }

  const metadata: Record<string, any> = {
    name,
    symbol,
    description,
    image,
    showName: true,
    createdOn: "https://pump.fun",
  };

  if (flags.twitter) metadata.twitter = flags.twitter;
  if (flags.telegram) metadata.telegram = flags.telegram;
  if (flags.website) metadata.website = flags.website;

  console.log(`\n=== Upload Token Metadata ===\n`);
  console.log(JSON.stringify(metadata, null, 2));
  console.log(`\nUploading to jsonblob.com...`);

  try {
    const https = require("https");
    const body = JSON.stringify(metadata);

    const url: string = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "jsonblob.com",
          path: "/api/jsonBlob",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: string) => (data += chunk));
          res.on("end", () => {
            // jsonblob returns 201 with Location header containing the blob URL
            const location = res.headers["location"] as string | undefined;
            if (res.statusCode === 201 && location) {
              const fullUrl = location.startsWith("http")
                ? location
                : `https://jsonblob.com${location}`;
              resolve(fullUrl);
            } else if (res.statusCode >= 200 && res.statusCode < 300) {
              // Fallback: try to extract from response
              resolve(`https://jsonblob.com/api/jsonBlob/${data}`);
            } else {
              reject(new Error(`jsonblob.com HTTP ${res.statusCode}: ${data}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    console.log(`\n=== Metadata Uploaded ===\n`);
    console.log(`URI: ${url}`);
    console.log(`\nUse with launch-bundle:`);
    console.log(`  yarn cli launch-bundle --name "${name}" --symbol "${symbol}" --uri "${url}" ...`);
  } catch (err: any) {
    console.error(`\nUpload failed: ${err.message}`);
    // Fallback: save locally
    const outPath = path.join(process.cwd(), `metadata-${symbol.toLowerCase()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2));
    console.log(`\nSaved locally: ${outPath}`);
    console.log(`Upload manually and use the URL as --uri`);
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { command, flags, keypairPath, rpc, cluster, priorityFee } = parseGlobalArgs();

  if (!command || command === "help") {
    console.log(`
Usage: yarn cli <command> [options]

Commands:
  init              Initialize protocol (ProtocolConfig + LpPool)
  deposit-lp        Deposit SOL to LP pool
  withdraw-lp       Withdraw SOL from LP pool
  create-token      Create token via PumpFun v2 CPI
  create-vault      Create vault for a token
  proxy-buy         Execute token buy via PumpFun v2 (vault → Active)
  launch-bundle     Atomic: create token + vault + buy tokens in one TX
  sell-position     Sell tokens via PumpFun v2 CPI
  upload-metadata   Generate and upload token metadata JSON to IPFS
  status            Show protocol status
  help              Show this help

Global options:
  --keypair <PATH>        Wallet keypair (default: ~/solana-wallet.json)
  --cluster <CLUSTER>     devnet | mainnet-beta (default: devnet)
  --rpc <URL>             Custom RPC endpoint
  --priority-fee <NUM>    Priority fee in microLamports (default: 50000)

Command-specific options:
  init:
    --rental-period <SEC>   Rental period in seconds (default: 86400)
    --rental-fee <LAMP>     Rental fee in lamports (default: 100000)
    --infra-fee <LAMP>      Infrastructure fee in lamports (default: 50000)
    --redeem-bps <BPS>      Redemption fee in bps (default: 250)
    --grace-period <SEC>    Grace period in seconds (default: 3600)

  deposit-lp / withdraw-lp:
    --amount <SOL>          Amount in SOL

  create-token:
    --name <NAME>           Token name
    --symbol <SYMBOL>       Token symbol
    --uri <URI>             Metadata URI
    --mayhem                Enable Mayhem mode

  create-vault:
    --mint <PUBKEY>         Token mint address
    --lp-allocation <SOL>   LP allocation in SOL
    --user-contribution <SOL>  User contribution in SOL

  proxy-buy:
    --mint <PUBKEY>         Token mint address
    --amount <NUM>          Token amount (raw units)
    --max-sol-cost <SOL>    Maximum SOL to spend
    --fee-recipient <PUBKEY>  PumpFun fee recipient (auto-detected from global)

  sell-position:
    --mint <PUBKEY>         Token mint address
    --amount <NUM>          Token amount in raw units (default: sell all)
    --min-sol <SOL>         Minimum SOL output (default: 0)

  launch-bundle:
    --name <NAME>           Token name
    --symbol <SYMBOL>       Token symbol
    --uri <URI>             Metadata URI
    --mayhem                Enable Mayhem mode
    --lp-allocation <SOL>   LP allocation in SOL
    --user-contribution <SOL>  User contribution in SOL
    --buy-amounts <CSV>     Comma-separated token amounts (raw units)
    --max-sol-costs <CSV>   Comma-separated max SOL per buyer

  upload-metadata:
    --name <NAME>           Token name
    --symbol <SYMBOL>       Token symbol
    --description <DESC>    Token description
    --image <URL>           Image URL
    --twitter <URL>         Twitter link (optional)
    --telegram <URL>        Telegram link (optional)
    --website <URL>         Website link (optional)
`);
    return;
  }

  switch (command) {
    case "init":
      await cmdInit(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "deposit-lp":
      await cmdDepositLp(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "withdraw-lp":
      await cmdWithdrawLp(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "create-token":
      await cmdCreateToken(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "create-vault":
      await cmdCreateVault(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "proxy-buy":
      await cmdProxyBuy(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "launch-bundle":
      await cmdLaunchBundle(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "sell-position":
      await cmdSellPosition(flags, keypairPath, rpc, cluster, priorityFee);
      break;
    case "upload-metadata":
      await cmdUploadMetadata(flags);
      break;
    case "status":
      await cmdStatus(flags, keypairPath, rpc, cluster);
      break;
    default:
      console.error(`Unknown command: ${command}. Run 'yarn cli help' for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
