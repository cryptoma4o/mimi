"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, type LaunchVault } from "@/lib/idl";

export function useUserVaults() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["user-vaults", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return [];
      const provider = new AnchorProvider(connection, {} as never, {
        commitment: "confirmed",
      });
      const program = new Program<LaunchVault>(IDL, provider);
      const vaults = await (program.account as any).launchVaultState.all([
        { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
      ]);
      return vaults;
    },
    enabled: !!publicKey,
    refetchInterval: 15_000,
  });
}
