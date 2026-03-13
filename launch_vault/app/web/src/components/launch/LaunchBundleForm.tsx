"use client";

import { useState, useRef, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import { useLpPool } from "@/hooks/useLpPool";
import { buildOpenPosition } from "@/lib/transactions";
import { explorerUrl, explorerAccountUrl } from "@/lib/format";
import { parseAnchorError } from "@/lib/errors";
import { METADATA_API_URL } from "@/lib/constants";
import { createOpenPositionALT } from "@/lib/alt";
import toast from "react-hot-toast";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creatingMetadata, setCreatingMetadata] = useState(false);
  const [metadataMode, setMetadataMode] = useState<"create" | "manual">("create");
  const [isMayhem, setIsMayhem] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Position config
  const [lpAllocation, setLpAllocation] = useState("");
  const [userContribution, setUserContribution] = useState("");
  const [stopLossPercent, setStopLossPercent] = useState<number>(0);

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
  const fixedFee = config?.data ? Number(config.data.fixedFee) / LAMPORTS_PER_SOL : 0;
  const feeBps = config?.data ? Number(config.data.feeBps) : 0;
  const percentFee = (lpSol * feeBps) / 10000;
  const totalFee = fixedFee + percentFee;
  const totalBuyBudget = lpSol + contribSol;
  const totalMaxSol = buyers.reduce((sum, b) => sum + (parseFloat(b.maxSolCost) || 0), 0);
  const availableLp = pool?.data ? Number(pool.data.availableLiquidity) / LAMPORTS_PER_SOL : 0;

  // Cleanup Object URL on unmount or when preview changes
  const prevPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    // Revoke the previous preview URL when imagePreview changes
    if (prevPreviewRef.current && prevPreviewRef.current !== imagePreview) {
      URL.revokeObjectURL(prevPreviewRef.current);
    }
    prevPreviewRef.current = imagePreview;
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be under 5MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file && !file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    // Don't revoke here — useEffect handles cleanup of previous URL
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleCreateMetadata = async () => {
    if (!name || !symbol) return;
    if (!METADATA_API_URL) {
      toast.error("Metadata API not configured (set NEXT_PUBLIC_METADATA_API_URL)");
      return;
    }
    setCreatingMetadata(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("symbol", symbol);
      fd.append("description", description);
      if (imageFile) fd.append("image", imageFile);
      const res = await fetch(METADATA_API_URL, { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        toast.error(`Metadata error (${res.status}): ${text.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      if (data.uri) {
        setUri(data.uri);
        toast.success("Metadata created!");
      } else {
        toast.error(data.error || "Failed to create metadata");
      }
    } catch (err: any) {
      toast.error("Metadata service error: " + err.message);
    } finally {
      setCreatingMetadata(false);
    }
  };

  const canProceed1 = name && symbol && uri;
  const canProceed2 = lpSol > 0;
  const canProceed3 = buyers.every(b => (parseInt(b.tokenAmount) || 0) > 0 && (parseFloat(b.maxSolCost) || 0) > 0);

  // ALT address from localStorage, scoped to RPC endpoint
  const [altAddress, setAltAddress] = useState<PublicKey | null>(null);
  const { sendTransaction, signTransaction } = useWallet();

  const altStorageKey = `mimi_alt_address_${connection.rpcEndpoint}_${publicKey?.toBase58() ?? "none"}`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(altStorageKey);
      if (stored) {
        try { setAltAddress(new PublicKey(stored)); } catch {}
      }
    }
  }, [altStorageKey]);

  const handleCreateALT = async () => {
    if (!publicKey || !sendTransaction) return;
    setLoading(true);
    try {
      toast("Creating Address Lookup Table...");
      const alt = await createOpenPositionALT(
        connection,
        publicKey,
        async (vtx) => {
          const sig = await sendTransaction(vtx, connection);
          return sig;
        },
        undefined,
        altAddress || undefined
      );
      localStorage.setItem(altStorageKey, alt.toBase58());
      setAltAddress(alt);
      toast.success("ALT created! Wait a few seconds before launching.");
    } catch (err: any) {
      toast.error("ALT creation failed: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!program || !publicKey || !signTransaction) return;

    setLoading(true);
    try {
      const buyAmounts = buyers.map(b => new BN(parseInt(b.tokenAmount)).mul(new BN(1_000_000)));
      const maxSolCosts = buyers.map(b => new BN(Math.round(parseFloat(b.maxSolCost) * LAMPORTS_PER_SOL)));

      const { vtx, mint, vaultPDA, blockhash, lastValidBlockHeight } = await buildOpenPosition(
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
          altAddress: altAddress || undefined,
          stopLossBps: Math.round(Math.min(Math.max(stopLossPercent, 0), 99) * 100), // Convert % to basis points, clamp 0-99
        }
      );

      // Wallet signs the versioned transaction (mintKeypair already signed)
      const signed = await signTransaction(vtx);
      const tx = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: tx, blockhash, lastValidBlockHeight },
        "confirmed"
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

      {/* Step 1: Token Info + Metadata */}
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

          {/* Metadata mode toggle */}
          <div className="flex gap-2 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setMetadataMode("create")}
              className={`flex-1 py-1.5 text-sm rounded-md transition ${
                metadataMode === "create" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Create Metadata
            </button>
            <button
              onClick={() => setMetadataMode("manual")}
              className={`flex-1 py-1.5 text-sm rounded-md transition ${
                metadataMode === "manual" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Paste URI
            </button>
          </div>

          {metadataMode === "create" ? (
            <div className="space-y-3 bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="A cool meme token..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image (max 5MB)</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-violet-600 file:text-white file:cursor-pointer" />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-2 w-20 h-20 rounded-lg object-cover" />
                )}
              </div>
              <button
                onClick={handleCreateMetadata}
                disabled={!name || !symbol || creatingMetadata}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition text-sm"
              >
                {creatingMetadata ? "Creating..." : uri ? "Recreate Metadata" : "Create Metadata"}
              </button>
              {uri && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">URI ready</span>
                  <span className="text-gray-500 truncate flex-1">{uri}</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Metadata URI</label>
              <input type="text" value={uri} onChange={(e) => setUri(e.target.value)}
                placeholder="https://..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
            </div>
          )}

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
          <div>
            <label className="block text-sm text-gray-400 mb-1">Stop-Loss (% of entry price)</label>
            <input type="number" step="1" min="0" max="99" value={stopLossPercent}
              onChange={(e) => setStopLossPercent(Number(e.target.value))} placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
            <p className="text-xs text-gray-500 mt-1">0 = no stop-loss, 50 = sell at 50% of entry</p>
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
                  <label className="block text-xs text-gray-500 mb-1">Token Amount</label>
                  <input type="number" min="0" value={buyer.tokenAmount}
                    onChange={(e) => updateBuyer(idx, "tokenAmount", e.target.value)}
                    placeholder="1000000000"
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
            {stopLossPercent > 0 && <p className="text-gray-400">Stop-Loss: <span className="text-white">{stopLossPercent}%</span></p>}
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
          {!altAddress && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-sm">
              <p className="text-yellow-400 mb-2">Address Lookup Table required (one-time setup)</p>
              <button onClick={handleCreateALT} disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition text-sm">
                {loading ? "Creating..." : "Create ALT"}
              </button>
            </div>
          )}
          {altAddress && (
            <p className="text-xs text-green-400">ALT: {altAddress.toBase58().slice(0, 16)}...</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg transition">Back</button>
            <button onClick={handleLaunch} disabled={loading || !publicKey || !altAddress}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition">
              {loading ? "Opening..." : "Open Position"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
