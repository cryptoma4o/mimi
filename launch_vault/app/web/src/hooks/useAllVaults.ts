"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, type LaunchVault } from "@/lib/idl";

export function useAllVaults() {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["all-vaults"],
    queryFn: async () => {
      const provider = new AnchorProvider(connection, {} as never, {
        commitment: "confirmed",
      });
      const program = new Program<LaunchVault>(IDL, provider);
      return (program.account as any).launchVaultState.all();
    },
    refetchInterval: 30_000,
  });
}
