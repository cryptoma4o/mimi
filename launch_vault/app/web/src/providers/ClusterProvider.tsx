"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";

type Cluster = "devnet" | "mainnet-beta";

interface ClusterContextType {
  cluster: Cluster;
  rpcUrl: string;
  setCluster: (cluster: Cluster) => void;
}

const ClusterContext = createContext<ClusterContextType>({
  cluster: "devnet",
  rpcUrl: clusterApiUrl("devnet"),
  setCluster: () => {},
});

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [cluster, setClusterState] = useState<Cluster>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("cluster") as Cluster) || "devnet";
    }
    return "devnet";
  });

  const setCluster = useCallback((c: Cluster) => {
    setClusterState(c);
    if (typeof window !== "undefined") {
      localStorage.setItem("cluster", c);
    }
  }, []);

  const rpcUrl = clusterApiUrl(cluster);

  return (
    <ClusterContext.Provider value={{ cluster, rpcUrl, setCluster }}>
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  return useContext(ClusterContext);
}
