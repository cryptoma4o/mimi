# MiMi Protocol

## Что это
DeFi lending протокол на Solana для meme token launches через Pump.fun.
Пользователь берёт LP капитал из пула, покупает токен на Pump.fun, потом продаёт/возвращает.
Модель оплаты: **upfront fee** (fixed + % от LP капитала).

## Архитектура
- Одна Anchor-программа `launch_vault` (Rust, Anchor 0.32.1)
- Program ID: `oNm4QmXFFUXYSYvDkMxW7azSihrViER4Qr1pAUnPvYg`
- Pump.fun v2 CPI (create_v2, buy, sell)
- Token2022 для LP mint (mimi-LP)
- PDA sub-wallets для multi-buyer token launches (Jito Bundle pattern)

## Структура проекта
```
launch_vault/
  programs/launch_vault/src/
    lib.rs                          — Program entry point
    errors.rs                       — 43 error types
    events.rs                       — 10 event types
    state/
      protocol_config.rs            — ProtocolConfig (fees, utilization, timeout)
      lp_pool.rs                    — LpPool (total/reserved/available, LP mint)
      launch_vault_state.rs         — LaunchVaultState (per-position)
      insurance_fund.rs             — InsuranceFund PDA
    instructions/
      initialize_protocol.rs        — Init config + LP mint + insurance fund
      update_protocol_config.rs     — Admin updates params
      deposit_lp.rs                 — SOL → pool, mint mimi-LP
      withdraw_lp.rs                — Burn mimi-LP, get SOL back
      proxy_create_token.rs         — Standalone Pump.fun token creation
      open_position.rs              — Fee + create token + buy loop (main instruction)
      sell_position.rs              — Sell tokens via Pump.fun CPI
      redeem_tokens.rs              — Return tokens, pay LP back
      close_position.rs             — Cleanup vault (permissionless after timeout)
      force_close_position.rs       — Executor emergency liquidation
    cpi/
      pump_fun.rs                   — Pump.fun v2 CPI builders
      token_utils.rs                — SPL Token CPI helpers
```

## LP Pool Accounting Model
- `total_liquidity` = pool's total SOL value (physical + reserved exposure)
- `reserved_liquidity` = SOL exposure in active positions
- `available_liquidity = total - reserved` = physical SOL in pool PDA
- **Инвариант**: Pool PDA physical SOL == available_liquidity

## Ключевые потоки
1. **open_position**: fee → create token → buy tokens → reimburse user from pool → reserve LP
2. **sell_position**: sell via Pump.fun CPI → pool recovers up to proportional_lp → user profit stays on vault
3. **redeem_tokens**: user returns tokens + pays proportional_lp SOL to pool
4. **close_position**: cleanup vault accounts, return all lamports to owner
5. **force_close_position**: executor sells all tokens at any price, recovers what's possible

## Git состояние
- Ветка: `main`
- Последний коммит: `d3eeecc` — PumpFun v2 migration
- **НЕ закоммичен**: полный Phase 0 рефакторинг (rental → upfront fee model)
  - Новые файлы: open_position, sell_position, close_position, force_close_position, insurance_fund
  - Удалены: pay_rental, mark_defaulted, create_vault, proxy_buy_token, launch_bundle, close_vault, liquidate_vault
  - Удалён: весь pumpfun_proxy/
- **НЕ закоммичен**: Phase 0 bugfixes (insurance_fund accounting, TOKEN_2022 constant, close_reward_bps docs)

## Статус аудита
- Phase 0 MVP Core: **завершён**, 0 критических багов
- LP pool accounting: **верифицирован** через 8 сценариев трассировки
- SELL_DISCRIMINATOR: `[0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]` — **VERIFIED on devnet** (2026-03-11)
- Известные design issues:
  - M1: close_reward_bps dead code — **mitigated**: задокументирован как "Reserved for Phase 1" в protocol_config.rs + TODO в close_position.rs
  - M3: insurance_fund.total_sol не обновляется — **fixed**: open_position.rs обновляет insurance_fund.total_sol + emit InsuranceFundUpdatedEvent
- ATA derivation унифицирован: TOKEN_2022_PROGRAM_ID константа в token_utils.rs используется в sell_position, close_position, force_close_position

## Pump.fun v2 CPI Notes
- **Buy**: 17 accounts (includes global_volume_accumulator + user_volume_accumulator)
- **Sell**: 15 accounts (NO volume accumulators, creator_vault at index 8 BEFORE token_program)
- Token program: Token2022 for both buy and sell on devnet

## Что дальше
- [x] Devnet тест sell CPI — **DONE** (2026-03-11)
- [x] Insurance fund accounting fix — **DONE** (2026-03-12)
- [x] ATA derivation unification — **DONE** (2026-03-12)
- [x] PROTOCOL.md rewrite — **DONE** (2026-03-12)
- [x] Tests rewrite — **DONE** (2026-03-12)
- [ ] Phase 1: stop-loss, insurance fund операции, circuit breaker
- [ ] Phase 2: PumpSwap/Raydium CPI для graduated токенов, audit prep

## Команды
```bash
cd launch_vault && anchor build        # Сборка
cd launch_vault && anchor test         # Тесты
cd launch_vault && anchor deploy       # Деплой на devnet
```

## Мульти-агентная система (Kilo Code)

Проект использует **5 специализированных AI-агентов** через кастомные режимы в `.kilocodemodes`.
Координация через встроенный **Orchestrator** режим.

### Агенты

| Режим | Slug | Зона ответственности | Файлы |
|-------|------|---------------------|-------|
| **Solana Dev** | `solana-dev` | Rust/Anchor смарт-контракты, CPI, state | `*.rs`, `Cargo.toml` |
| **Frontend** | `frontend` | Next.js/React UI, хуки, провайдеры | `app/web/**/*.tsx` |
| **Tester** | `tester` | Тесты, валидация, CLI скрипты | `tests/*.ts`, `app/cli.ts` |
| **Auditor** | `auditor` | Аудит безопасности (read-only код) | `*.md` (только отчёты) |
| **DevOps** | `devops` | Деплой, конфиги, миграции | `Anchor.toml`, `migrations/` |

### Как использовать

1. **Простая задача** → выбери нужный режим напрямую (Solana Dev, Frontend, etc.)
2. **Сложная задача** → используй **Orchestrator**, он разобьёт на подзадачи и делегирует агентам
3. **Ревью кода** → используй **Auditor** для аудита или **Review** для code review

### Пример workflow

```
Orchestrator: "Добавить stop-loss в Phase 1"
  → solana-dev: написать stop_loss.rs инструкцию
  → tester: написать тесты для stop-loss
  → frontend: добавить UI для stop-loss настройки
  → auditor: проревьюить безопасность
  → devops: задеплоить на devnet
```
