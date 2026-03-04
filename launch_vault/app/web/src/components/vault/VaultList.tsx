"use client";

import { useUserVaults } from "@/hooks/useUserVaults";
import { VaultCard } from "./VaultCard";

export function VaultList() {
  const { data: vaults, isLoading } = useUserVaults();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!vaults || vaults.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-900 rounded-xl border border-gray-800">
        <p className="text-gray-500">No vaults found.</p>
        <a
          href="/vault/create"
          className="text-violet-400 hover:text-violet-300 text-sm mt-2 inline-block"
        >
          Create your first vault
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vaults.map((v: any) => (
        <VaultCard
          key={v.publicKey.toBase58()}
          address={v.publicKey.toBase58()}
          vault={v.account}
        />
      ))}
    </div>
  );
}
