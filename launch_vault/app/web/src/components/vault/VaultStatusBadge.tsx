"use client";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  readyForExecution: { bg: "bg-yellow-900/50", text: "text-yellow-400", label: "Ready" },
  active: { bg: "bg-green-900/50", text: "text-green-400", label: "Active" },
  closed: { bg: "bg-gray-700/50", text: "text-gray-400", label: "Closed" },
  defaulted: { bg: "bg-red-900/50", text: "text-red-400", label: "Defaulted" },
};

export function VaultStatusBadge({ status }: { status: any }) {
  const key = Object.keys(status)[0] || "active";
  const style = STATUS_STYLES[key] || STATUS_STYLES.active;

  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
