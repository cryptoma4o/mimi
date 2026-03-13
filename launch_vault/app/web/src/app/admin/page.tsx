"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useLpPool } from "@/hooks/useLpPool";
import { useAllVaults } from "@/hooks/useAllVaults";
import { VaultStatusBadge } from "@/components/vault/VaultStatusBadge";
import {
  buildDepositLp,
  buildWithdrawLp,
  buildForceClosePosition,
  buildPauseProtocol,
  buildResumeProtocol,
  buildDepositInsuranceFund,
  buildWithdrawInsuranceFund,
} from "@/lib/transactions";
import {
  formatSol,
  formatTokens,
  shortenAddress,
} from "@/lib/format";
import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import { parseAnchorError } from "@/lib/errors";
import { deriveInsuranceFund } from "@/lib/pda";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, type LaunchVault } from "@/lib/idl";

type Tab = "lp" | "forceClose" | "vaults" | "protocol" | "insurance";

const TAB_LABELS: Record<Tab, string> = {
  lp: "LP Management",
  forceClose: "Force Close",
  vaults: "All Positions",
  protocol: "Protocol Control",
  insurance: "Insurance Fund",
};

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

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["lp", "forceClose", "vaults", "protocol", "insurance"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "lp" && <LpManagement />}
      {activeTab === "forceClose" && <ForceClosePanel />}
      {activeTab === "vaults" && <AllVaultsTable />}
      {activeTab === "protocol" && <ProtocolControlPanel />}
      {activeTab === "insurance" && <InsuranceFundPanel />}
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
    const lpAmount = parseFloat(withdrawAmount);
    if (!lpAmount || lpAmount <= 0) {
      toast.error("Enter a valid LP token amount");
      return;
    }
    setLoading("withdraw");
    try {
      await buildWithdrawLp(program, publicKey, new BN(Math.round(lpAmount * 1e9)));
      toast.success(`Withdrew LP tokens`);
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
          <h3 className="text-white font-medium mb-3">Withdraw (LP Tokens)</h3>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="LP token amount"
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

// ── Force Close Panel ──────────────────────────────────────────────────

function ForceClosePanel() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { program } = useProgram();
  const { data: vaults } = useAllVaults();
  const [loading, setLoading] = useState("");

  const timedOutVaults =
    vaults?.filter((v: any) => {
      const key = Object.keys(v.account.status)[0];
      return key === "timedOut";
    }) || [];

  const handleForceClose = async (vaultPubkey: PublicKey, vault: any) => {
    if (!program || !publicKey) return;
    const key = vaultPubkey.toBase58();
    setLoading(key);
    try {
      await buildForceClosePosition(
        program,
        connection,
        publicKey,
        vaultPubkey,
        vault.tokenMint,
        vault.user
      );
      toast.success("Position force-closed!");
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  if (timedOutVaults.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500">No timed-out positions to force-close.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timedOutVaults.map((v: any) => {
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
                <span className="text-gray-500">Tokens Remaining</span>
                <p className="text-white">{formatTokens(Number(v.account.remainingTokenAmount))}</p>
              </div>
            </div>

            <button
              onClick={() => handleForceClose(v.publicKey, v.account)}
              disabled={loading === key}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg transition text-sm font-medium"
            >
              {loading === key ? "Force Closing..." : "Force Close Position"}
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
        {["all", "active", "closed", "timedOut"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === s
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s === "all" ? "All" : s === "timedOut" ? "Timed Out" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No positions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3">Position</th>
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

// ── Protocol Control Panel ──────────────────────────────────────────────

function ProtocolControlPanel() {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { data: config, refetch } = useProtocolConfig();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState("");

  const isPaused = config ? Object.keys((config as any).data.status)[0] === "paused" : false;

  const handlePause = async () => {
    if (!program || !publicKey) return;
    if (!reason.trim()) {
      toast.error("Enter a reason for pausing");
      return;
    }
    setLoading("pause");
    try {
      await buildPauseProtocol(program, publicKey, reason.trim());
      toast.success("Protocol paused");
      setReason("");
      refetch();
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed to pause");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  const handleResume = async () => {
    if (!program || !publicKey) return;
    setLoading("resume");
    try {
      await buildResumeProtocol(program, publicKey);
      toast.success("Protocol resumed");
      refetch();
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Failed to resume");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-medium mb-3">Protocol Status</h3>
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isPaused
                ? "bg-red-900/50 text-red-400 border border-red-800"
                : "bg-green-900/50 text-green-400 border border-green-800"
            }`}
          >
            {isPaused ? "Paused" : "Active"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pause */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Pause Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Emergency maintenance"
              disabled={isPaused}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
            <button
              onClick={handlePause}
              disabled={isPaused || loading === "pause"}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg transition text-sm font-medium"
            >
              {loading === "pause" ? "Pausing..." : "Pause Protocol"}
            </button>
          </div>

          {/* Resume */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">&nbsp;</label>
            <p className="text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
              Resume will re-enable all protocol operations.
            </p>
            <button
              onClick={handleResume}
              disabled={!isPaused || loading === "resume"}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg transition text-sm font-medium"
            >
              {loading === "resume" ? "Resuming..." : "Resume Protocol"}
            </button>
          </div>
        </div>
      </div>

      {/* Circuit Breaker Info */}
      {config && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Circuit Breaker</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Position Limit</span>
              <p className="text-white">{Number((config as any).data.cbPositionLimit)}</p>
            </div>
            <div>
              <span className="text-gray-500">Window</span>
              <p className="text-white">{Number((config as any).data.cbWindowSeconds)}s</p>
            </div>
            <div>
              <span className="text-gray-500">Cooldown</span>
              <p className="text-white">{Number((config as any).data.cbCooldownSeconds)}s</p>
            </div>
            <div>
              <span className="text-gray-500">Positions in Window</span>
              <p className="text-white">{Number((config as any).data.cbPositionsInWindow)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Insurance Fund Panel ────────────────────────────────────────────────

function useInsuranceFund() {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["insurance-fund"],
    queryFn: async () => {
      const provider = new AnchorProvider(connection, {} as never, {
        commitment: "confirmed",
      });
      const program = new Program<LaunchVault>(IDL, provider);
      const pda = deriveInsuranceFund();
      const data = await (program.account as any).insuranceFund.fetch(pda);
      return { address: pda, data };
    },
    refetchInterval: 15_000,
  });
}

function InsuranceFundPanel() {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { data: fund, refetch } = useInsuranceFund();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDest, setWithdrawDest] = useState("");
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
      await buildDepositInsuranceFund(
        program,
        publicKey,
        new BN(Math.round(sol * 1e9))
      );
      toast.success(`Deposited ${sol} SOL to insurance fund`);
      setDepositAmount("");
      refetch();
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Deposit failed");
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
    let destination: PublicKey;
    try {
      destination = new PublicKey(withdrawDest.trim());
    } catch {
      toast.error("Enter a valid destination address");
      return;
    }
    setLoading("withdraw");
    try {
      await buildWithdrawInsuranceFund(
        program,
        publicKey,
        new BN(Math.round(sol * 1e9)),
        destination
      );
      toast.success(`Withdrew ${sol} SOL from insurance fund`);
      setWithdrawAmount("");
      setWithdrawDest("");
      refetch();
    } catch (err: any) {
      toast.error(parseAnchorError(err) || err.message || "Withdraw failed");
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Fund Balance */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-medium mb-3">Insurance Fund Balance</h3>
        {fund ? (
          <div className="text-2xl font-bold text-white">
            {formatSol(Number((fund as any).data.totalSol))} SOL
          </div>
        ) : (
          <div className="animate-pulse h-8 w-32 bg-gray-800 rounded" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deposit */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Deposit SOL</h3>
          <div className="space-y-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in SOL"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleDeposit}
              disabled={loading === "deposit"}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg transition font-medium"
            >
              {loading === "deposit" ? "Depositing..." : "Deposit"}
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Withdraw SOL</h3>
          <div className="space-y-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount in SOL"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              value={withdrawDest}
              onChange={(e) => setWithdrawDest(e.target.value)}
              placeholder="Destination address"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleWithdraw}
              disabled={loading === "withdraw"}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg transition font-medium"
            >
              {loading === "withdraw" ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
