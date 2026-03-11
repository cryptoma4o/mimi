"use client";

import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import { useLpPool } from "@/hooks/useLpPool";
import { buildOpenPosition } from "@/lib/transactions";
import { explorerUrl, explorerAccountUrl } from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import toast from "react-hot-toast";

type Step = 1 | 2 | 3 | 4;

interface BuyerEntry {
  tokenAmount: string;
  maxSolCost: string;
}

export function LaunchBundleForm() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { program } = useProgram();
  const { data: config } = useProtocolConfig();
  const { data: pool } = useLpPool();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tx: string; mint: string; vault: string } | null>(null);

  // Step 1: Token info
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [uri, setUri] = useState("");
  const [isMayhem, setIsMayhem] = useState(false);

  // Step 2: Position config
  const [lpAllocation, setLpAllocation] = useState("");
  const [userContribution, setUserContribution] = useState("");

  // Step 3: Buyers
  const [buyers, setBuyers] = useState<BuyerEntry[]>([
    { tokenAmount: "", maxSolCost: "" },
  ]);

  const addBuyer = () => {
    if (buyers.length < 5) {
      setBuyers([...buyers, { tokenAmount: "", maxSolCost: "" }]);
    }
  };

  const removeBuyer = (idx: number) => {
    if (buyers.length > 1) {
      setBuyers(buyers.filter((_, i) => i !== idx));
    }
  };

  const updateBuyer = (idx: number, field: keyof BuyerEntry, value: string) => {
    const updated = [...buyers];
    updated[idx] = { ...updated[idx], [field]: value };
    setBuyers(updated);
  };

  // Computed values
  const lpSol = parseFloat(lpAllocation) || 0;
  const contribSol = parseFloat(userContribution) || 0;
  const fixedFee = config ? Number((config as any).fixedFee) / LAMPORTS_PER_SOL : 0;
  const feeBps = config ? Number((config as any).feeBps) : 0;
  const percentFee = (lpSol * feeBps) / 10000;
  const totalFee = fixedFee + percentFee;
  const totalBuyBudget = lpSol + contribSol;
  const totalMaxSol = buyers.reduce((sum, b) => sum + (parseFloat(b.maxSolCost) || 0), 0);
  const availableLp = pool ? Number((pool as any).availableLiquidity) / LAMPORTS_PER_SOL : 0;

  const canProceed1 = name && symbol && uri;
  const canProceed2 = lpSol > 0;
  const canProceed3 = buyers.every(b => (parseInt(b.tokenAmount) || 0) > 0 && (parseFloat(b.maxSolCost) || 0) > 0);

  const handleLaunch = async () => {
    if (!program || !publicKey) return;

    setLoading(true);
    try {
      const buyAmounts = buyers.map(b => new BN(parseInt(b.tokenAmount)));
      const maxSolCosts = buyers.map(b => new BN(Math.round(parseFloat(b.maxSolCost) * LAMPORTS_PER_SOL)));

      const { tx, mint, vaultPDA } = await buildOpenPosition(
        program,
        connection,
        publicKey,
        {
          name,
          symbol,
          uri,
          isMayhem,
          lpAllocationSol: lpSol,
          userContributionSol: contribSol,
          buyAmounts,
          maxSolCosts,
        }
      );

      setResult({ tx, mint: mint.toBase58(), vault: vaultPDA.toBase58() });
      toast.success("Position opened!");
    } catch (err: any) {
      const msg = parseAnchorError(err) || err.message || "Transaction failed";
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="bg-green-900/30 border border-green-800 rounded-xl p-6 space-y-3">
          <h2 className="text-green-400 text-lg font-bold">Position Opened!</h2>
          <div className="text-sm space-y-2">
            <div>
              <span className="text-gray-400">Token Mint: </span>
              <a href={explorerAccountUrl(result.mint)} target="_blank" rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 font-mono break-all">
                {result.mint}
              </a>
            </div>
            <div>
              <span className="text-gray-400">Position: </span>
              <a href={`/vault/${result.vault}`}
                className="text-violet-400 hover:text-violet-300 font-mono break-all">
                {result.vault}
              </a>
            </div>
            <div>
              <span className="text-gray-400">TX: </span>
              <a href={explorerUrl(result.tx)} target="_blank" rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 font-mono">
                {result.tx.slice(0, 30)}...
              </a>
            </div>
          </div>
          <button
            onClick={() => { setResult(null); setStep(1); }}
            className="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Open Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Step indicator */}
      <div className="flex gap-2">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full transition ${
              s <= step ? "bg-violet-500" : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Token Info */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold text-lg">Step 1: Token Info</h2>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Token Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MIMI Token"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Symbol</label>
            <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. MIMI"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Metadata URI</label>
            <input type="text" value={uri} onChange={(e) => setUri(e.target.value)}
              placeholder="https://..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={isMayhem} onChange={(e) => setIsMayhem(e.target.checked)}
              className="rounded bg-gray-800 border-gray-600" />
            Enable Mayhem mode
          </label>
          <button
            onClick={() => setStep(2)}
            disabled={!canProceed1}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
          >
            Next: Position Config
          </button>
        </div>
      )}

      {/* Step 2: Position Config */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold text-lg">Step 2: Position Config</h2>
          {pool && (
            <p className="text-sm text-gray-500">Available LP: {availableLp.toFixed(4)} SOL</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">LP Allocation (SOL)</label>
              <input type="number" step="0.01" min="0" value={lpAllocation}
                onChange={(e) => setLpAllocation(e.target.value)} placeholder="0.5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Contribution (SOL)</label>
              <input type="number" step="0.01" min="0" value={userContribution}
                onChange={(e) => setUserContribution(e.target.value)} placeholder="0.3"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-400">Total buy budget: <span className="text-white">{totalBuyBudget.toFixed(4)} SOL</span></p>
            <p className="text-gray-400">Fixed fee: <span className="text-white">{fixedFee.toFixed(6)} SOL</span></p>
            <p className="text-gray-400">LP fee ({(feeBps / 100).toFixed(1)}%): <span className="text-white">{percentFee.toFixed(6)} SOL</span></p>
            <p className="text-gray-400 border-t border-gray-700 pt-1 mt-1">Total fee: <span className="text-yellow-400">{totalFee.toFixed(6)} SOL</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg transition">Back</button>
            <button onClick={() => setStep(3)} disabled={!canProceed2}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition">
              Next: Buyers
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Buyers */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">Step 3: Buyers ({buyers.length}/5)</h2>
            <button onClick={addBuyer} disabled={buyers.length >= 5}
              className="text-sm text-violet-400 hover:text-violet-300 disabled:text-gray-600 transition">
              + Add Buyer
            </button>
          </div>
          {buyers.map((buyer, idx) => (
            <div key={idx} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Buyer {idx + 1}</span>
                {buyers.length > 1 && (
                  <button onClick={() => removeBuyer(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Token Amount (raw)</label>
                  <input type="number" min="0" value={buyer.tokenAmount}
                    onChange={(e) => updateBuyer(idx, "tokenAmount", e.target.value)}
                    placeholder="1000000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max SOL Cost</label>
                  <input type="number" step="0.01" min="0" value={buyer.maxSolCost}
                    onChange={(e) => updateBuyer(idx, "maxSolCost", e.target.value)}
                    placeholder="0.3"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500" />
                </div>
              </div>
            </div>
          ))}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm">
            <p className="text-gray-400">Total max SOL across buyers: <span className="text-yellow-400">{totalMaxSol.toFixed(4)} SOL</span></p>
            {totalMaxSol > totalBuyBudget && (
              <p className="text-red-400 text-xs mt-1">Warning: max SOL exceeds buy budget</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg transition">Back</button>
            <button onClick={() => setStep(4)} disabled={!canProceed3}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition">
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Launch */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold text-lg">Step 4: Review & Open Position</h2>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm space-y-2">
            <h3 className="text-white font-medium mb-2">Token</h3>
            <p className="text-gray-400">Name: <span className="text-white">{name}</span></p>
            <p className="text-gray-400">Symbol: <span className="text-white">{symbol}</span></p>
            <p className="text-gray-400">URI: <span className="text-white break-all">{uri}</span></p>
            {isMayhem && <p className="text-yellow-400">Mayhem mode enabled</p>}
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm space-y-2">
            <h3 className="text-white font-medium mb-2">Position</h3>
            <p className="text-gray-400">LP Allocation: <span className="text-white">{lpSol} SOL</span></p>
            <p className="text-gray-400">User Contribution: <span className="text-white">{contribSol} SOL</span></p>
            <p className="text-gray-400">Fees: <span className="text-white">{totalFee.toFixed(6)} SOL</span></p>
            <p className="text-gray-400">Total cost: <span className="text-yellow-400">{(contribSol + totalFee).toFixed(6)} SOL</span></p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm space-y-2">
            <h3 className="text-white font-medium mb-2">Buyers ({buyers.length})</h3>
            {buyers.map((b, i) => (
              <p key={i} className="text-gray-400">
                #{i + 1}: <span className="text-white">{parseInt(b.tokenAmount).toLocaleString()} tokens</span>
                {" "}(max {b.maxSolCost} SOL)
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg transition">Back</button>
            <button onClick={handleLaunch} disabled={loading || !publicKey}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition">
              {loading ? "Opening..." : "Open Position"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
