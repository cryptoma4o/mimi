import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PumpfunProxy } from "../target/types/pumpfun_proxy";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";

describe("pumpfun_proxy", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.pumpfunProxy as Program<PumpfunProxy>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // PumpFun v2 program IDs
  const PUMP_FUN_PROGRAM_ID = new PublicKey(
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
  );
  const MAYHEM_PROGRAM_ID = new PublicKey(
    "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e"
  );
  const TOKEN_2022_PROGRAM_ID = new PublicKey(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  );

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

  it("builds create_token instruction correctly", async () => {
    const mint = Keypair.generate();
    const pdas = derivePumpPDAs(mint.publicKey);

    // Structural test: verifies instruction can be built.
    // Full CPI test requires PumpFun deployed on localnet.
    const ix = await program.methods
      .createToken("TestToken", "TEST", "https://example.com/meta.json", false)
      .accounts({
        user: provider.wallet.publicKey,
        mint: mint.publicKey,
        pumpProgram: PUMP_FUN_PROGRAM_ID,
        pumpGlobal: pdas.global,
        pumpMintAuthority: pdas.mintAuthority,
        pumpBondingCurve: pdas.bondingCurve,
        pumpAssociatedBondingCurve: pdas.bondingCurve, // placeholder
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

    expect(ix.keys.length).to.equal(16);
    expect(ix.programId.toBase58()).to.equal(program.programId.toBase58());
  });
});
