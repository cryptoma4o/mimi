"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { LaunchBundleForm } from "@/components/launch/LaunchBundleForm";

export default function LaunchPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Connect your wallet to open a position.</p>
        <p className="text-gray-500 text-sm mt-2">
          Create token + open position + buy tokens atomically in one transaction.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Open Position</h1>
      <p className="text-gray-400 text-sm mb-6">
        Create token + open position + buy tokens atomically in one transaction.
      </p>
      <LaunchBundleForm />
    </div>
  );
}
