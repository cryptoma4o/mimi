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
  6010: "Invalid redemption fee BPS (must be <= 10000)",
  6011: "Invalid treasury account",
  6012: "Arithmetic overflow",
  6013: "Vault token account is not empty",
  6014: "LP allocation must be greater than zero",
  6015: "User contribution must be greater than zero",
  6016: "Max SOL cost exceeds buy budget",
  6017: "Too many buyers in bundle (max 5)",
  6018: "Buy amounts and max sol costs must have same length",
  6019: "At least one buyer required",
  6020: "Invalid remaining accounts count",
  6021: "Invalid buyer PDA",
  6022: "Invalid vault token account",
  6023: "Utilization cap reached — not enough available LP",
  6024: "Position has not timed out yet",
  6025: "Invalid fee BPS (must be <= 10000)",
  6026: "Invalid utilization BPS (must be <= 10000)",
  6027: "Invalid position timeout (must be positive)",
  6028: "Deposit amount must be greater than zero",
  6029: "Withdraw amount must be greater than zero",
  6030: "Invalid LP token amount",
  6031: "Unauthorized seller",
  6032: "Slippage exceeded — output less than minimum",
  6033: "User contribution is below minimum required",
  6034: "LP allocation exceeds maximum per position",
  6035: "User contribution ratio is below minimum",
  6036: "Stop-loss is not configured for this position",
  6037: "Stop-loss has already been triggered",
  6038: "Current price is above stop-loss threshold",
  6039: "Circuit breaker triggered, protocol paused",
  6040: "Insurance fund balance below minimum",
  6041: "Invalid insurance fund authority",
  6042: "Insurance fund amount must be greater than zero",
  6043: "Circuit breaker cooldown period not elapsed",
  6044: "Unauthorized to pause/resume protocol",
  6045: "Invalid circuit breaker parameter",
  6046: "Invalid stop-loss parameter",
  6047: "Protocol is not paused",
  6048: "Invalid Pump.fun fee program",
  6049: "Invalid bonding curve data",
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
