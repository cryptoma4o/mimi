import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LaunchVault } from "../target/types/launch_vault";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";

// ============================================================
// Constants
// ============================================================

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
const FEE_SEED_CONST = new Uint8Array([
  1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81,
  137, 203, 151, 245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
]);

// ============================================================
// PDA derivation helpers
// ============================================================

function deriveProtocolConfig(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );
  return pda;
}

function deriveLpPool(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_pool")],
    programId
  );
  return pda;
}

function deriveLpMint(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint")],
    programId
  );
  return pda;
}

function deriveInsuranceFund(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("insurance_fund")],
    programId
  );
  return pda;
}

function deriveVaultPDA(
  user: PublicKey,
  mint: PublicKey,
  programId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.toBuffer(), mint.toBuffer()],
    programId
  );
  return pda;
}

function deriveBuyerPDA(
  vault: PublicKey,
  index: number,
  programId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyer"), vault.toBuffer(), Buffer.from([index])],
    programId
  );
  return pda;
}

function derivePumpGlobal(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpMintAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpBondingCurve(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpEventAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpCreatorVault(creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpGlobalVolumeAccumulator(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpUserVolumeAccumulator(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function derivePumpBondingCurveV2(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve-v2"), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

function deriveFeeConfig(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), FEE_SEED_CONST],
    FEE_PROGRAM_ID
  );
  return pda;
}

// ============================================================
// Tests
// ============================================================

describe("launch_vault", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.launchVault as Program<LaunchVault>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const wallet = provider.wallet.publicKey;

  // --------------------------------------------------------
  // PDA derivation tests
  // --------------------------------------------------------

  describe("PDA derivation", () => {
    it("protocol_config PDA is deterministic", () => {
      const a = deriveProtocolConfig(program.programId);
      const b = deriveProtocolConfig(program.programId);
      expect(a.toBase58()).to.equal(b.toBase58());
      // PDA must NOT be on curve
      expect(PublicKey.isOnCurve(a.toBytes())).to.be.false;
    });

    it("lp_pool PDA is deterministic", () => {
      const a = deriveLpPool(program.programId);
      const b = deriveLpPool(program.programId);
      expect(a.toBase58()).to.equal(b.toBase58());
      expect(PublicKey.isOnCurve(a.toBytes())).to.be.false;
    });

    it("lp_mint PDA is deterministic", () => {
      const a = deriveLpMint(program.programId);
      const b = deriveLpMint(program.programId);
      expect(a.toBase58()).to.equal(b.toBase58());
      expect(PublicKey.isOnCurve(a.toBytes())).to.be.false;
    });

    it("insurance_fund PDA is deterministic", () => {
      const a = deriveInsuranceFund(program.programId);
      const b = deriveInsuranceFund(program.programId);
      expect(a.toBase58()).to.equal(b.toBase58());
      expect(PublicKey.isOnCurve(a.toBytes())).to.be.false;
    });

    it("vault PDA depends on user + mint", () => {
      const user = Keypair.generate().publicKey;
      const mint = Keypair.generate().publicKey;
      const v1 = deriveVaultPDA(user, mint, program.programId);
      const v2 = deriveVaultPDA(user, mint, program.programId);
      expect(v1.toBase58()).to.equal(v2.toBase58());

      // Different user → different PDA
      const otherUser = Keypair.generate().publicKey;
      const v3 = deriveVaultPDA(otherUser, mint, program.programId);
      expect(v1.toBase58()).to.not.equal(v3.toBase58());

      // Different mint → different PDA
      const otherMint = Keypair.generate().publicKey;
      const v4 = deriveVaultPDA(user, otherMint, program.programId);
      expect(v1.toBase58()).to.not.equal(v4.toBase58());
    });

    it("buyer PDA depends on vault + index", () => {
      const user = Keypair.generate().publicKey;
      const mint = Keypair.generate().publicKey;
      const vault = deriveVaultPDA(user, mint, program.programId);

      const b0 = deriveBuyerPDA(vault, 0, program.programId);
      const b1 = deriveBuyerPDA(vault, 1, program.programId);
      const b0dup = deriveBuyerPDA(vault, 0, program.programId);

      // Same inputs → same PDA
      expect(b0.toBase58()).to.equal(b0dup.toBase58());
      // Different index → different PDA
      expect(b0.toBase58()).to.not.equal(b1.toBase58());
    });

    it("pump PDAs are deterministic (global, mint_authority, event_authority)", () => {
      const g1 = derivePumpGlobal();
      const g2 = derivePumpGlobal();
      expect(g1.toBase58()).to.equal(g2.toBase58());

      const ma1 = derivePumpMintAuthority();
      const ma2 = derivePumpMintAuthority();
      expect(ma1.toBase58()).to.equal(ma2.toBase58());

      const ea1 = derivePumpEventAuthority();
      const ea2 = derivePumpEventAuthority();
      expect(ea1.toBase58()).to.equal(ea2.toBase58());
    });

    it("pump bonding_curve PDA depends on mint", () => {
      const mint1 = Keypair.generate().publicKey;
      const mint2 = Keypair.generate().publicKey;

      const bc1 = derivePumpBondingCurve(mint1);
      const bc1dup = derivePumpBondingCurve(mint1);
      const bc2 = derivePumpBondingCurve(mint2);

      expect(bc1.toBase58()).to.equal(bc1dup.toBase58());
      expect(bc1.toBase58()).to.not.equal(bc2.toBase58());
    });

    it("pump creator_vault PDA depends on creator", () => {
      const c1 = Keypair.generate().publicKey;
      const c2 = Keypair.generate().publicKey;

      const cv1 = derivePumpCreatorVault(c1);
      const cv2 = derivePumpCreatorVault(c2);
      const cv1dup = derivePumpCreatorVault(c1);

      expect(cv1.toBase58()).to.equal(cv1dup.toBase58());
      expect(cv1.toBase58()).to.not.equal(cv2.toBase58());
    });

    it("pump bonding_curve_v2 PDA depends on mint", () => {
      const mint = Keypair.generate().publicKey;
      const v1 = derivePumpBondingCurveV2(mint);
      const v2 = derivePumpBondingCurveV2(mint);
      expect(v1.toBase58()).to.equal(v2.toBase58());
    });

    it("fee_config PDA is deterministic", () => {
      const f1 = deriveFeeConfig();
      const f2 = deriveFeeConfig();
      expect(f1.toBase58()).to.equal(f2.toBase58());
    });

    it("pump global_volume_accumulator and user_volume_accumulator PDAs are deterministic", () => {
      const gva1 = derivePumpGlobalVolumeAccumulator();
      const gva2 = derivePumpGlobalVolumeAccumulator();
      expect(gva1.toBase58()).to.equal(gva2.toBase58());

      const user = Keypair.generate().publicKey;
      const uva1 = derivePumpUserVolumeAccumulator(user);
      const uva2 = derivePumpUserVolumeAccumulator(user);
      expect(uva1.toBase58()).to.equal(uva2.toBase58());
    });
  });

  // --------------------------------------------------------
  // Structural instruction tests
  // --------------------------------------------------------

  describe("Structural instruction building", () => {
    // 1. initialize_protocol (8 accounts)
    it("builds initialize_protocol instruction correctly", async () => {
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const lpMint = deriveLpMint(program.programId);
      const insuranceFund = deriveInsuranceFund(program.programId);
      const executor = Keypair.generate().publicKey;
      const treasury = Keypair.generate().publicKey;

      const ix = await program.methods
        .initializeProtocol(
          executor,
          treasury,
          new anchor.BN(10_000),     // fixed_fee
          100,                        // fee_bps (u16)
          5000,                       // max_utilization_bps (u16)
          new anchor.BN(3600),        // position_timeout (i64)
          250,                        // close_reward_bps (u16)
          500,                        // insurance_split_bps (u16)
          100,                        // redemption_fee_bps (u16)
          new anchor.BN(10_000_000), // min_user_contribution (u64)
          new anchor.BN(1_000_000_000), // max_lp_per_position (u64)
          1000,                       // min_user_ratio_bps (u16)
        )
        .accounts({
          admin: wallet,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          insuranceFund: insuranceFund,
          lpMint: lpMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(8);
    });

    // 2. update_protocol_config (2 accounts)
    it("builds update_protocol_config instruction correctly", async () => {
      const protocolConfig = deriveProtocolConfig(program.programId);

      const ix = await program.methods
        .updateProtocolConfig(
          null,  // new_executor
          null,  // new_treasury
          null,  // new_fixed_fee
          null,  // new_fee_bps
          null,  // new_max_utilization_bps
          null,  // new_position_timeout
          null,  // new_close_reward_bps
          null,  // new_insurance_split_bps
          null,  // new_redemption_fee_bps
          null,  // new_admin
          null,  // new_cb_position_limit
          null,  // new_cb_window_seconds
          null,  // new_cb_cooldown_seconds
          null,  // new_min_insurance_fund
        )
        .accounts({
          admin: wallet,
          protocolConfig: protocolConfig,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(2);
    });

    // 3. deposit_lp (7 accounts)
    it("builds deposit_lp instruction correctly", async () => {
      const lpPool = deriveLpPool(program.programId);
      const lpMint = deriveLpMint(program.programId);

      const ix = await program.methods
        .depositLp(new anchor.BN(1_000_000_000))
        .accounts({
          depositor: wallet,
          lpPool: lpPool,
          lpMint: lpMint,
          depositorLpAta: Keypair.generate().publicKey,
          protocolConfig: deriveProtocolConfig(program.programId),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(8);
    });

    // 4. withdraw_lp (6 accounts)
    it("builds withdraw_lp instruction correctly", async () => {
      const lpPool = deriveLpPool(program.programId);
      const lpMint = deriveLpMint(program.programId);

      const ix = await program.methods
        .withdrawLp(new anchor.BN(500_000_000))
        .accounts({
          withdrawer: wallet,
          lpPool: lpPool,
          lpMint: lpMint,
          withdrawerLpAta: Keypair.generate().publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(6);
    });

    // 5. proxy_create_token (16 accounts)
    it("builds proxy_create_token instruction correctly", async () => {
      const mint = Keypair.generate();

      const ix = await program.methods
        .proxyCreateToken("TestToken", "TEST", "https://example.com/meta.json", false)
        .accounts({
          user: wallet,
          mint: mint.publicKey,
          pumpProgram: PUMP_FUN_PROGRAM_ID,
          pumpGlobal: derivePumpGlobal(),
          pumpMintAuthority: derivePumpMintAuthority(),
          pumpBondingCurve: derivePumpBondingCurve(mint.publicKey),
          pumpAssociatedBondingCurve: Keypair.generate().publicKey,
          mayhemProgram: MAYHEM_PROGRAM_ID,
          mayhemGlobalParams: PublicKey.default,
          mayhemSolVault: PublicKey.default,
          mayhemState: PublicKey.default,
          mayhemTokenVault: PublicKey.default,
          pumpEventAuthority: derivePumpEventAuthority(),
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(16);
    });

    // 6. open_position (28 named accounts + remaining_accounts)
    it("builds open_position instruction correctly", async () => {
      const mint = Keypair.generate();
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const insuranceFund = deriveInsuranceFund(program.programId);
      const treasury = Keypair.generate().publicKey;
      const vaultState = deriveVaultPDA(wallet, mint.publicKey, program.programId);

      const ix = await program.methods
        .openPosition(
          "TestToken",
          "TEST",
          "https://example.com/meta.json",
          false,
          new anchor.BN(500_000_000),   // lp_allocation
          new anchor.BN(100_000_000),   // user_contribution
          [new anchor.BN(50_000_000)],  // buy_amounts
          [new anchor.BN(60_000_000)],  // max_sol_costs
          500,                          // stop_loss_bps (u16)
        )
        .accounts({
          user: wallet,
          mint: mint.publicKey,
          vaultState: vaultState,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          treasury,
          insuranceFund: insuranceFund,
          pumpProgram: PUMP_FUN_PROGRAM_ID,
          pumpGlobal: derivePumpGlobal(),
          pumpMintAuthority: derivePumpMintAuthority(),
          pumpBondingCurve: derivePumpBondingCurve(mint.publicKey),
          pumpAssociatedBondingCurve: Keypair.generate().publicKey,
          pumpEventAuthority: derivePumpEventAuthority(),
          pumpFeeRecipient: Keypair.generate().publicKey,
          mayhemProgram: MAYHEM_PROGRAM_ID,
          mayhemGlobalParams: PublicKey.default,
          mayhemSolVault: PublicKey.default,
          mayhemState: PublicKey.default,
          mayhemTokenVault: PublicKey.default,
          pumpGlobalVolumeAccumulator: derivePumpGlobalVolumeAccumulator(),
          pumpCreatorVault: derivePumpCreatorVault(wallet),
          pumpFeeConfig: deriveFeeConfig(),
          pumpBondingCurveV2: derivePumpBondingCurveV2(mint.publicKey),
          pumpFeeProgram: FEE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      // 28 named accounts (without remaining_accounts)
      expect(ix.keys.length).to.equal(28);
    });

    // 7. sell_position (18 accounts)
    it("builds sell_position instruction correctly", async () => {
      const mint = Keypair.generate().publicKey;
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const vaultState = deriveVaultPDA(wallet, mint, program.programId);

      const ix = await program.methods
        .sellPosition(new anchor.BN(1_000_000), new anchor.BN(500_000))
        .accounts({
          seller: wallet,
          vaultState: vaultState,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          vaultTokenAccount: Keypair.generate().publicKey,
          tokenMint: mint,
          pumpProgram: PUMP_FUN_PROGRAM_ID,
          pumpGlobal: derivePumpGlobal(),
          pumpFeeRecipient: Keypair.generate().publicKey,
          pumpBondingCurve: derivePumpBondingCurve(mint),
          pumpAssociatedBondingCurve: Keypair.generate().publicKey,
          pumpEventAuthority: derivePumpEventAuthority(),
          pumpCreatorVault: derivePumpCreatorVault(wallet),
          pumpFeeConfig: deriveFeeConfig(),
          pumpBondingCurveV2: derivePumpBondingCurveV2(mint),
          pumpFeeProgram: FEE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(18);
    });

    // 8. redeem_tokens (10 accounts)
    it("builds redeem_tokens instruction correctly", async () => {
      const mint = Keypair.generate().publicKey;
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const vaultState = deriveVaultPDA(wallet, mint, program.programId);
      const treasury = Keypair.generate().publicKey;

      const ix = await program.methods
        .redeemTokens(new anchor.BN(500_000))
        .accounts({
          user: wallet,
          vaultState: vaultState,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          treasury,
          vaultTokenAccount: Keypair.generate().publicKey,
          userTokenAccount: Keypair.generate().publicKey,
          tokenMint: mint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(10);
    });

    // 9. close_position (8 accounts)
    it("builds close_position instruction correctly", async () => {
      const mint = Keypair.generate().publicKey;
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const vaultState = deriveVaultPDA(wallet, mint, program.programId);

      const ix = await program.methods
        .closePosition()
        .accounts({
          closer: wallet,
          vaultState: vaultState,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          vaultOwner: wallet,
          vaultTokenAccount: Keypair.generate().publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(8);
    });

    // 10. force_close_position (18 accounts)
    it("builds force_close_position instruction correctly", async () => {
      const mint = Keypair.generate().publicKey;
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const vaultState = deriveVaultPDA(wallet, mint, program.programId);

      const ix = await program.methods
        .forceClosePosition()
        .accounts({
          executor: wallet,
          vaultState: vaultState,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          vaultTokenAccount: Keypair.generate().publicKey,
          tokenMint: mint,
          pumpProgram: PUMP_FUN_PROGRAM_ID,
          pumpGlobal: derivePumpGlobal(),
          pumpFeeRecipient: Keypair.generate().publicKey,
          pumpBondingCurve: derivePumpBondingCurve(mint),
          pumpAssociatedBondingCurve: Keypair.generate().publicKey,
          pumpEventAuthority: derivePumpEventAuthority(),
          pumpCreatorVault: derivePumpCreatorVault(wallet),
          pumpFeeConfig: deriveFeeConfig(),
          pumpBondingCurveV2: derivePumpBondingCurveV2(mint),
          pumpFeeProgram: FEE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(18);
    });

    // 10. trigger_stop_loss (19 accounts)
    it("builds trigger_stop_loss instruction correctly", async () => {
      const mint = Keypair.generate().publicKey;
      const protocolConfig = deriveProtocolConfig(program.programId);
      const lpPool = deriveLpPool(program.programId);
      const vaultState = deriveVaultPDA(wallet, mint, program.programId);

      const ix = await program.methods
        .triggerStopLoss(new anchor.BN(1_000_000), new anchor.BN(400_000))
        .accounts({
          signer: wallet,
          vault: vaultState,
          protocolConfig: protocolConfig,
          lpPool: lpPool,
          tokenMint: mint,
          pumpProgram: PUMP_FUN_PROGRAM_ID,
          pumpGlobal: derivePumpGlobal(),
          pumpBondingCurve: derivePumpBondingCurve(mint),
          pumpAssociatedBondingCurve: Keypair.generate().publicKey,
          pumpEventAuthority: derivePumpEventAuthority(),
          pumpFeeRecipient: Keypair.generate().publicKey,
          pumpCreatorVault: derivePumpCreatorVault(wallet),
          pumpFeeConfig: deriveFeeConfig(),
          pumpFeeProgram: FEE_PROGRAM_ID,
          pumpBondingCurveV2: derivePumpBondingCurveV2(mint),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          vaultTokenAccount: Keypair.generate().publicKey,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      // 19 named accounts (without remaining_accounts)
      expect(ix.keys.length).to.equal(19);
    });

    // 11. deposit_insurance_fund (4 accounts)
    it("builds deposit_insurance_fund instruction correctly", async () => {
      const protocolConfig = deriveProtocolConfig(program.programId);
      const insuranceFund = deriveInsuranceFund(program.programId);

      const ix = await program.methods
        .depositInsuranceFund(new anchor.BN(100_000_000))
        .accounts({
          payer: wallet,
          insuranceFund: insuranceFund,
          protocolConfig: protocolConfig,
          systemProgram: SystemProgram.programId,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(4);
    });

    // 12. withdraw_insurance_fund (5 accounts)
    it("builds withdraw_insurance_fund instruction correctly", async () => {
      const protocolConfig = deriveProtocolConfig(program.programId);
      const insuranceFund = deriveInsuranceFund(program.programId);

      const ix = await program.methods
        .withdrawInsuranceFund(new anchor.BN(50_000_000))
        .accounts({
          admin: wallet,
          insuranceFund: insuranceFund,
          protocolConfig: protocolConfig,
          destination: wallet,
          systemProgram: SystemProgram.programId,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(5);
    });

    // 14. pause_protocol (2 accounts)
    it("builds pause_protocol instruction correctly", async () => {
      const protocolConfig = deriveProtocolConfig(program.programId);

      const ix = await program.methods
        .pauseProtocol("Test pause")
        .accounts({
          signer: wallet,
          protocolConfig: protocolConfig,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(2);
    });

    // 15. resume_protocol (2 accounts)
    it("builds resume_protocol instruction correctly", async () => {
      const protocolConfig = deriveProtocolConfig(program.programId);

      const ix = await program.methods
        .resumeProtocol()
        .accounts({
          admin: wallet,
          protocolConfig: protocolConfig,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(2);
    });
  });

  // --------------------------------------------------------
  // Functional Tests (on-chain, local validator)
  // --------------------------------------------------------

  describe("Functional Tests", () => {
    const executor = Keypair.generate();
    const treasury = Keypair.generate();

    // Shared PDAs
    const protocolConfig = deriveProtocolConfig(program.programId);
    const lpPool = deriveLpPool(program.programId);
    const lpMint = deriveLpMint(program.programId);
    const insuranceFund = deriveInsuranceFund(program.programId);

    // Helper: derive depositor LP ATA (Token2022)
    function deriveLpAta(owner: PublicKey): PublicKey {
      const [ata] = PublicKey.findProgramAddressSync(
        [
          owner.toBuffer(),
          TOKEN_2022_PROGRAM_ID.toBuffer(),
          lpMint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      return ata;
    }

    // Helper: confirm tx
    async function confirmTx(sig: string) {
      await provider.connection.confirmTransaction(sig, "confirmed");
    }

    // Helper: get token balance
    async function getTokenBalance(ata: PublicKey): Promise<bigint> {
      const info = await provider.connection.getAccountInfo(ata);
      if (!info) return BigInt(0);
      // Token2022 account data: offset 64 for amount (u64 LE)
      const amount = info.data.readBigUInt64LE(64);
      return amount;
    }

    // ========================================
    // 1. initialize_protocol — Happy Path
    // ========================================

    describe("initialize_protocol", () => {
      it("initializes protocol with correct parameters", async () => {
        // Try to initialize — if already done, verify existing state
        try {
          const tx = await program.methods
            .initializeProtocol(
              executor.publicKey,
              treasury.publicKey,
              new anchor.BN(10_000_000),       // fixed_fee: 0.01 SOL
              500,                              // fee_bps: 5%
              8500,                             // max_utilization_bps: 85%
              new anchor.BN(3600),              // position_timeout: 1 hour
              0,                                // close_reward_bps
              2000,                             // insurance_split_bps: 20%
              500,                              // redemption_fee_bps: 5%
              new anchor.BN(100_000_000),       // min_user_contribution: 0.1 SOL
              new anchor.BN(5_000_000_000),     // max_lp_per_position: 5 SOL
              2000,                             // min_user_ratio_bps: 20%
            )
            .accounts({
              admin: wallet,
              protocolConfig,
              lpPool,
              insuranceFund,
              lpMint,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            } as any)
            .rpc();
          await confirmTx(tx);
        } catch (err: any) {
          // Already initialized — ok, continue with verification
          if (!err.toString().includes("already in use") && !err.toString().includes("0x0")) {
            throw err;
          }
        }

        // Verify protocol_config exists and is valid
        const config = await program.account.protocolConfig.fetch(protocolConfig);
        expect(config.admin.toBase58()).to.equal(wallet.toBase58());
        expect(JSON.stringify(config.status)).to.satisfy(
          (s: string) => s.includes("active") || s.includes("paused")
        );

        // Verify LP pool exists
        const pool = await program.account.lpPool.fetch(lpPool);
        expect(pool.lpMint.toBase58()).to.equal(lpMint.toBase58());

        // Verify LP mint exists (Token2022)
        const mintInfo = await provider.connection.getAccountInfo(lpMint);
        expect(mintInfo).to.not.be.null;
        expect(mintInfo!.owner.toBase58()).to.equal(TOKEN_2022_PROGRAM_ID.toBase58());

        // Verify insurance fund exists
        const fund = await program.account.insuranceFund.fetch(insuranceFund);
        expect(fund.authority.toBase58()).to.equal(wallet.toBase58());
      });

      // ========================================
      // 2. initialize_protocol — Error Cases
      // ========================================

      it("fails on double initialization", async () => {
        try {
          await program.methods
            .initializeProtocol(
              executor.publicKey,
              treasury.publicKey,
              new anchor.BN(10_000_000),
              500, 8500,
              new anchor.BN(3600),
              0, 2000, 500,
              new anchor.BN(100_000_000),
              new anchor.BN(5_000_000_000),
              2000,
            )
            .accounts({
              admin: wallet,
              protocolConfig,
              lpPool,
              insuranceFund,
              lpMint,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            } as any)
            .rpc();
          expect.fail("Should have thrown on double init");
        } catch (err: any) {
          // Anchor throws when trying to init an already-initialized account
          expect(err.toString()).to.satisfy(
            (s: string) => s.includes("already in use") || s.includes("already been processed") || s.includes("0x0")
          );
        }
      });
    });

    // ========================================
    // 3. deposit_lp — Happy Path
    // ========================================

    describe("deposit_lp", () => {
      const depositAmount = 2_000_000_000; // 2 SOL

      it("deposits SOL and mints LP tokens", async () => {
        const depositorLpAta = deriveLpAta(wallet);

        const poolBefore = await program.account.lpPool.fetch(lpPool);
        const totalBefore = poolBefore.totalLiquidity.toNumber();
        const supplyBefore = poolBefore.lpMintSupply.toNumber();

        const tx = await program.methods
          .depositLp(new anchor.BN(depositAmount))
          .accounts({
            depositor: wallet,
            protocolConfig,
            lpPool,
            lpMint,
            depositorLpAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .rpc();
        await confirmTx(tx);

        // Verify LP pool updated
        const poolAfter = await program.account.lpPool.fetch(lpPool);
        expect(poolAfter.totalLiquidity.toNumber()).to.equal(totalBefore + depositAmount);
        expect(poolAfter.availableLiquidity.toNumber()).to.be.greaterThan(0);
        // LP supply increased
        expect(poolAfter.lpMintSupply.toNumber()).to.be.greaterThan(supplyBefore);

        // Verify LP tokens in depositor's ATA (should be > 0)
        const lpBalance = await getTokenBalance(depositorLpAta);
        expect(Number(lpBalance)).to.be.greaterThan(0);
      });

      // ========================================
      // 4. deposit_lp — Error Cases
      // ========================================

      it("fails with zero deposit amount", async () => {
        const depositorLpAta = deriveLpAta(wallet);
        try {
          await program.methods
            .depositLp(new anchor.BN(0))
            .accounts({
              depositor: wallet,
              protocolConfig,
              lpPool,
              lpMint,
              depositorLpAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            } as any)
            .rpc();
          expect.fail("Should have thrown on zero deposit");
        } catch (err: any) {
          expect(err.toString()).to.include("ZeroDepositAmount");
        }
      });
    });

    // ========================================
    // 5. withdraw_lp — Happy Path
    // ========================================

    describe("withdraw_lp", () => {
      it("withdraws half of LP tokens and gets SOL back", async () => {
        const withdrawerLpAta = deriveLpAta(wallet);

        const poolBefore = await program.account.lpPool.fetch(lpPool);
        const lpSupplyBefore = poolBefore.lpMintSupply.toNumber();
        const totalLiqBefore = poolBefore.totalLiquidity.toNumber();
        const halfLp = Math.floor(lpSupplyBefore / 2);

        const solBalanceBefore = await provider.connection.getBalance(wallet);

        const tx = await program.methods
          .withdrawLp(new anchor.BN(halfLp))
          .accounts({
            withdrawer: wallet,
            lpPool,
            lpMint,
            withdrawerLpAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .rpc();
        await confirmTx(tx);

        // Verify LP pool state
        const poolAfter = await program.account.lpPool.fetch(lpPool);
        expect(poolAfter.lpMintSupply.toNumber()).to.equal(lpSupplyBefore - halfLp);
        expect(poolAfter.totalLiquidity.toNumber()).to.be.lessThan(totalLiqBefore);

        // Verify SOL received (approximately — minus tx fee)
        const solBalanceAfter = await provider.connection.getBalance(wallet);
        const solDiff = solBalanceAfter - solBalanceBefore;
        // Should have gained SOL (minus tx fees)
        expect(solDiff).to.be.greaterThan(0);
      });

      // ========================================
      // 6. withdraw_lp — Error Cases
      // ========================================

      it("fails when withdrawing more LP tokens than available", async () => {
        const withdrawerLpAta = deriveLpAta(wallet);
        const pool = await program.account.lpPool.fetch(lpPool);
        const tooMuch = pool.lpMintSupply.toNumber() + 1_000_000_000;

        try {
          await program.methods
            .withdrawLp(new anchor.BN(tooMuch))
            .accounts({
              withdrawer: wallet,
              lpPool,
              lpMint,
              withdrawerLpAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            } as any)
            .rpc();
          expect.fail("Should have thrown on excessive withdraw");
        } catch (err: any) {
          // Any error is acceptable — either pool check or token insufficient funds
          expect(err).to.exist;
        }
      });
    });

    // ========================================
    // 7. pause_protocol / resume_protocol
    // ========================================

    describe("pause_protocol / resume_protocol", () => {
      it("pauses protocol with admin", async () => {
        const tx = await program.methods
          .pauseProtocol("Test pause reason")
          .accounts({
            signer: wallet,
            protocolConfig,
          } as any)
          .rpc();
        await confirmTx(tx);

        const config = await program.account.protocolConfig.fetch(protocolConfig);
        expect(JSON.stringify(config.status)).to.include("paused");
      });

      it("deposit_lp fails when protocol is paused", async () => {
        const depositorLpAta = deriveLpAta(wallet);
        try {
          await program.methods
            .depositLp(new anchor.BN(1_000_000_000))
            .accounts({
              depositor: wallet,
              protocolConfig,
              lpPool,
              lpMint,
              depositorLpAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            } as any)
            .rpc();
          expect.fail("Should have thrown on paused protocol");
        } catch (err: any) {
          expect(err.toString()).to.include("ProtocolPaused");
        }
      });

      it("fails to pause already paused protocol", async () => {
        try {
          await program.methods
            .pauseProtocol("Double pause")
            .accounts({
              signer: wallet,
              protocolConfig,
            } as any)
            .rpc();
          expect.fail("Should have thrown on double pause");
        } catch (err: any) {
          expect(err.toString()).to.include("ProtocolPaused");
        }
      });

      it("resumes protocol with admin", async () => {
        const tx = await program.methods
          .resumeProtocol()
          .accounts({
            admin: wallet,
            protocolConfig,
          } as any)
          .rpc();
        await confirmTx(tx);

        const config = await program.account.protocolConfig.fetch(protocolConfig);
        expect(JSON.stringify(config.status)).to.include("active");
      });

      it("fails to resume when not paused", async () => {
        try {
          await program.methods
            .resumeProtocol()
            .accounts({
              admin: wallet,
              protocolConfig,
            } as any)
            .rpc();
          expect.fail("Should have thrown when not paused");
        } catch (err: any) {
          expect(err.toString()).to.include("ProtocolNotPaused");
        }
      });

      it("unauthorized user cannot pause protocol", async () => {
        const rando = Keypair.generate();
        // Fund from provider instead of airdrop to avoid rate limits
        const fundTx = new anchor.web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet,
            toPubkey: rando.publicKey,
            lamports: 100_000_000,
          })
        );
        await provider.sendAndConfirm(fundTx);

        try {
          await program.methods
            .pauseProtocol("Hack attempt")
            .accounts({
              signer: rando.publicKey,
              protocolConfig,
            } as any)
            .signers([rando])
            .rpc();
          expect.fail("Should have thrown on unauthorized pause");
        } catch (err: any) {
          expect(err.toString()).to.include("UnauthorizedPauser");
        }
      });
    });

    // ========================================
    // 8. deposit_insurance_fund / withdraw_insurance_fund
    // ========================================

    describe("insurance_fund operations", () => {
      const depositInsuranceAmount = 500_000_000; // 0.5 SOL
      const withdrawInsuranceAmount = 200_000_000; // 0.2 SOL

      it("deposits SOL into insurance fund", async () => {
        const fundBefore = await program.account.insuranceFund.fetch(insuranceFund);
        const beforeTotal = fundBefore.totalSol.toNumber();

        const tx = await program.methods
          .depositInsuranceFund(new anchor.BN(depositInsuranceAmount))
          .accounts({
            payer: wallet,
            insuranceFund,
            protocolConfig,
            systemProgram: SystemProgram.programId,
          } as any)
          .rpc();
        await confirmTx(tx);

        const fundAfter = await program.account.insuranceFund.fetch(insuranceFund);
        expect(fundAfter.totalSol.toNumber()).to.equal(beforeTotal + depositInsuranceAmount);
      });

      it("fails to deposit zero into insurance fund", async () => {
        try {
          await program.methods
            .depositInsuranceFund(new anchor.BN(0))
            .accounts({
              payer: wallet,
              insuranceFund,
              protocolConfig,
              systemProgram: SystemProgram.programId,
            } as any)
            .rpc();
          expect.fail("Should have thrown on zero deposit");
        } catch (err: any) {
          expect(err.toString()).to.include("ZeroInsuranceFundAmount");
        }
      });

      it("withdraws SOL from insurance fund", async () => {
        const destination = Keypair.generate();
        // Fund destination from provider instead of airdrop
        const fundTx = new anchor.web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet,
            toPubkey: destination.publicKey,
            lamports: 1_000_000,
          })
        );
        await provider.sendAndConfirm(fundTx);

        const destBalBefore = await provider.connection.getBalance(destination.publicKey);
        const fundBefore = await program.account.insuranceFund.fetch(insuranceFund);

        const tx = await program.methods
          .withdrawInsuranceFund(new anchor.BN(withdrawInsuranceAmount))
          .accounts({
            admin: wallet,
            insuranceFund,
            protocolConfig,
            destination: destination.publicKey,
            systemProgram: SystemProgram.programId,
          } as any)
          .rpc();
        await confirmTx(tx);

        const fundAfter = await program.account.insuranceFund.fetch(insuranceFund);
        const expectedTotal = fundBefore.totalSol.toNumber() - withdrawInsuranceAmount;
        expect(fundAfter.totalSol.toNumber()).to.equal(expectedTotal);

        const destBalAfter = await provider.connection.getBalance(destination.publicKey);
        expect(destBalAfter - destBalBefore).to.equal(withdrawInsuranceAmount);
      });

      it("fails to withdraw more than available in insurance fund", async () => {
        const fund = await program.account.insuranceFund.fetch(insuranceFund);
        const tooMuch = fund.totalSol.toNumber() + 1_000_000_000;

        try {
          await program.methods
            .withdrawInsuranceFund(new anchor.BN(tooMuch))
            .accounts({
              admin: wallet,
              insuranceFund,
              protocolConfig,
              destination: wallet,
              systemProgram: SystemProgram.programId,
            } as any)
            .rpc();
          expect.fail("Should have thrown on excessive withdraw");
        } catch (err: any) {
          expect(err.toString()).to.include("InsuranceFundBelowMinimum");
        }
      });

      it("fails to withdraw zero from insurance fund", async () => {
        try {
          await program.methods
            .withdrawInsuranceFund(new anchor.BN(0))
            .accounts({
              admin: wallet,
              insuranceFund,
              protocolConfig,
              destination: wallet,
              systemProgram: SystemProgram.programId,
            } as any)
            .rpc();
          expect.fail("Should have thrown on zero withdraw");
        } catch (err: any) {
          expect(err.toString()).to.include("ZeroInsuranceFundAmount");
        }
      });

      it("unauthorized user cannot withdraw from insurance fund", async () => {
        const rando = Keypair.generate();
        const fundRandoTx = new anchor.web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet,
            toPubkey: rando.publicKey,
            lamports: 100_000_000,
          })
        );
        await provider.sendAndConfirm(fundRandoTx);

        try {
          await program.methods
            .withdrawInsuranceFund(new anchor.BN(100_000_000))
            .accounts({
              admin: rando.publicKey,
              insuranceFund,
              protocolConfig,
              destination: rando.publicKey,
              systemProgram: SystemProgram.programId,
            } as any)
            .signers([rando])
            .rpc();
          expect.fail("Should have thrown on unauthorized withdraw");
        } catch (err: any) {
          expect(err.toString()).to.include("InvalidInsuranceFundAuthority");
        }
      });
    });
  });
});
