"use client";

import { useParams } from "next/navigation";
import { VaultDetail } from "@/components/vault/VaultDetail";

export default function VaultPage() {
  const params = useParams();
  const address = params.address as string;

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">No vault address provided.</p>
      </div>
    );
  }

  return <VaultDetail address={address} />;
}
