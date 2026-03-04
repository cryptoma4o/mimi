const ERROR_MAP: Record<number, string> = {
  6000: "Only admin can perform this action",
  6001: "Only the vault owner can perform this action",
  6002: "Only the authorized executor can perform this action",
  6003: "Invalid vault status for this operation",
  6004: "Protocol is currently paused",
  6005: "Insufficient LP liquidity available",
  6006: "Insufficient available liquidity for withdrawal",
  6007: "Redeem amount exceeds remaining tokens in vault",
  6008: "Redeem amount must be greater than zero",
  6009: "Token amount must be greater than zero",
  6010: "Grace period has not expired yet",
  6011: "Redemption fee BPS must be <= 10000",
  6012: "Rental period must be positive",
  6013: "Grace period must be non-negative",
  6014: "Invalid treasury account",
  6015: "Arithmetic overflow",
  6016: "Vault token account is not empty",
  6017: "LP allocation must be greater than zero",
  6018: "User contribution must be greater than zero",
  6019: "Max SOL cost exceeds buy budget",
  6020: "Too many buyers in bundle (max 5)",
  6021: "Buy amounts and max sol costs must have same length",
  6022: "At least one buyer required",
  6023: "Invalid remaining accounts count",
  6024: "Invalid buyer PDA",
  6025: "Invalid vault token account",
};

export function parseAnchorError(err: any): string {
  if (err?.error?.errorCode?.number) {
    const code = err.error.errorCode.number;
    return ERROR_MAP[code] || `Unknown error (${code})`;
  }

  if (err?.message) {
    const match = err.message.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (match) {
      const code = parseInt(match[1], 16);
      return ERROR_MAP[code] || `Program error ${code}`;
    }
    return err.message;
  }

  return "Transaction failed";
}
