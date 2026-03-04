"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, type LaunchVault } from "@/lib/idl";
import { deriveProtocolConfig } from "@/lib/pda";

export function useProtocolConfig() {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["protocol-config"],
    queryFn: async () => {
      const provider = new AnchorProvider(
        connection,
        {} as never,
        { commitment: "confirmed" }
      );
      const program = new Program<LaunchVault>(IDL, provider);
      const pda = deriveProtocolConfig();
      const data = await (program.account as any).protocolConfig.fetch(pda);
      return { address: pda, data };
    },
    refetchInterval: 30_000,
  });
}
