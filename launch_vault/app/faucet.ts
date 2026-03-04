import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Config ──────────────────────────────────────────────────────────────────

const AIRDROP_AMOUNT = 1 * LAMPORTS_PER_SOL; // 1 SOL per request
const RETRY_DELAY_MS = 20_000; // 20s between retries on rate-limit
const SUCCESS_DELAY_MS = 3_000; // 3s between successful airdrops
const RESERVE_SOL = 0.05; // Keep some SOL for tx fees

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[++i];
    }
  }
  return {
    target: parseFloat(flags.target || "1000"),
    keypair: flags.keypair || path.join(os.homedir(), "solana-wallet.json"),
    rpc: flags.rpc || null,
    deposit: flags.deposit !== "false", // auto-deposit by default
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const walletKeypair = loadKeypair(args.keypair);
  const rpcUrl = args.rpc || clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");

  console.log(`=== Devnet Faucet — Target: ${args.target} SOL ===\n`);
  console.log(`Wallet:  ${walletKeypair.publicKey.toBase58()}`);
  console.log(`RPC:     ${rpcUrl}`);

  const targetLamports = args.target * LAMPORTS_PER_SOL;
  let airdropCount = 0;
  let failCount = 0;

  while (true) {
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;

    if (balance >= targetLamports) {
      console.log(`\n=== Target reached: ${balanceSol.toFixed(2)} SOL ===`);
      break;
    }

    const remaining = (targetLamports - balance) / LAMPORTS_PER_SOL;
    process.stdout.write(
      `[${new Date().toLocaleTimeString()}] Balance: ${balanceSol.toFixed(2)} SOL | ` +
      `Remaining: ${remaining.toFixed(2)} SOL | ` +
      `Airdrops: ${airdropCount} ok / ${failCount} fail ... `
    );

    try {
      const sig = await connection.requestAirdrop(
        walletKeypair.publicKey,
        AIRDROP_AMOUNT
      );
      await connection.confirmTransaction(sig, "confirmed");
      airdropCount++;
      console.log(`+1 SOL ✓`);
      await sleep(SUCCESS_DELAY_MS);
    } catch (err: any) {
      failCount++;
      const msg = err.message || String(err);
      if (msg.includes("rate") || msg.includes("429") || msg.includes("airdrop")) {
        console.log(`rate-limited, waiting ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.log(`error: ${msg.slice(0, 80)}, retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // Auto-deposit to LP pool
  if (args.deposit) {
    console.log(`\nDepositing to LP pool...`);

    const balance = await connection.getBalance(walletKeypair.publicKey);
    const depositLamports = balance - Math.floor(RESERVE_SOL * LAMPORTS_PER_SOL);

    if (depositLamports <= 0) {
      console.error("Not enough balance after reserves for deposit.");
      return;
    }

    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    const idlPath = path.join(__dirname, "..", "target", "idl", "launch_vault.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    const program = new anchor.Program(idl, provider);

    const [lpPool] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_pool")],
      program.programId
    );

    const depositSol = depositLamports / LAMPORTS_PER_SOL;
    console.log(`Depositing ${depositSol.toFixed(4)} SOL to LP pool...`);

    try {
      const tx = await program.methods
        .depositLp(new anchor.BN(depositLamports))
        .accounts({
          authority: walletKeypair.publicKey,
          lpPool,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      console.log(`\n=== LP Deposit Complete ===`);
      console.log(`TX:      ${tx}`);
      console.log(`Amount:  ${depositSol.toFixed(4)} SOL`);
      console.log(`Explorer: https://solscan.io/tx/${tx}?cluster=devnet`);
    } catch (err: any) {
      console.error("Deposit failed:");
      if (err.logs) err.logs.forEach((l: string) => console.error(`  ${l}`));
      console.error(err.message || err);
      process.exit(1);
    }
  }

  const finalBalance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`\nFinal wallet balance: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
