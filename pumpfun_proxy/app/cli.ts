import * as anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
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
// ─── CLI Argument Parsing ────────────────────────────────────────────────────

interface CliArgs {
  name: string;
  symbol: string;
  uri: string;
  mayhem: boolean;
  cluster: "devnet" | "mainnet-beta";
  keypair: string;
  rpc: string | null;
  priorityFee: number;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--mayhem") {
      parsed.mayhem = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg.startsWith("--") && i + 1 < args.length) {
      const key = arg.slice(2);
      parsed[key] = args[++i];
    }
  }

  if (!parsed.name || !parsed.symbol || !parsed.uri) {
    console.error(
      `Usage: ts-node app/cli.ts --name <NAME> --symbol <SYMBOL> --uri <URI> [options]

Required:
  --name <NAME>       Token name
  --symbol <SYMBOL>   Token symbol
  --uri <URI>         Metadata URI (JSON)

Options:
  --mayhem                Enable Mayhem mode (default: false)
  --cluster <CLUSTER>     devnet | mainnet (default: devnet)
  --keypair <PATH>        Path to wallet keypair JSON (default: ~/solana-wallet.json)
  --rpc <URL>             Custom RPC endpoint (recommended for mainnet)
  --priority-fee <NUM>    Priority fee in microLamports (default: 50000)
  --dry-run               Build transaction but don't send it`
    );
    process.exit(1);
  }

  const clusterInput = (parsed.cluster as string) || "devnet";
  const cluster =
    clusterInput === "mainnet" ? "mainnet-beta" : (clusterInput as "devnet" | "mainnet-beta");

  return {
    name: parsed.name as string,
    symbol: parsed.symbol as string,
    uri: parsed.uri as string,
    mayhem: !!parsed.mayhem,
    cluster,
    keypair:
      (parsed.keypair as string) ||
      path.join(os.homedir(), "solana-wallet.json"),
    rpc: (parsed.rpc as string) || null,
    priorityFee: parsed["priority-fee"]
      ? parseInt(parsed["priority-fee"] as string, 10)
      : 50_000,
    dryRun: !!parsed.dryRun,
  };
}

// ─── PDA Derivation ──────────────────────────────────────────────────────────

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
    true, // allowOwnerOffCurve
    TOKEN_2022_PROGRAM_ID
  );

  return { global, mintAuthority, bondingCurve, eventAuthority, associatedBondingCurve };
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
    true, // allowOwnerOffCurve
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  console.log(`\n=== PumpFun Proxy — Create Token ===\n`);
  console.log(`Name:     ${args.name}`);
  console.log(`Symbol:   ${args.symbol}`);
  console.log(`URI:      ${args.uri}`);
  console.log(`Mayhem:   ${args.mayhem}`);
  console.log(`Cluster:  ${args.cluster}`);
  console.log(`Keypair:  ${args.keypair}`);
  console.log(`RPC:      ${args.rpc || "default"}`);
  console.log(`Priority: ${args.priorityFee} microLamports`);
  console.log();

  // Load wallet
  const walletKeypair = loadKeypair(args.keypair);
  console.log(`Wallet:   ${walletKeypair.publicKey.toBase58()}`);

  // Connection
  const rpcUrl = args.rpc || clusterApiUrl(args.cluster);
  const connection = new Connection(rpcUrl, "confirmed");

  // Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance:  ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.05 * 1e9) {
    console.error("\nInsufficient balance. Need at least 0.05 SOL.");
    process.exit(1);
  }

  // Provider & Program
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const idlPath = path.join(__dirname, "..", "target", "idl", "pumpfun_proxy.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, provider);

  // Generate fresh mint keypair
  const mintKeypair = Keypair.generate();
  console.log(`Mint:     ${mintKeypair.publicKey.toBase58()}`);

  // Derive all PDAs
  const pumpPDAs = derivePumpFunPDAs(mintKeypair.publicKey);
  const mayhemPDAs = deriveMayhemPDAs(mintKeypair.publicKey);

  console.log(`\n--- Derived Accounts ---`);
  console.log(`Global:          ${pumpPDAs.global.toBase58()}`);
  console.log(`Mint Authority:  ${pumpPDAs.mintAuthority.toBase58()}`);
  console.log(`Bonding Curve:   ${pumpPDAs.bondingCurve.toBase58()}`);
  console.log(`Assoc BC:        ${pumpPDAs.associatedBondingCurve.toBase58()}`);
  console.log(`Event Auth:      ${pumpPDAs.eventAuthority.toBase58()}`);
  console.log(`Mayhem Global:   ${mayhemPDAs.globalParams.toBase58()}`);
  console.log(`Mayhem Vault:    ${mayhemPDAs.solVault.toBase58()}`);
  console.log(`Mayhem State:    ${mayhemPDAs.state.toBase58()}`);
  console.log(`Mayhem TknVault: ${mayhemPDAs.tokenVault.toBase58()}`);

  // Compute budget pre-instructions
  const preInstructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: args.priorityFee }),
  ];

  // Common accounts object
  const accounts = {
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
  };

  if (args.dryRun) {
    console.log(`\n[DRY RUN] Transaction built but not sent.`);

    const ix = await program.methods
      .createToken(args.name, args.symbol, args.uri, args.mayhem)
      .accounts(accounts)
      .instruction();

    console.log(`Instruction keys: ${ix.keys.length}`);
    console.log(`Data length: ${ix.data.length} bytes`);
    console.log(`Pre-instructions: ${preInstructions.length} (ComputeBudget)`);
    return;
  }

  // Send transaction
  console.log(`\nSending transaction...`);

  try {
    const txSig = await program.methods
      .createToken(args.name, args.symbol, args.uri, args.mayhem)
      .accounts(accounts)
      .preInstructions(preInstructions)
      .signers([mintKeypair])
      .rpc({ commitment: "confirmed" });

    const explorerBase =
      args.cluster === "mainnet-beta"
        ? "https://solscan.io"
        : "https://solscan.io";
    const clusterParam =
      args.cluster === "mainnet-beta" ? "" : "?cluster=devnet";

    console.log(`\n=== Token Created Successfully ===\n`);
    console.log(`TX:   ${txSig}`);
    console.log(`Mint: ${mintKeypair.publicKey.toBase58()}`);
    console.log(`\nExplorer:`);
    console.log(`  TX:    ${explorerBase}/tx/${txSig}${clusterParam}`);
    console.log(`  Token: ${explorerBase}/token/${mintKeypair.publicKey.toBase58()}${clusterParam}`);
  } catch (err: any) {
    console.error(`\nTransaction failed:`);
    if (err.logs) {
      console.error(`\nProgram logs:`);
      for (const log of err.logs) {
        console.error(`  ${log}`);
      }
    }
    console.error(`\n${err.message || err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
