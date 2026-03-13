# Phase 1 Design — MiMi Protocol

**Status**: Draft  
**Date**: 2026-03-12  
**Author**: Kilo Code (Solana Dev Agent)

---

## Overview

Phase 1 adds three key safety features to the MiMi Protocol:

1. **Stop-loss** — Automated position liquidation when price drops below threshold
2. **Insurance Fund Operations** — Explicit deposit/withdraw mechanisms for the insurance fund
3. **Circuit Breaker** — Emergency protocol pause capability

---

## 1. Stop-loss

### Context

Currently, positions must be manually closed via `sell_position` or `force_close_position`. Users need automated risk management to prevent total loss in volatile markets.

### Decision

**Storage**: Add stop-loss fields to `LaunchVaultState`:

```rust
// state/launch_vault_state.rs additions
pub struct LaunchVaultState {
    // ... existing fields ...
    
    /// Stop-loss threshold: percentage of entry price (basis points)
    /// 8000 = 80% of entry price = 20% loss tolerance
    /// 0 = disabled
    pub stop_loss_bps: u16,
    
    /// Whether stop-loss has been triggered
    pub stop_loss_triggered: bool,
    
    /// Timestamp when stop-loss was triggered
    pub stop_loss_timestamp: i64,
}
```

**Entry Price Tracking**: The entry price is implicit from `total_lp_allocation / total_token_amount`. Store this at open time:

```rust
/// Calculated entry price: SOL per 1M tokens (for precision)
pub entry_price: u64,
```

**Activation**: Stop-loss is set during `open_position` as an optional parameter. Users specify `stop_loss_bps` (0 to disable).

**Trigger Mechanism**: Two approaches:

- **Option A (Pull)**: New instruction `trigger_stop_loss` — anyone can call to execute stop-loss when conditions are met
- **Option B (Push)**: Keeper/executor monitors and triggers

**Decision**: Implement **Option A** with permissionless trigger for trustless execution:

```rust
// New instruction in lib.rs
pub fn trigger_stop_loss(ctx: Context<TriggerStopLoss>) -> Result<()>
```

### Implementation Details

**New Instruction: `trigger_stop_loss`**

Accounts:
- `vault_state`: The position to trigger stop-loss on
- `protocol_config`: Check protocol not paused
- `lp_pool`: For pool accounting
- All Pump.fun accounts needed for sell (same as `sell_position`)
- `token_program`, `system_program`

Logic:
1. Check `vault_state.status == VaultStatus::Active`
2. Check `stop_loss_bps > 0` and `!stop_loss_triggered`
3. Query current token price from Pump.fun bonding curve
4. Calculate: `entry_price * stop_loss_bps / 10000`
5. If `current_price <= stop_loss_threshold`: execute full sell
6. Set `stop_loss_triggered = true`, `stop_loss_timestamp = now`
7. Same accounting as `sell_position` but sells ALL remaining tokens
8. Emit `StopLossTriggeredEvent`

**Challenges**:
- **Price Query**: Pump.fun doesn't provide direct price RPC. Need to either:
  - a) Pass price as parameter (user/keeper provides)
  - b) Calculate from bonding curve SOL/token reserves (complex)
  - c) Use `get_virtualTokenReserves` and `get_virtualSolReserves` from Pump.fun

**Recommendation**: Option (a) — require caller to provide current price with slippage protection via `min_sol_output`. If price check fails, transaction reverts (no harm done).

**Error Handling**: Add to `errors.rs`:

```rust
#[msg("Stop-loss not configured for this position")]
StopLossNotConfigured,

#[msg("Stop-loss already triggered")]
StopLossAlreadyTriggered,

#[msg("Stop-loss condition not met (price above threshold)")]
StopLossConditionNotMet,
```

### Consequences

- **Positive**: Users can set risk tolerance at position open; automated execution prevents emotional hesitation
- **Negative**: Requires new instruction; price oracle dependency (caller-provided)
- **New State Fields**: 4 fields added to `LaunchVaultState` (~40 bytes)
- **New Instruction**: `trigger_stop_loss`

---

## 2. Insurance Fund Operations

### Context

The insurance fund is currently updated only via fees in `open_position`. There's no explicit mechanism to:
- Add external donations/contributions
- Withdraw funds for protocol protection
- Track fund balance changes

### Decision

**Existing State**: Already has `InsuranceFund` struct:

```rust
pub struct InsuranceFund {
    pub total_sol: u64,
    pub authority: Pubkey,  // admin/multisig
    pub bump: u8,
}
```

**New Instructions**: Two instructions for fund management:

#### 2.1 `deposit_insurance_fund`

Anyone can deposit SOL to the insurance fund:

```rust
pub fn deposit_insurance_fund(ctx: Context<DepositInsuranceFund>, amount: u64) -> Result<()>
```

Accounts:
- `payer`: Signer depositing SOL
- `insurance_fund`: PDA to receive funds
- `protocol_config`: For seed verification
- `system_program`

Logic:
1. Transfer `amount` from `payer` to `insurance_fund` PDA
2. Update `insurance_fund.total_sol += amount`
3. Emit `InsuranceFundDepositedEvent { amount, new_total, timestamp }`

Validation:
- `amount > 0`
- `payer` has sufficient balance

#### 2.2 `withdraw_insurance_fund`

Only admin can withdraw:

```rust
pub fn withdraw_insurance_fund(ctx: Context<WithdrawInsuranceFund>, amount: u64) -> Result<()>
```

Accounts:
- `admin`: Signer (must match `insurance_fund.authority`)
- `insurance_fund`: PDA to withdraw from
- `destination`: Where to send SOL
- `protocol_config`: For seed verification
- `system_program`

Logic:
1. Require `admin == insurance_fund.authority`
2. Require `amount <= insurance_fund.total_sol` (can't overdraw)
3. Transfer `amount` from `insurance_fund` PDA to `destination`
4. Update `insurance_fund.total_sol -= amount`
5. Emit `InsuranceFundWithdrawnEvent { amount, new_total, destination, timestamp }`

**Safety Guard**: Add optional `min_insurance_fund` to `ProtocolConfig`:

```rust
// state/protocol_config.rs additions
/// Minimum insurance fund balance (lamports) — cannot withdraw below this
pub min_insurance_fund: u64,
```

### Events (additions)

```rust
#[event]
pub struct InsuranceFundDepositedEvent {
    pub amount: u64,
    pub new_total: u64,
    pub timestamp: i64,
}

#[event]
pub struct InsuranceFundWithdrawnEvent {
    pub amount: u64,
    pub new_total: u64,
    pub destination: Pubkey,
    pub timestamp: i64,
}
```

### Errors (additions)

```rust
#[msg("Insurance fund withdrawal would exceed minimum balance")]
InsuranceFundBelowMinimum,

#[msg("Invalid insurance fund authority")]
InvalidInsuranceFundAuthority,

#[msg("Insurance fund amount must be greater than zero")]
ZeroInsuranceFundAmount,
```

### Consequences

- **Positive**: Transparent fund management; anyone can contribute; admin can secure funds
- **Negative**: Additional instruction complexity
- **New Instructions**: `deposit_insurance_fund`, `withdraw_insurance_fund`
- **State Changes**: Add `min_insurance_fund` to `ProtocolConfig`

---

## 3. Circuit Breaker

### Context

Protocol needs emergency pause capability for:
- Critical bug discovery
- Exploit detection
- Market anomaly handling
- Upgrades/maintenance

### Decision

**Existing**: `ProtocolConfig` already has `status: ProtocolStatus` enum with `Active/Paused`. Current check in `open_position`:

```rust
constraint = protocol_config.status == ProtocolStatus::Active @ LaunchVaultError::ProtocolPaused
```

**Enhancement**: Extend with circuit breaker parameters:

```rust
// state/protocol_config.rs additions

/// Circuit breaker: number of positions that can be opened within window
pub cb_position_limit: u32,
/// Circuit breaker: time window in seconds
pub cb_window_seconds: i64,
/// Circuit breaker: cooldown after limit triggered (seconds)
pub cb_cooldown_seconds: i64,
/// Circuit breaker: current window start timestamp
pub cb_window_start: i64,
/// Circuit breaker: positions opened in current window
pub cb_positions_in_window: u32,
/// Circuit breaker: timestamp when breaker was last triggered
pub cb_last_triggered: i64,
/// Circuit breaker: is currently in cooldown?
pub cb_in_cooldown: bool,
```

**New Instructions**:

#### 3.1 `pause_protocol`

Admin or executor can pause:

```rust
pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()>
```

- Sets `protocol_config.status = ProtocolStatus::Paused`
- Emits `ProtocolPausedEvent { admin: Pubkey, timestamp: i64 }`

#### 3.2 `resume_protocol`

Only admin can resume:

```rust
pub fn resume_protocol(ctx: Context<ResumeProtocol>) -> Result<()>
```

- Sets `protocol_config.status = ProtocolStatus::Active`
- Resets circuit breaker state
- Emits `ProtocolResumedEvent { admin: Pubkey, timestamp: i64 }`

#### 3.3 `trigger_circuit_breaker` (automatic)

Called at start of `open_position`:

```rust
fn check_circuit_breaker(config: &ProtocolConfig) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    
    // Check if in cooldown
    if config.cb_in_cooldown {
        require!(
            now >= config.cb_last_triggered + config.cb_cooldown_seconds,
            LaunchVaultError::CircuitBreakerTriggered
        );
        // Cooldown expired, reset
    }
    
    // Check window
    if now >= config.cb_window_start + config.cb_window_seconds {
        // New window
        config.cb_window_start = now;
        config.cb_positions_in_window = 0;
    }
    
    // Check limit
    require!(
        config.cb_positions_in_window < config.cb_position_limit,
        LaunchVaultError::CircuitBreakerTriggered
    );
    
    Ok(())
}
```

After successful `open_position`, increment counter.

### What Gets Blocked

When circuit breaker triggers or protocol paused:

- `open_position` — **BLOCKED** (new positions)
- `deposit_lp` — **ALLOWED** (liquidity provision safe)
- `withdraw_lp` — **ALLOWED** (withdrawals safe)
- `sell_position` — **ALLOWED** (users should exit)
- `redeem_tokens` — **ALLOWED** (users should exit)
- `close_position` — **ALLOWED** (cleanup safe)
- `force_close_position` — **ALLOWED** (liquidation safe)
- `deposit_insurance_fund` — **ALLOWED** (contributions safe)
- `withdraw_insurance_fund` — **BLOCKED** (admin action, may be paused for safety)

### Errors (additions)

```rust
#[msg("Circuit breaker triggered — too many positions or cooldown active")]
CircuitBreakerTriggered,

#[msg("Protocol is paused — operation not allowed")]
ProtocolPaused,
```

### Events (additions)

```rust
#[event]
pub struct ProtocolPausedEvent {
    pub pauser: Pubkey,
    pub reason: String,  // optional context
    pub timestamp: i64,
}

#[event]
pub struct ProtocolResumedEvent {
    pub resumer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct CircuitBreakerTriggeredEvent {
    pub positions_in_window: u32,
    pub window_limit: u32,
    pub timestamp: i64,
}
```

### Consequences

- **Positive**: Emergency response capability; rate limiting; protects protocol health
- **Negative**: Complexity in `open_position`; requires careful parameter tuning
- **State Changes**: 7 new fields in `ProtocolConfig`
- **New Instructions**: `pause_protocol`, `resume_protocol`

---

## Summary: New Instructions

| Instruction | Who Can Call | Purpose |
|-------------|--------------|---------|
| `trigger_stop_loss` | Anyone (permissionless) | Execute stop-loss when price threshold met |
| `deposit_insurance_fund` | Anyone | Contribute to insurance fund |
| `withdraw_insurance_fund` | Admin only | Withdraw from insurance fund |
| `pause_protocol` | Admin or Executor | Emergency pause |
| `resume_protocol` | Admin only | Resume from pause |

---

## Summary: State Changes

### LaunchVaultState (additions)

```rust
pub entry_price: u64,           // SOL per 1M tokens at open
pub stop_loss_bps: u16,         // 0 = disabled
pub stop_loss_triggered: bool,
pub stop_loss_timestamp: i64,
```

### ProtocolConfig (additions)

```rust
// Circuit breaker
pub cb_position_limit: u32,
pub cb_window_seconds: i64,
pub cb_cooldown_seconds: i64,
pub cb_window_start: i64,
pub cb_positions_in_window: u32,
pub cb_last_triggered: i64,
pub cb_in_cooldown: bool,
// Safety
pub min_insurance_fund: u64,
```

---

## Implementation Priority

1. **Insurance Fund Operations** — Simplest, low risk
2. **Circuit Breaker (pause/resume)** — Medium complexity
3. **Circuit Breaker (rate limit)** — Requires careful testing
4. **Stop-loss** — Most complex due to price oracle challenge

---

## Open Questions

1. **Stop-loss price**: Should we implement option (a) caller-provided price, or investigate on-chain price calculation from Pump.fun reserves?
2. **Circuit breaker defaults**: What are safe defaults for `cb_position_limit`, `cb_window_seconds`, `cb_cooldown_seconds`?
3. **Insurance fund purpose**: Should withdrawals be limited to specific use cases (e.g., only for executor rewards, not general admin withdraw)?
