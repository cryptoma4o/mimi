"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import { buildCreateVault } from "@/lib/transactions";
import { deriveVaultPDA, deriveVaultATA } from "@/lib/pda";
import { shortenAddress, explorerUrl, formatSol } from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import toast from "react-hot-toast";

export function CreateVaultForm() {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { data: config } = useProtocolConfig();

  const [loading, setLoading] = useState(false);
  const [mintAddress, setMintAddress] = useState("");
  const [lpAllocation, setLpAllocation] = useState("");
  const [userContribution, setUserContribution] = useState("");
  const [result, setResult] = useState<{ tx: string; vault: string } | null>(null);

  const parsedMint = (() => {
    try {
      return mintAddress ? new PublicKey(mintAddress) : null;
    } catch {
      return null;
    }
  })();

  const vaultPda =
    publicKey && parsedMint ? deriveVaultPDA(publicKey, parsedMint) : null;
  const vaultAta =
    vaultPda && parsedMint ? deriveVaultATA(vaultPda, parsedMint) : null;

  const lpSol = parseFloat(lpAllocation) || 0;
  const contribSol = parseFloat(userContribution) || 0;
  const infraFee = config ? Number((config as any).infrastructureFee) : 0;
  const totalCost = contribSol + infraFee / 1e9;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!parsedMint) {
      toast.error("Invalid mint address");
      return;
    }
    if (lpSol <= 0) {
      toast.error("LP allocation must be > 0");
      return;
    }

    const treasury = (config as any)?.treasury as PublicKey;
    if (!treasury) {
      toast.error("Protocol not initialized");
      return;
    }

    setLoading(true);
    try {
      const { tx, vaultState } = await buildCreateVault(
        program,
        publicKey,
        parsedMint,
        lpSol,
        contribSol,
        treasury
      );
      setResult({ tx, vault: vaultState.toBase58() });
      toast.success("Vault created!");
    } catch (err: any) {
      const msg = parseAnchorError(err) || err.message || "Transaction failed";
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Token Mint Address</label>
        <input
          type="text"
          value={mintAddress}
          onChange={(e) => setMintAddress(e.target.value)}
          placeholder="Paste mint public key..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 font-mono text-sm"
        />
        {mintAddress && !parsedMint && (
          <p className="text-red-400 text-xs mt-1">Invalid public key</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">LP Allocation (SOL)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={lpAllocation}
            onChange={(e) => setLpAllocation(e.target.value)}
            placeholder="1.0"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Your Contribution (SOL)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={userContribution}
            onChange={(e) => setUserContribution(e.target.value)}
            placeholder="0.5"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Preview */}
      {parsedMint && publicKey && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm space-y-1">
          <p className="text-gray-400">
            Vault PDA: <span className="text-white font-mono">{vaultPda ? shortenAddress(vaultPda.toBase58()) : "..."}</span>
          </p>
          <p className="text-gray-400">
            Vault ATA: <span className="text-white font-mono">{vaultAta ? shortenAddress(vaultAta.toBase58()) : "..."}</span>
          </p>
          <p className="text-gray-400">
            Total buy budget: <span className="text-white">{formatSol(Math.round((lpSol + contribSol) * 1e9))} SOL</span>
          </p>
          <p className="text-gray-400">
            Infra fee: <span className="text-white">{formatSol(infraFee)} SOL</span>
          </p>
          <p className="text-gray-400">
            Your total cost: <span className="text-yellow-400">{totalCost.toFixed(4)} SOL</span>
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !publicKey || !parsedMint}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition"
      >
        {loading ? "Creating Vault..." : "Create Vault"}
      </button>

      {result && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 space-y-2">
          <p className="text-green-400 text-sm font-medium">Vault created!</p>
          <div className="text-sm">
            <span className="text-gray-400">Vault: </span>
            <a
              href={`/vault/${result.vault}`}
              className="text-violet-400 hover:text-violet-300 font-mono"
            >
              {result.vault.slice(0, 20)}...
            </a>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">TX: </span>
            <a
              href={explorerUrl(result.tx)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 font-mono"
            >
              {result.tx.slice(0, 20)}...
            </a>
          </div>
        </div>
      )}
    </form>
  );
}
