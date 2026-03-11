"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCluster } from "@/providers/ClusterProvider";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export function Navbar() {
  const { cluster, setCluster } = useCluster();

  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-white">
              LaunchVault
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/token/create"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Create Token
              </Link>
              <Link
                href="/launch"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium transition"
              >
                Open Position
              </Link>
              <Link
                href="/admin"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Admin
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setCluster(cluster === "devnet" ? "mainnet-beta" : "devnet")
              }
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                cluster === "devnet"
                  ? "bg-yellow-900/50 text-yellow-400 border border-yellow-700"
                  : "bg-green-900/50 text-green-400 border border-green-700"
              }`}
            >
              {cluster === "devnet" ? "Devnet" : "Mainnet"}
            </button>
            <WalletMultiButton
              style={{
                backgroundColor: "#7c3aed",
                height: "38px",
                fontSize: "14px",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
