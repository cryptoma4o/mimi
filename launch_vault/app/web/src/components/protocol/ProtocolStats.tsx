"use client";

import { useProtocolConfig } from "@/hooks/useProtocolConfig";
import { useLpPool } from "@/hooks/useLpPool";
import { formatSol, formatBps, formatDuration, shortenAddress } from "@/lib/format";
import { useCluster } from "@/providers/ClusterProvider";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-mono">{value}</span>
    </div>
  );
}

function CopyableAddress({ label, address }: { label: string; address: string }) {
  const { cluster } = useCluster();
  const url =
    cluster === "mainnet-beta"
      ? `https://solscan.io/account/${address}`
      : `https://solscan.io/account/${address}?cluster=devnet`;

  return (
    <div className="flex justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-400 hover:text-violet-300 text-sm font-mono transition"
      >
        {shortenAddress(address)}
      </a>
    </div>
  );
}

export function ProtocolStats() {
  const { data: config, isLoading: configLoading, error: configError } = useProtocolConfig();
  const { data: pool, isLoading: poolLoading, error: poolError } = useLpPool();

  if (configLoading || poolLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-6 animate-pulse">
            <div className="h-6 bg-gray-800 rounded w-1/3 mb-4" />
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-5 bg-gray-800 rounded w-full mb-2" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (configError || poolError) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-red-400">
        Protocol not initialized or unable to fetch data.
      </div>
    );
  }

  const cfg = config!.data;
  const lp = pool!.data;

  const totalLiq = (cfg as any).rentalPeriod ? Number((lp as any).totalLiquidity) : 0;
  const reservedLiq = Number((lp as any).reservedLiquidity);
  const availableLiq = Number((lp as any).availableLiquidity);
  const utilizationPct = totalLiq > 0 ? ((reservedLiq / totalLiq) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Protocol Config */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Protocol Config</h3>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              JSON.stringify((cfg as any).status).includes("active")
                ? "bg-green-900/50 text-green-400"
                : "bg-red-900/50 text-red-400"
            }`}
          >
            {JSON.stringify((cfg as any).status).includes("active") ? "Active" : "Paused"}
          </span>
        </div>
        <CopyableAddress label="Admin" address={(cfg as any).admin.toBase58()} />
        <CopyableAddress label="Executor" address={(cfg as any).executor.toBase58()} />
        <CopyableAddress label="Treasury" address={(cfg as any).treasury.toBase58()} />
        <StatRow label="Rental Period" value={formatDuration(Number((cfg as any).rentalPeriod))} />
        <StatRow label="Rental Fee" value={`${formatSol(Number((cfg as any).rentalFeeRate))} SOL`} />
        <StatRow label="Infrastructure Fee" value={`${formatSol(Number((cfg as any).infrastructureFee))} SOL`} />
        <StatRow label="Redemption Fee" value={formatBps((cfg as any).redemptionFeeBps)} />
        <StatRow label="Grace Period" value={formatDuration(Number((cfg as any).gracePeriod))} />
      </div>

      {/* LP Pool */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">LP Pool</h3>
        <CopyableAddress label="Address" address={pool!.address.toBase58()} />
        <CopyableAddress label="Authority" address={(lp as any).authority.toBase58()} />
        <StatRow label="Total Liquidity" value={`${formatSol(totalLiq)} SOL`} />
        <StatRow label="Reserved" value={`${formatSol(reservedLiq)} SOL`} />
        <StatRow label="Available" value={`${formatSol(availableLiq)} SOL`} />

        {/* Utilization bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Utilization</span>
            <span>{utilizationPct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(Number(utilizationPct), 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
