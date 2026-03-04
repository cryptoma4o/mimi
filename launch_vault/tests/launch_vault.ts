import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LaunchVault } from "../target/types/launch_vault";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";

describe("launch_vault", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.launchVault as Program<LaunchVault>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const PUMP_FUN_PROGRAM_ID = new PublicKey(
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
  );
  const MAYHEM_PROGRAM_ID = new PublicKey(
    "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e"
  );
  const TOKEN_2022_PROGRAM_ID = new PublicKey(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  );

  // --- PDA helpers ---

  function deriveProtocolPDAs() {
    const [protocolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      program.programId
    );
    const [lpPool] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_pool")],
      program.programId
    );
    return { protocolConfig, lpPool };
  }

  function deriveVaultPDA(user: PublicKey, mint: PublicKey) {
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.toBuffer(), mint.toBuffer()],
      program.programId
    );
    return vault;
  }

  function derivePumpPDAs(mint: PublicKey) {
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
    return { global, mintAuthority, bondingCurve, eventAuthority };
  }

  // --- Structural tests ---
  // These verify instruction building without executing CPI (no PumpFun on localnet).

  it("builds initialize_protocol instruction correctly", async () => {
    const { protocolConfig, lpPool } = deriveProtocolPDAs();
    const executor = Keypair.generate().publicKey;
    const treasury = Keypair.generate().publicKey;

    const ix = await program.methods
      .initializeProtocol(
        executor,
        treasury,
        new anchor.BN(86400),
        new anchor.BN(100_000),
        new anchor.BN(50_000),
        250,
        new anchor.BN(3600)
      )
      .accounts({
        admin: provider.wallet.publicKey,
        protocolConfig,
        lpPool,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
    expect(ix.keys.length).to.equal(4);
  });

  it("builds proxy_create_token instruction correctly", async () => {
    const mint = Keypair.generate();
    const pdas = derivePumpPDAs(mint.publicKey);

    // Structural test: verifies instruction can be built.
    // Full CPI test requires PumpFun deployed on localnet.
    const ix = await program.methods
      .proxyCreateToken(
        "TestToken",
        "TEST",
        "https://example.com/meta.json",
        false
      )
      .accounts({
        user: provider.wallet.publicKey,
        mint: mint.publicKey,
        pumpProgram: PUMP_FUN_PROGRAM_ID,
        pumpGlobal: pdas.global,
        pumpMintAuthority: pdas.mintAuthority,
        pumpBondingCurve: pdas.bondingCurve,
        pumpAssociatedBondingCurve: pdas.bondingCurve,
        mayhemProgram: MAYHEM_PROGRAM_ID,
        mayhemGlobalParams: PublicKey.default,
        mayhemSolVault: PublicKey.default,
        mayhemState: PublicKey.default,
        mayhemTokenVault: PublicKey.default,
        pumpEventAuthority: pdas.eventAuthority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
    expect(ix.keys.length).to.equal(16);
  });

  it("builds deposit_lp instruction correctly", async () => {
    const { lpPool } = deriveProtocolPDAs();

    const ix = await program.methods
      .depositLp(new anchor.BN(1_000_000_000))
      .accounts({
        authority: provider.wallet.publicKey,
        lpPool,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
    expect(ix.keys.length).to.equal(3);
  });

  it("builds create_vault instruction correctly", async () => {
    const mint = Keypair.generate();
    const { protocolConfig, lpPool } = deriveProtocolPDAs();
    const vault = deriveVaultPDA(provider.wallet.publicKey, mint.publicKey);
    const treasury = Keypair.generate().publicKey;

    const ix = await program.methods
      .createVault(new anchor.BN(500_000_000), new anchor.BN(100_000_000))
      .accounts({
        user: provider.wallet.publicKey,
        tokenMint: mint.publicKey,
        vaultState: vault,
        vaultTokenAccount: PublicKey.default,
        protocolConfig,
        lpPool,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
    expect(ix.keys.length).to.equal(10);
  });

  it("derives consistent PDAs", () => {
    const { protocolConfig, lpPool } = deriveProtocolPDAs();

    // PDAs should be deterministic
    const { protocolConfig: pc2, lpPool: lp2 } = deriveProtocolPDAs();
    expect(protocolConfig.toBase58()).to.equal(pc2.toBase58());
    expect(lpPool.toBase58()).to.equal(lp2.toBase58());

    // Vault PDA depends on user + mint
    const user = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const v1 = deriveVaultPDA(user, mint);
    const v2 = deriveVaultPDA(user, mint);
    expect(v1.toBase58()).to.equal(v2.toBase58());

    // Different user/mint -> different vault PDA
    const otherUser = Keypair.generate().publicKey;
    const v3 = deriveVaultPDA(otherUser, mint);
    expect(v1.toBase58()).to.not.equal(v3.toBase58());
  });
});
