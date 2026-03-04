"use client";

import { ReactNode } from "react";
import { ClusterProvider } from "@/providers/ClusterProvider";
import { SolanaProvider } from "@/providers/SolanaProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClusterProvider>
      <QueryProvider>
        <SolanaProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#1f2937",
                color: "#f3f4f6",
                border: "1px solid #374151",
              },
            }}
          />
        </SolanaProvider>
      </QueryProvider>
    </ClusterProvider>
  );
}
