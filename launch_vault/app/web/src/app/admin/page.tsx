"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useLpPool } from "@/hooks/useLpPool";
import { useAllVaults } from "@/hooks/useAllVaults";
import { VaultStatusBadge } from "@/components/vault/VaultStatusBadge";
import {
  buildDepositLp,
  buildWithdrawLp,
  buildProxyBuyToken,
} from "@/lib/transactions";
import {
  formatSol,
  formatTokens,
  shortenAddress,
} from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import toast from "react-hot-toast";

type Tab = "lp" | "executor" | "vaults";

export default function AdminPage() {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("lp");

  if (!connected) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Connect your wallet to access admin panel.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>

      <div className="flex gap-2 mb-6">
        {(["lp", "executor", "vaults"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {tab === "lp" ? "LP Management" : tab === "executor" ? "Executor Actions" : "All Vaults"}
          </button>
        ))}
      </div>

      {activeTab === "lp" && <LpManagement />}
      {activeTab === "executor" && <ExecutorActions />}
      {activeTab === "vaults" && <AllVaultsTable />}
    </div>
  );
}

// ── LP Management ───────────────────────────────────────────────────────

function LpManagement() {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { data: pool, refetch } = useLpPool();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState("");

  const handleDeposit = async () => {
    if (!program || !publicKey) return;
    const sol = parseFloat(depositAmount);
    if (!sol || sol <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading("deposit");
    try {
      await buildDepositLp(program, publicKey, sol);
      toast.success(`Deposited ${sol} SOL`);
      setDepositAmount("");
      refetch();
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  const handleWithdraw = async () => {
    if (!program || !publicKey) return;
    const sol = parseFloat(withdrawAmount);
    if (!sol || sol <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading("withdraw");
    try {
      await buildWithdrawLp(program, publicKey, sol);
      toast.success(`Withdrew ${sol} SOL`);
      setWithdrawAmount("");
      refetch();
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-6">
      {pool && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">LP Pool Status</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total</span>
              <p className="text-white">{formatSol(Number((pool as any).data.totalLiquidity))} SOL</p>
            </div>
            <div>
              <span className="text-gray-500">Reserved</span>
              <p className="text-yellow-400">{formatSol(Number((pool as any).data.reservedLiquidity))} SOL</p>
            </div>
            <div>
              <span className="text-gray-500">Available</span>
              <p className="text-green-400">{formatSol(Number((pool as any).data.availableLiquidity))} SOL</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Deposit SOL</h3>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in SOL"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleDeposit}
              disabled={loading === "deposit"}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition font-medium"
            >
              {loading === "deposit" ? "..." : "Deposit"}
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Withdraw SOL</h3>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount in SOL"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleWithdraw}
              disabled={loading === "withdraw"}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition font-medium"
            >
              {loading === "withdraw" ? "..." : "Withdraw"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Executor Actions ────────────────────────────────────────────────────

function ExecutorActions() {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { data: vaults } = useAllVaults();
  const [loading, setLoading] = useState("");

  const readyVaults =
    vaults?.filter((v: any) => {
      const key = Object.keys(v.account.status)[0];
      return key === "readyForExecution";
    }) || [];

  const [buyAmounts, setBuyAmounts] = useState<Record<string, string>>({});
  const [maxCosts, setMaxCosts] = useState<Record<string, string>>({});

  const handleProxyBuy = async (vaultPubkey: PublicKey, vault: any) => {
    if (!program || !publicKey) return;
    const key = vaultPubkey.toBase58();
    const tokenAmount = parseInt(buyAmounts[key] || "0");
    const maxSol = parseFloat(maxCosts[key] || "0");

    if (tokenAmount <= 0 || maxSol <= 0) {
      toast.error("Enter valid token amount and max SOL cost");
      return;
    }

    setLoading(key);
    try {
      // Fee recipient needs to be read from PumpFun global state
      // For now, use a known fee recipient from the protocol config
      const feeRecipient = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");

      await buildProxyBuyToken(
        program,
        publicKey,
        vaultPubkey,
        vault.tokenMint,
        new BN(tokenAmount),
        new BN(Math.round(maxSol * 1e9)),
        feeRecipient
      );
      toast.success("Proxy buy executed!");
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  if (readyVaults.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500">No vaults waiting for execution.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readyVaults.map((v: any) => {
        const key = v.publicKey.toBase58();
        return (
          <div
            key={key}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-mono text-sm">{shortenAddress(key)}</p>
                <p className="text-gray-500 text-xs">
                  Mint: {shortenAddress(v.account.tokenMint.toBase58())}
                </p>
              </div>
              <VaultStatusBadge status={v.account.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="text-gray-500">LP Allocation</span>
                <p className="text-white">{formatSol(Number(v.account.totalLpAllocation))} SOL</p>
              </div>
              <div>
                <span className="text-gray-500">User Contribution</span>
                <p className="text-white">{formatSol(Number(v.account.userContribution))} SOL</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                type="number"
                value={buyAmounts[key] || ""}
                onChange={(e) =>
                  setBuyAmounts((p) => ({ ...p, [key]: e.target.value }))
                }
                placeholder="Token amount"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
              />
              <input
                type="number"
                step="0.01"
                value={maxCosts[key] || ""}
                onChange={(e) =>
                  setMaxCosts((p) => ({ ...p, [key]: e.target.value }))
                }
                placeholder="Max SOL cost"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              onClick={() => handleProxyBuy(v.publicKey, v.account)}
              disabled={loading === key}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2 rounded-lg transition text-sm font-medium"
            >
              {loading === key ? "Executing..." : "Proxy Buy"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── All Vaults Table ────────────────────────────────────────────────────

function AllVaultsTable() {
  const { data: vaults, isLoading } = useAllVaults();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered =
    vaults?.filter((v: any) => {
      if (statusFilter === "all") return true;
      const key = Object.keys(v.account.status)[0];
      return key === statusFilter;
    }) || [];

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-800 rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["all", "readyForExecution", "active", "closed", "defaulted"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === s
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s === "all" ? "All" : s === "readyForExecution" ? "Ready" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No vaults found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3">Vault</th>
                <th className="text-left py-2 px-3">Owner</th>
                <th className="text-left py-2 px-3">Mint</th>
                <th className="text-right py-2 px-3">Tokens</th>
                <th className="text-right py-2 px-3">LP (SOL)</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v: any) => (
                <tr
                  key={v.publicKey.toBase58()}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="py-2 px-3">
                    <a
                      href={`/vault/${v.publicKey.toBase58()}`}
                      className="text-violet-400 hover:text-violet-300 font-mono"
                    >
                      {shortenAddress(v.publicKey.toBase58())}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-gray-300 font-mono">
                    {shortenAddress(v.account.user.toBase58())}
                  </td>
                  <td className="py-2 px-3 text-gray-300 font-mono">
                    {shortenAddress(v.account.tokenMint.toBase58())}
                  </td>
                  <td className="py-2 px-3 text-right text-white">
                    {formatTokens(Number(v.account.remainingTokenAmount))}
                  </td>
                  <td className="py-2 px-3 text-right text-white">
                    {formatSol(Number(v.account.totalLpAllocation))}
                  </td>
                  <td className="py-2 px-3">
                    <VaultStatusBadge status={v.account.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
