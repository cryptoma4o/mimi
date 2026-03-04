"use client";

import Link from "next/link";
import { VaultStatusBadge } from "./VaultStatusBadge";
import { formatSol, formatTokens, shortenAddress } from "@/lib/format";

interface VaultCardProps {
  address: string;
  vault: any;
}

export function VaultCard({ address, vault }: VaultCardProps) {
  return (
    <Link href={`/vault/${address}`}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-violet-600 transition cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-mono text-gray-300">
            {shortenAddress(vault.tokenMint.toBase58())}
          </span>
          <VaultStatusBadge status={vault.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Tokens</span>
            <p className="text-white">
              {formatTokens(Number(vault.remainingTokenAmount))} / {formatTokens(Number(vault.totalTokenAmount))}
            </p>
          </div>
          <div>
            <span className="text-gray-500">LP Allocation</span>
            <p className="text-white">{formatSol(Number(vault.totalLpAllocation))} SOL</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
