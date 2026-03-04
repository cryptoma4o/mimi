"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { buildProxyCreateToken } from "@/lib/transactions";
import { explorerUrl, explorerAccountUrl } from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import toast from "react-hot-toast";

export function CreateTokenForm() {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [uri, setUri] = useState("");
  const [isMayhem, setIsMayhem] = useState(false);
  const [result, setResult] = useState<{ tx: string; mint: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!name || !symbol || !uri) {
      toast.error("Fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { tx, mint } = await buildProxyCreateToken(program, publicKey, {
        name,
        symbol,
        uri,
        isMayhem,
      });
      setResult({ tx, mint: mint.toBase58() });
      toast.success("Token created!");
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
        <label className="block text-sm text-gray-400 mb-1">Token Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. MIMI Token"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. MIMI"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Metadata URI</label>
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="https://..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={isMayhem}
          onChange={(e) => setIsMayhem(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        Enable Mayhem mode
      </label>

      <button
        type="submit"
        disabled={loading || !publicKey}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition"
      >
        {loading ? "Creating..." : "Create Token on PumpFun"}
      </button>

      {result && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 space-y-2">
          <p className="text-green-400 text-sm font-medium">Token created successfully!</p>
          <div className="text-sm">
            <span className="text-gray-400">Mint: </span>
            <a
              href={explorerAccountUrl(result.mint)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 font-mono break-all"
            >
              {result.mint}
            </a>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">TX: </span>
            <a
              href={explorerUrl(result.tx)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 font-mono break-all"
            >
              {result.tx.slice(0, 20)}...
            </a>
          </div>
        </div>
      )}
    </form>
  );
}
