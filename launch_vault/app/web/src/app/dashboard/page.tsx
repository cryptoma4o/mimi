"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ProtocolStats } from "@/components/protocol/ProtocolStats";
import { VaultList } from "@/components/vault/VaultList";
import { shortenAddress } from "@/lib/format";

function WalletInfo() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const { data: balance } = useQuery({
    queryKey: ["wallet-balance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      return connection.getBalance(publicKey);
    },
    enabled: !!publicKey,
    refetchInterval: 15_000,
  });

  if (!publicKey) return null;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6 flex items-center justify-between">
      <div>
        <span className="text-sm text-gray-400">Connected: </span>
        <span className="text-sm text-white font-mono">
          {shortenAddress(publicKey.toBase58(), 6)}
        </span>
      </div>
      <div className="text-sm text-white font-mono">
        {balance !== undefined
          ? `${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
          : "..."}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Connect your wallet to view the dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
      <WalletInfo />
      <ProtocolStats />

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Your Vaults</h2>
        <VaultList />
      </div>
    </div>
  );
}
