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
        )
        .accounts({
          admin: wallet,
          protocol_config: protocolConfig,
          lp_pool: lpPool,
          insurance_fund: insuranceFund,
          lp_mint: lpMint,
          token_program: TOKEN_2022_PROGRAM_ID,
          system_program: SystemProgram.programId,
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
          null,  // new_status
        )
        .accounts({
          admin: wallet,
          protocol_config: protocolConfig,
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
          lp_pool: lpPool,
          lp_mint: lpMint,
          depositor_lp_ata: Keypair.generate().publicKey,
          token_program: TOKEN_2022_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
          system_program: SystemProgram.programId,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(7);
    });

    // 4. withdraw_lp (6 accounts)
    it("builds withdraw_lp instruction correctly", async () => {
      const lpPool = deriveLpPool(program.programId);
      const lpMint = deriveLpMint(program.programId);

      const ix = await program.methods
        .withdrawLp(new anchor.BN(500_000_000))
        .accounts({
          withdrawer: wallet,
          lp_pool: lpPool,
          lp_mint: lpMint,
          withdrawer_lp_ata: Keypair.generate().publicKey,
          token_program: TOKEN_2022_PROGRAM_ID,
          system_program: SystemProgram.programId,
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
          pump_program: PUMP_FUN_PROGRAM_ID,
          pump_global: derivePumpGlobal(),
          pump_mint_authority: derivePumpMintAuthority(),
          pump_bonding_curve: derivePumpBondingCurve(mint.publicKey),
          pump_associated_bonding_curve: Keypair.generate().publicKey,
          mayhem_program: MAYHEM_PROGRAM_ID,
          mayhem_global_params: PublicKey.default,
          mayhem_sol_vault: PublicKey.default,
          mayhem_state: PublicKey.default,
          mayhem_token_vault: PublicKey.default,
          pump_event_authority: derivePumpEventAuthority(),
          system_program: SystemProgram.programId,
          token_program: TOKEN_2022_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
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
        )
        .accounts({
          user: wallet,
          mint: mint.publicKey,
          vault_state: vaultState,
          protocol_config: protocolConfig,
          lp_pool: lpPool,
          treasury,
          insurance_fund: insuranceFund,
          pump_program: PUMP_FUN_PROGRAM_ID,
          pump_global: derivePumpGlobal(),
          pump_mint_authority: derivePumpMintAuthority(),
          pump_bonding_curve: derivePumpBondingCurve(mint.publicKey),
          pump_associated_bonding_curve: Keypair.generate().publicKey,
          pump_event_authority: derivePumpEventAuthority(),
          pump_fee_recipient: Keypair.generate().publicKey,
          mayhem_program: MAYHEM_PROGRAM_ID,
          mayhem_global_params: PublicKey.default,
          mayhem_sol_vault: PublicKey.default,
          mayhem_state: PublicKey.default,
          mayhem_token_vault: PublicKey.default,
          pump_global_volume_accumulator: derivePumpGlobalVolumeAccumulator(),
          pump_creator_vault: derivePumpCreatorVault(wallet),
          pump_fee_config: deriveFeeConfig(),
          pump_bonding_curve_v2: derivePumpBondingCurveV2(mint.publicKey),
          pump_fee_program: FEE_PROGRAM_ID,
          system_program: SystemProgram.programId,
          token_program: TOKEN_2022_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
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
          vault_state: vaultState,
          protocol_config: protocolConfig,
          lp_pool: lpPool,
          vault_token_account: Keypair.generate().publicKey,
          token_mint: mint,
          pump_program: PUMP_FUN_PROGRAM_ID,
          pump_global: derivePumpGlobal(),
          pump_fee_recipient: Keypair.generate().publicKey,
          pump_bonding_curve: derivePumpBondingCurve(mint),
          pump_associated_bonding_curve: Keypair.generate().publicKey,
          pump_event_authority: derivePumpEventAuthority(),
          pump_creator_vault: derivePumpCreatorVault(wallet),
          pump_fee_config: deriveFeeConfig(),
          pump_bonding_curve_v2: derivePumpBondingCurveV2(mint),
          pump_fee_program: FEE_PROGRAM_ID,
          system_program: SystemProgram.programId,
          token_program: TOKEN_2022_PROGRAM_ID,
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
          vault_state: vaultState,
          protocol_config: protocolConfig,
          lp_pool: lpPool,
          treasury,
          vault_token_account: Keypair.generate().publicKey,
          user_token_account: Keypair.generate().publicKey,
          token_mint: mint,
          system_program: SystemProgram.programId,
          token_program: TOKEN_2022_PROGRAM_ID,
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
          vault_state: vaultState,
          protocol_config: protocolConfig,
          lp_pool: lpPool,
          vault_owner: wallet,
          vault_token_account: Keypair.generate().publicKey,
          token_program: TOKEN_2022_PROGRAM_ID,
          system_program: SystemProgram.programId,
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
          vault_state: vaultState,
          protocol_config: protocolConfig,
          lp_pool: lpPool,
          vault_token_account: Keypair.generate().publicKey,
          token_mint: mint,
          pump_program: PUMP_FUN_PROGRAM_ID,
          pump_global: derivePumpGlobal(),
          pump_fee_recipient: Keypair.generate().publicKey,
          pump_bonding_curve: derivePumpBondingCurve(mint),
          pump_associated_bonding_curve: Keypair.generate().publicKey,
          pump_event_authority: derivePumpEventAuthority(),
          pump_creator_vault: derivePumpCreatorVault(wallet),
          pump_fee_config: deriveFeeConfig(),
          pump_bonding_curve_v2: derivePumpBondingCurveV2(mint),
          pump_fee_program: FEE_PROGRAM_ID,
          system_program: SystemProgram.programId,
          token_program: TOKEN_2022_PROGRAM_ID,
        } as any)
        .instruction();

      expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
      expect(ix.keys.length).to.equal(18);
    });
  });
});
