"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Home() {
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (connected) {
      router.push("/dashboard");
    }
  }, [connected, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-4">LaunchVault</h1>
        <p className="text-gray-400 text-lg max-w-lg mx-auto">
          Token launch protocol on Solana. Create tokens on PumpFun v2,
          back them with LP liquidity, and manage vaults.
        </p>
      </div>
      <WalletMultiButton
        style={{
          backgroundColor: "#7c3aed",
          fontSize: "16px",
          borderRadius: "12px",
          padding: "12px 32px",
        }}
      />
    </div>
  );
}
