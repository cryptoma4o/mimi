"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateVaultPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/launch");
  }, [router]);
  return null;
}
