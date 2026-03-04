"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import { buildRedeemTokens } from "@/lib/transactions";
import { formatSol, formatTokens } from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import toast from "react-hot-toast";

interface RedeemFormProps {
  vaultAddress: PublicKey;
  vault: any;
}

export function RedeemForm({ vaultAddress, vault }: RedeemFormProps) {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { data: config } = useProtocolConfig();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const remaining = Number(vault.remainingTokenAmount);
  const total = Number(vault.totalTokenAmount);
  const lpAlloc = Number(vault.remainingLpAllocation);
  const redeemBps = config ? Number((config as any).redemptionFeeBps) : 0;

  const amountNum = parseInt(amount) || 0;
  const proportion = total > 0 ? amountNum / total : 0;
  const grossReturn = proportion * lpAlloc;
  const fee = (grossReturn * redeemBps) / 10000;
  const netReturn = grossReturn - fee;

  const handleRedeem = async () => {
    if (!program || !publicKey) return;
    if (amountNum <= 0 || amountNum > remaining) {
      toast.error(`Enter amount between 1 and ${remaining}`);
      return;
    }

    setLoading(true);
    try {
      const tx = await buildRedeemTokens(
        program,
        publicKey,
        vaultAddress,
        vault.tokenMint,
        new BN(amountNum)
      );
      toast.success("Tokens redeemed!");
      console.log("Redeem TX:", tx);
    } catch (err: any) {
      const msg = parseAnchorError(err) || err.message || "Redeem failed";
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
      <h3 className="text-white font-medium">Redeem Tokens</h3>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Amount (max: {formatTokens(remaining)})
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={() => setAmount(remaining.toString())}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 rounded-lg transition"
          >
            Max
          </button>
        </div>
      </div>

      {amountNum > 0 && (
        <div className="text-sm space-y-1 border-t border-gray-700 pt-2">
          <p className="text-gray-400">
            LP return: <span className="text-white">{formatSol(Math.round(grossReturn))} SOL</span>
          </p>
          <p className="text-gray-400">
            Redemption fee ({redeemBps / 100}%): <span className="text-red-400">-{formatSol(Math.round(fee))} SOL</span>
          </p>
          <p className="text-gray-400">
            Net SOL: <span className="text-green-400">{formatSol(Math.round(netReturn))} SOL</span>
          </p>
        </div>
      )}

      <button
        onClick={handleRedeem}
        disabled={loading || amountNum <= 0}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition"
      >
        {loading ? "Redeeming..." : "Redeem"}
      </button>
    </div>
  );
}
