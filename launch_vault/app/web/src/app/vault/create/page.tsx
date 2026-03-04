"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CreateVaultForm } from "@/components/vault/CreateVaultForm";

export default function CreateVaultPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Connect your wallet to create a vault.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Create Vault</h1>
      <p className="text-gray-400 text-sm mb-6">
        Create a vault to borrow LP liquidity and buy tokens on PumpFun.
      </p>
      <CreateVaultForm />
    </div>
  );
}
