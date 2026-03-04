"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, type LaunchVault } from "@/lib/idl";
import { deriveLpPool } from "@/lib/pda";

export function useLpPool() {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["lp-pool"],
    queryFn: async () => {
      const provider = new AnchorProvider(
        connection,
        {} as never,
        { commitment: "confirmed" }
      );
      const program = new Program<LaunchVault>(IDL, provider);
      const pda = deriveLpPool();
      const data = await (program.account as any).lpPool.fetch(pda);
      return { address: pda, data };
    },
    refetchInterval: 15_000,
  });
}
