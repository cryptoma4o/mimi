"use client";

/** @deprecated Vault creation is now part of Open Position (/launch) */
export function CreateVaultForm() {
  return (
    <div className="text-center py-12">
      <p className="text-gray-400">
        Vault creation has been merged into the Open Position flow.
      </p>
      <a href="/launch" className="text-violet-400 hover:text-violet-300 mt-2 inline-block">
        Go to Open Position
      </a>
    </div>
  );
}
