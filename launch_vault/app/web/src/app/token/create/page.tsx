"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CreateTokenForm } from "@/components/token/CreateTokenForm";

export default function CreateTokenPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Connect your wallet to create a token.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Create Token</h1>
      <p className="text-gray-400 text-sm mb-6">
        Create a new token on PumpFun v2 via the LaunchVault protocol.
      </p>
      <CreateTokenForm />
    </div>
  );
}
