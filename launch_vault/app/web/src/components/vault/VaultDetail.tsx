"use client";

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, type LaunchVault } from "@/lib/idl";
import { useProgram } from "@/hooks/useProgram";
import { VaultStatusBadge } from "./VaultStatusBadge";
import { RedeemForm } from "./RedeemForm";
import { buildSellPosition, buildClosePosition } from "@/lib/transactions";
import { deriveVaultATA } from "@/lib/pda";
import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import {
  formatSol,
  formatTokens,
  shortenAddress,
  formatTimestamp,
  explorerAccountUrl,
} from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import toast from "react-hot-toast";
import { useState } from "react";

interface VaultDetailProps {
  address: string;
}

function useVault(address: string) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["vault", address],
    queryFn: async () => {
      const provider = new AnchorProvider(connection, {} as never, {
        commitment: "confirmed",
      });
      const program = new Program<LaunchVault>(IDL, provider);
      const pubkey = new PublicKey(address);
      const vault = await (program.account as any).launchVaultState.fetch(pubkey);
      return vault;
    },
    refetchInterval: 10_000,
  });
}

export function VaultDetail({ address }: VaultDetailProps) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { program } = useProgram();
  const { data: vault, isLoading } = useVault(address);
  const { data: config } = useProtocolConfig();
  const [actionLoading, setActionLoading] = useState("");

  // Sell form state
  const [sellAmount, setSellAmount] = useState("");
  const [minSolOutput, setMinSolOutput] = useState("");

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-800 rounded-xl" />;
  }

  if (!vault) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Vault not found: {address}</p>
      </div>
    );
  }

  const statusKey = Object.keys(vault.status)[0] || "active";
  const isOwner = publicKey && vault.user.toBase58() === publicKey.toBase58();
  const isActive = statusKey === "active";
  const isClosed = statusKey === "closed" || statusKey === "timedOut";

  const now = Math.floor(Date.now() / 1000);
  const openedTs = Number(vault.openTimestamp);
  const positionTimeout = config ? Number((config as any).positionTimeout) : 0;
  const expiresAt = openedTs + positionTimeout;
  const timeLeft = expiresAt - now;

  const vaultPubkey = new PublicKey(address);
  const vaultAta = deriveVaultATA(vaultPubkey, vault.tokenMint);

  const handleSellPosition = async () => {
    if (!program || !publicKey) return;
    const amount = parseInt(sellAmount) || 0;
    const minOut = parseFloat(minSolOutput) || 0;
    if (amount <= 0) {
      toast.error("Enter a token amount to sell");
      return;
    }

    setActionLoading("sell");
    try {
      await buildSellPosition(
        program,
        connection,
        publicKey,
        vaultPubkey,
        vault.tokenMint,
        new BN(amount),
        new BN(Math.round(minOut * 1e9))
      );
      toast.success("Tokens sold!");
      setSellAmount("");
      setMinSolOutput("");
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Sell failed");
      console.error(err);
    } finally {
      setActionLoading("");
    }
  };

  const handleClosePosition = async () => {
    if (!program || !publicKey) return;
    setActionLoading("close");
    try {
      await buildClosePosition(program, publicKey, vaultPubkey, vault.user, vaultAta);
      toast.success("Position closed!");
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed");
      console.error(err);
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Position Details</h1>
          <p className="text-sm text-gray-400 font-mono mt-1">{address}</p>
        </div>
        <VaultStatusBadge status={vault.status} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard label="Token Mint" href={explorerAccountUrl(vault.tokenMint.toBase58())}>
          {shortenAddress(vault.tokenMint.toBase58())}
        </InfoCard>
        <InfoCard label="Owner">
          {shortenAddress(vault.user.toBase58())}
          {isOwner && <span className="text-xs text-violet-400 ml-2">(you)</span>}
        </InfoCard>
        <InfoCard label="Tokens Remaining">
          {formatTokens(Number(vault.remainingTokenAmount))} / {formatTokens(Number(vault.totalTokenAmount))}
        </InfoCard>
        <InfoCard label="LP Allocation">
          {formatSol(Number(vault.remainingLpAllocation))} / {formatSol(Number(vault.totalLpAllocation))} SOL
        </InfoCard>
        <InfoCard label="User Contribution">
          {formatSol(Number(vault.userContribution))} SOL
        </InfoCard>
        <InfoCard label="Opened At">
          {openedTs > 0 ? formatTimestamp(openedTs) : "N/A"}
        </InfoCard>
        {isActive && positionTimeout > 0 && (
          <InfoCard label="Expires">
            <span className={timeLeft < 3600 ? "text-red-400" : "text-white"}>
              {formatTimestamp(expiresAt)}
              {timeLeft > 0 && (
                <span className="text-gray-400 text-xs ml-2">
                  ({Math.floor(timeLeft / 3600)}h {Math.floor((timeLeft % 3600) / 60)}m left)
                </span>
              )}
            </span>
          </InfoCard>
        )}
      </div>

      {/* Stop-Loss Info */}
      {Number(vault.stopLossBps) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Stop-Loss Protection</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Threshold</span>
              <p className="text-white">{(Number(vault.stopLossBps) / 100).toFixed(1)}% below entry price</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p className={vault.stopLossTriggered ? "text-red-400 font-medium" : "text-green-400 font-medium"}>
                {vault.stopLossTriggered ? "Triggered" : "Active"}
              </p>
            </div>
            {vault.stopLossTriggered && Number(vault.stopLossTimestamp) > 0 && (
              <div>
                <span className="text-gray-500">Triggered At</span>
                <p className="text-red-400">{formatTimestamp(Number(vault.stopLossTimestamp))}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner Actions */}
      {isOwner && isActive && (
        <div className="space-y-4">
          {/* Sell Position */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-white font-medium">Sell Tokens via PumpFun</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token Amount (max: {formatTokens(Number(vault.remainingTokenAmount))})
                </label>
                <input
                  type="number"
                  min="0"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="1000000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min SOL Output</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={minSolOutput}
                  onChange={(e) => setMinSolOutput(e.target.value)}
                  placeholder="0.1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <button
              onClick={handleSellPosition}
              disabled={actionLoading === "sell"}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition text-sm"
            >
              {actionLoading === "sell" ? "Selling..." : "Sell Position"}
            </button>
          </div>

          {/* Close Position */}
          <button
            onClick={handleClosePosition}
            disabled={actionLoading === "close"}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
          >
            {actionLoading === "close" ? "Closing..." : "Close Position"}
          </button>

          <RedeemForm vaultAddress={vaultPubkey} vault={vault} />
        </div>
      )}

      {statusKey === "timedOut" && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">
            This position has timed out. An executor can force-close it.
          </p>
        </div>
      )}

      {isClosed && statusKey === "closed" && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-gray-400 text-sm">
            This position is closed. No further actions available.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  children,
  href,
}: {
  label: string;
  children: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <span className="text-white text-sm font-mono">{children}</span>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
        {content}
      </a>
    );
  }
  return content;
}
