import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/launch_vault.json", "utf-8")
  );
  const program = new anchor.Program(idl, provider);

  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    program.programId
  );
  const [lpPool] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_pool")],
    program.programId
  );

  // Check if already initialized
  const configAccount = await provider.connection.getAccountInfo(protocolConfig);
  if (configAccount) {
    console.log("Protocol already initialized, skipping.");
    return;
  }

  const admin = provider.wallet.publicKey;
  console.log("Initializing launch_vault protocol...");
  console.log("  Admin/Executor/Treasury:", admin.toBase58());

  const tx = await program.methods
    .initializeProtocol(
      admin,                       // executor (default: admin)
      admin,                       // treasury (default: admin)
      new anchor.BN(86400),        // rental_period: 24h
      new anchor.BN(100_000),      // rental_fee_rate: 0.0001 SOL
      new anchor.BN(50_000),       // infrastructure_fee: 0.00005 SOL
      250,                         // redemption_fee_bps: 2.5%
      new anchor.BN(3600),         // grace_period: 1h
    )
    .accounts({
      admin,
      protocolConfig,
      lpPool,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Protocol initialized. TX:", tx);
};
