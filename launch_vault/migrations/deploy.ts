import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

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
  const [insuranceFund] = PublicKey.findProgramAddressSync(
    [Buffer.from("insurance_fund")],
    program.programId
  );
  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint")],
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
      admin,                          // executor (default: admin)
      admin,                          // treasury (default: admin)
      new anchor.BN(10_000_000),      // fixed_fee: 0.01 SOL
      200,                            // fee_bps: 2%
      8500,                           // max_utilization_bps: 85%
      new anchor.BN(3600),            // position_timeout: 1 hour
      100,                            // close_reward_bps: 1%
      2000,                           // insurance_split_bps: 20%
      250,                            // redemption_fee_bps: 2.5%
    )
    .accounts({
      admin,
      protocolConfig,
      lpPool,
      insuranceFund,
      lpMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log("Protocol initialized. TX:", tx);
};
