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
    lib.rs                          — Program entry point (16 instructions)
    errors.rs                       — 48 error types
    events.rs                       — 17 event types
    state/
      mod.rs                        — State module exports
      protocol_config.rs            — ProtocolConfig (fees, utilization, timeout, circuit breaker)
      lp_pool.rs                    — LpPool (total/reserved/available, LP mint)
      launch_vault_state.rs         — LaunchVaultState (per-position)
      insurance_fund.rs             — InsuranceFund PDA
    instructions/
      mod.rs                        — Instructions module exports
      initialize_protocol.rs        — Init config + LP mint + insurance fund
      update_protocol_config.rs     — Admin updates params (включая circuit breaker)
      migrate_protocol.rs           — One-time realloc + remap data layout
      deposit_lp.rs                 — SOL → pool, mint mimi-LP
      withdraw_lp.rs                — Burn mimi-LP, get SOL back
      proxy_create_token.rs         — Standalone Pump.fun token creation
      open_position.rs              — Fee + create token + buy loop (main instruction)
      sell_position.rs              — Sell tokens via Pump.fun CPI
      redeem_tokens.rs              — Return tokens, pay LP back
      close_position.rs             — Cleanup vault (permissionless after timeout)
      force_close_position.rs       — Executor emergency liquidation
      trigger_stop_loss.rs          — Stop-loss auto-sell (executor)
      deposit_insurance_fund.rs     — Admin deposits SOL into insurance fund
      withdraw_insurance_fund.rs    — Admin withdraws SOL from insurance fund
      pause_protocol.rs             — Admin/executor pauses protocol (circuit breaker)
      resume_protocol.rs            — Admin resumes protocol after cooldown
    cpi/
      mod.rs                        — CPI module exports
      pump_fun.rs                   — Pump.fun v2 CPI builders
      token_utils.rs                — SPL Token CPI helpers + TOKEN_2022_PROGRAM_ID
  app/
    web/                            — Next.js 14 frontend (React 18, TailwindCSS)
      src/
        app/                        — Pages: /, /admin, /dashboard, /launch, /token/create, /vault/create, /vault/[address]
        components/                 — UI: LaunchBundleForm, VaultDetail, VaultList, VaultCard, VaultStatusBadge, RedeemForm, CreateTokenForm, CreateVaultForm, Navbar, ProtocolStats
        hooks/                      — useAllVaults, useLpPool, useProgram, useProtocolConfig, useUserVaults
        lib/                        — alt, constants, errors, format, idl, pda, transactions
        providers/                  — ClusterProvider, QueryProvider, SolanaProvider
    cli.ts                          — CLI tool для on-chain операций
    faucet.ts                       — SOL faucet утилита (devnet)
    .launch-alt-devnet.json         — Address Lookup Table config (devnet)
  tests/
    launch_vault.ts                 — Main test suite
  migrations/
    deploy.ts                       — Anchor migration script
  PROTOCOL.md                       — Детальная документация протокола (1186 строк)
  Anchor.toml                       — Anchor config (devnet cluster)
  Cargo.toml                        — Rust workspace
  deploy.sh                         — Deployment script
plans/                              — Планы и анализ
  phase1-design.md                  — Phase 1 feature design
  executor-removal-analysis.md      — Executor removal analysis
  frontend-sync-plan.md             — Frontend sync plan
  multi-agent-plan.md               — Multi-agent orchestration plan
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
6. **trigger_stop_loss**: executor auto-sells when price drops below threshold
7. **pause_protocol / resume_protocol**: circuit breaker (rate limit + manual pause)
8. **deposit/withdraw_insurance_fund**: admin manages insurance fund SOL balance

## Git состояние
- Ветка: `main`
- Последний коммит: `dab28fc` — remove executor from open_position, ALT support, insurance fund accounting
- **НЕ закоммичен**: Phase 1 инструкции + audit fixes (2026-03-13)

## Статус аудита
- Phase 0 MVP Core: **завершён**, 0 критических багов
- LP pool accounting: **верифицирован** через 8 сценариев трассировки
- SELL_DISCRIMINATOR: `[0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]` — **VERIFIED on devnet** (2026-03-11)
- **Full audit (2026-03-13)**: 5 агентов (Architect, Auditor, Reviewer, Tester, Frontend)
- Исправлено (2026-03-13):
  - C1: division by zero в redeem_tokens — **fixed**: require!(remaining_token_amount > 0)
  - C2: division by zero в trigger_stop_loss — **fixed**: require!(pre_sell_remaining > 0)
  - C4: token_program без constraint — **fixed**: constraint == TOKEN_2022_PROGRAM_ID в sell/force_close/trigger_stop_loss + новый error InvalidTokenProgram
  - H2: position_timeout minimum — **fixed**: >= 300 (5 min) в initialize_protocol + update_protocol_config
  - H3: min_user_ratio_bps без валидации — **fixed**: require!(<= 10_000) в initialize_protocol
  - H4: unwrap_or(0) скрывает overflow — **fixed**: .ok_or(ArithmeticOverflow)? в deposit_lp
  - Frontend: 17 error codes (6033-6049) добавлены в errors.ts
  - Frontend: 5 Phase 1 transaction builders добавлены в transactions.ts
- Известные design issues (не исправлены):
  - M1: close_reward_bps dead code — **mitigated**: задокументирован как "Reserved for Phase 1"
  - M2: deposit_lp не проверяет ProtocolStatus::Paused — требует добавление аккаунта в struct (инвазивно)
  - C5: lp_mint_supply кэшируется и может расходиться с actual mint supply — рассмотреть в Phase 2
  - M5: circuit breaker race condition (2 tx в одном slot) — inherent to Solana, documented as known limitation
- ATA derivation унифицирован: TOKEN_2022_PROGRAM_ID константа в token_utils.rs

## Pump.fun v2 CPI Notes
- **Buy**: 17 accounts (includes global_volume_accumulator + user_volume_accumulator)
- **Sell**: 15 accounts (NO volume accumulators, creator_vault at index 8 BEFORE token_program)
- Token program: Token2022 for both buy and sell on devnet

## Что дальше
- [x] Phase 0: upfront fee model — **DONE**
- [x] Devnet тест sell CPI — **DONE** (2026-03-11)
- [x] Insurance fund accounting fix — **DONE** (2026-03-12)
- [x] ATA derivation unification — **DONE** (2026-03-12)
- [x] PROTOCOL.md rewrite — **DONE** (2026-03-12)
- [x] Tests rewrite — **DONE** (2026-03-12)
- [x] Phase 1 инструкции написаны: stop-loss, insurance fund ops, circuit breaker, pause/resume, migrate
- [x] Full project audit (5 agents) — **DONE** (2026-03-13)
- [x] Critical/High bug fixes (C1, C2, C4, H2, H3, H4) — **DONE** (2026-03-13)
- [x] Phase 1 frontend builders (triggerStopLoss, pause/resume, insurance fund) — **DONE** (2026-03-13)
- [x] Phase 1 error codes в TypeScript (17 codes) — **DONE** (2026-03-13)
- [ ] Phase 1: интеграция и тестирование новых инструкций на devnet
- [ ] Phase 1: фронтенд UI компоненты для stop-loss, pause, insurance fund
- [ ] Phase 1: integration тесты (on-chain, 40-50 тестов нужно)
- [ ] Phase 2: PumpSwap/Raydium CPI для graduated токенов, audit prep

## Команды
```bash
cd launch_vault && anchor build        # Сборка
cd launch_vault && anchor test         # Тесты
cd launch_vault && anchor deploy       # Деплой на devnet
```

## Мульти-агентная система (Claude Code)

Проект использует **11 специализированных AI-агентов** через custom slash commands в `.claude/commands/`.

### Агенты

| Команда | Агент | Зона ответственности |
|---------|-------|---------------------|
| `/solana-dev` | Solana Dev | Rust/Anchor контракты, CPI, state |
| `/frontend` | Frontend | Next.js/React UI, хуки, провайдеры |
| `/tester` | Tester | Тесты, валидация, CLI скрипты |
| `/auditor` | Auditor | Аудит безопасности (read-only) |
| `/devops` | DevOps | Деплой, конфиги, VPS, миграции |
| `/architect` | Protocol Architect | Архитектура, дизайн, trade-offs |
| `/reviewer` | Code Reviewer | Code review, PR review |
| `/cli` | CLI Engineer | CLI инструменты, скрипты |
| `/monitor` | Monitor & Analytics | Мониторинг, метрики, алерты |
| `/docs` | Documentation Writer | Документация, PROTOCOL.md |
| `/orchestrate` | Orchestrator | Координация агентов, сложные задачи |

### Как использовать

1. **Простая задача** → вызови нужного агента напрямую (`/solana-dev`, `/frontend`, etc.)
2. **Сложная задача** → используй `/orchestrate`, он разобьёт на подзадачи и делегирует агентам
3. **Ревью кода** → `/reviewer` для code review, `/auditor` для аудита безопасности

### Пример workflow

```
/orchestrate "Протестировать stop-loss на devnet"
  → /solana-dev: проверить trigger_stop_loss.rs
  → /tester: написать тесты для stop-loss
  → /devops: задеплоить на devnet
  → /auditor: проревьюить безопасность
```

## Сервер (Production)

**VPS**: 45.67.35.145
**SSH**: `ssh root@45.67.35.145` или `ssh mimi-prod`
**Конфиг**: ~/.ssh/config (alias: mimi-prod)

**Фронтенд**: https://45.67.35.145
**Директория**: /var/www/mimi

**Деплой**:
1. `cd launch_vault/app/web && npm run build`
2. `scp -r build/* root@45.67.35.145:/var/www/mimi/`
3. `ssh root@45.67.35.145 "pm2 restart mimi"`
