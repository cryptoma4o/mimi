# LaunchVault Protocol

Solana-программа (Anchor 0.32.1) — протокол ликвидности для запуска токенов на Pump.fun v2.

**Program ID:** `oNm4QmXFFUXYSYvDkMxW7azSihrViER4Qr1pAUnPvYg`

---

## Оглавление

- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Роли](#роли)
- [State (PDA-аккаунты)](#state-pda-аккаунты)
- [PDA-адреса](#pda-адреса)
- [Fees (комиссии)](#fees-комиссии)
- [LP Pool Accounting](#lp-pool-accounting)
- [Инструкции](#инструкции)
  - [initialize_protocol](#1-initialize_protocol)
  - [update_protocol_config](#2-update_protocol_config)
  - [deposit_lp](#3-deposit_lp)
  - [withdraw_lp](#4-withdraw_lp)
  - [proxy_create_token](#5-proxy_create_token)
  - [open_position](#6-open_position)
  - [sell_position](#7-sell_position)
  - [redeem_tokens](#8-redeem_tokens)
  - [close_position](#9-close_position)
  - [force_close_position](#10-force_close_position)
- [CPI к Pump.fun v2](#cpi-к-pumpfun-v2)
- [CPI Token2022 (token_utils)](#cpi-token2022-token_utils)
- [SOL Flow](#sol-flow)
- [Token Flow](#token-flow)
- [Vault Lifecycle](#vault-lifecycle)
- [Ошибки](#ошибки)
- [События (Events)](#события-events)
- [Структура файлов](#структура-файлов)

---

## Обзор

LaunchVault предоставляет **заёмную ликвидность** для запуска токенов на Pump.fun v2. Протокол решает проблему: у создателя токена нет достаточно SOL для покупки своего токена на bonding curve.

### Модель: Upfront Fee

Протокол использует модель **однократной предоплаты (upfront fee)** вместо аренды. Пользователь платит фиксированный + процентный сбор при открытии позиции, после чего долг перед LP пулом фиксируется и погашается через продажу токенов (`sell_position`) или возврат токенов (`redeem_tokens`).

### Как это работает

1. **LP-провайдеры** наполняют пул SOL, получая mimi-LP токены (Token2022)
2. Пользователь вызывает `open_position`: создаёт токен на Pump.fun, платит upfront fee, протокол выделяет SOL из LP пула + user contribution для покупки токенов через PDA sub-wallets
3. Купленные токены консолидируются на vault ATA (принадлежащем vault PDA)
4. Пользователь продаёт токены (`sell_position`) — SOL возвращается в LP пул пропорционально
5. Или пользователь забирает токены (`redeem_tokens`) — платит SOL пулу + redemption fee
6. Позиция закрывается (`close_position`) — аккаунт утилизируется, rent возвращается

### Ключевые особенности

- **До 5 buyer PDA** для бандл-покупок (имитация нескольких кошельков)
- **Upfront fee** = fixed_fee + percentage от LP allocation
- **Insurance fund** — часть комиссий уходит в страховой фонд
- **Permissionless close** — после timeout любой может закрыть позицию за награду
- **Force close** — executor может экстренно продать все токены
- **Utilization cap** — ограничение % использования LP пула

---

## Архитектура

```
┌──────────────────────────────────────────────────┐
│                  LaunchVault Program               │
│              oNm4QmXFFUXYSYvDkMxW7azS...          │
│                                                    │
│  ┌────────────┐  ┌────────┐  ┌───────────────┐    │
│  │ProtocolConfig│ │ LpPool │  │InsuranceFund  │    │
│  └────────────┘  └────────┘  └───────────────┘    │
│                                                    │
│  ┌──────────────────────────────────┐              │
│  │ LaunchVaultState (per user+mint) │              │
│  │   vault ATA ◄── buyer PDAs      │              │
│  └──────────────────────────────────┘              │
│                                                    │
│  CPI ──► Pump.fun v2 (create_v2, buy, sell)        │
│  CPI ──► Token2022 (mint, burn, transfer)          │
│  CPI ──► Mayhem (через create_v2)                  │
└──────────────────────────────────────────────────┘
```

---

## Роли

| Роль | Описание | Доступные инструкции |
|------|----------|---------------------|
| **Admin** | Создатель протокола, управляет конфигурацией | `initialize_protocol`, `update_protocol_config` |
| **Executor** | Доверенный оператор для исполнения buy CPI и экстренных закрытий | `open_position` (подписывает buy CPI), `sell_position` (как keeper), `force_close_position` |
| **User** | Создатель позиции, владелец vault | `open_position`, `sell_position` (свой vault), `redeem_tokens`, `close_position` (свой vault) |
| **LP Provider** | Поставщик ликвидности | `deposit_lp`, `withdraw_lp` |
| **Anyone** | Любой пользователь | `close_position` (после timeout — permissionless close) |

---

## State (PDA-аккаунты)

### ProtocolConfig

Seed: `[b"protocol_config"]`

| Поле | Тип | Описание |
|------|-----|----------|
| `admin` | `Pubkey` | Адрес администратора |
| `executor` | `Pubkey` | Адрес executor'а (подписывает buy CPI, force close) |
| `treasury` | `Pubkey` | Адрес казначейства (получает комиссии) |
| `fixed_fee` | `u64` | Фиксированная комиссия за открытие позиции (lamports) |
| `fee_bps` | `u16` | Процентная комиссия на LP allocation (basis points, 200 = 2%) |
| `max_utilization_bps` | `u16` | Максимальная утилизация LP пула (basis points, 8500 = 85%) |
| `position_timeout` | `i64` | Таймаут позиции в секундах (после которого разрешён permissionless close) |
| `close_reward_bps` | `u16` | Награда за permissionless close (basis points от remaining LP) |
| `insurance_split_bps` | `u16` | Доля комиссий в страховой фонд (basis points, 2000 = 20%) |
| `redemption_fee_bps` | `u16` | Комиссия при redeem (basis points, 10000 = 100%) |
| `status` | `ProtocolStatus` | Статус протокола: `Active` / `Paused` |
| `bump` | `u8` | PDA bump |

### LpPool

Seed: `[b"lp_pool"]`

| Поле | Тип | Описание |
|------|-----|----------|
| `total_liquidity` | `u64` | Общий SOL в пуле (lamports) — физический + зарезервированный |
| `reserved_liquidity` | `u64` | SOL зарезервированный для активных позиций (lamports) |
| `available_liquidity` | `u64` | SOL доступный для новых позиций и вывода (total - reserved) |
| `lp_mint` | `Pubkey` | Адрес LP токен минта (mimi-LP, Token2022) |
| `lp_mint_supply` | `u64` | Кэшированный supply LP токенов |
| `total_defaults` | `u32` | Общее число дефолтов (для аналитики / circuit breaker) |
| `total_positions_closed` | `u32` | Общее число закрытых позиций |
| `authority` | `Pubkey` | Authority пула (admin) |
| `bump` | `u8` | PDA bump |

### LaunchVaultState

Seed: `[b"vault", user.key(), mint.key()]`

| Поле | Тип | Описание |
|------|-----|----------|
| `user` | `Pubkey` | Владелец vault |
| `token_mint` | `Pubkey` | Адрес токена (mint) |
| `total_token_amount` | `u64` | Всего токенов куплено при open |
| `remaining_token_amount` | `u64` | Оставшиеся токены в vault |
| `total_lp_allocation` | `u64` | Общий LP allocation из пула (lamports) |
| `remaining_lp_allocation` | `u64` | Оставшийся LP долг (lamports) |
| `user_contribution` | `u64` | Собственный вклад пользователя (lamports) |
| `status` | `VaultStatus` | Статус: `Active` / `Closed` / `TimedOut` |
| `open_timestamp` | `i64` | Unix timestamp открытия позиции |
| `fee_paid` | `u64` | Уплаченная upfront fee (lamports) |
| `num_sub_wallets` | `u8` | Количество buyer PDA, использованных при покупке |
| `bump` | `u8` | PDA bump |

### InsuranceFund

Seed: `[b"insurance_fund"]`

| Поле | Тип | Описание |
|------|-----|----------|
| `total_sol` | `u64` | Общий SOL в страховом фонде (lamports) |
| `authority` | `Pubkey` | Authority (admin) |
| `bump` | `u8` | PDA bump |

> **Примечание:** InsuranceFund аккумулирует SOL на lamports самого PDA-аккаунта. Поле `total_sol` является справочным счётчиком.

---

## PDA-адреса

| PDA | Seeds | Описание |
|-----|-------|----------|
| `protocol_config` | `[b"protocol_config"]` | Глобальная конфигурация протокола |
| `lp_pool` | `[b"lp_pool"]` | LP пул (хранит SOL как lamports на аккаунте) |
| `lp_mint` | `[b"lp_mint"]` | Минт LP токенов (Token2022, 9 decimals), mint authority = сам PDA |
| `insurance_fund` | `[b"insurance_fund"]` | Страховой фонд (SOL на PDA) |
| `vault` | `[b"vault", user, mint]` | Состояние vault позиции |
| `buyer` | `[b"buyer", vault_pda, &[index]]` | Временные buyer PDA для покупки (index: 0..4) |

---

## Fees (комиссии)

### При открытии позиции (open_position)

```
percentage_fee = lp_allocation * fee_bps / 10_000
total_fee      = fixed_fee + percentage_fee
insurance_amount = total_fee * insurance_split_bps / 10_000  → insurance_fund PDA
treasury_amount  = total_fee - insurance_amount               → treasury
```

Пользователь платит `total_fee` из своего кошелька при вызове `open_position`. Комиссия разделяется между treasury и insurance fund.

### При выкупе токенов (redeem_tokens)

```
proportional_lp  = amount * remaining_lp_allocation / remaining_token_amount
redemption_fee   = proportional_lp * redemption_fee_bps / 10_000  → treasury
```

Пользователь платит `proportional_lp` в LP пул (возврат заёмных средств) + `redemption_fee` в treasury.

### При продаже (sell_position)

Комиссия не взимается. SOL от продажи через Pump.fun возвращается в LP пул пропорционально (`pool_recovery = min(sol_received, proportional_lp)`). Остаток (прибыль пользователя) остаётся на vault PDA и возвращается пользователю при `close_position`.

### При permissionless close

```
close_reward = remaining_lp_allocation * close_reward_bps / 10_000
```

Награда выплачивается closer'у из LP пула.

---

## LP Pool Accounting

LP пул учитывает SOL через три показателя:

```
total_liquidity     = общий SOL (физический на аккаунте + зарезервированный в позициях)
reserved_liquidity  = SOL экспозиция в активных позициях
available_liquidity = total_liquidity - reserved_liquidity = физический SOL на PDA
```

### Deposit

```
if supply == 0 || total_liquidity == 0:
    lp_tokens = amount                          // 1:1 для первого депозита
else:
    lp_tokens = amount * lp_mint_supply / total_liquidity
```

SOL переводится на PDA lp_pool, mimi-LP минтятся на ATA депозитора.

### Withdraw

```
sol_out = lp_amount * total_liquidity / lp_mint_supply
```

Проверяется: `sol_out <= available_liquidity` и rent-exemption аккаунта lp_pool. LP токены сжигаются, SOL переводится с PDA lp_pool на withdrawer.

### LP Token Price

```
lp_token_price = total_liquidity * 1_000_000_000 / lp_mint_supply   // 9 decimals
```

Цена LP токена плавает: растёт при успешных продажах (fee revenue), падает при дефолтах (LP loss).

---

## Инструкции

### 1. initialize_protocol

Инициализация протокола: создание config, LP pool, insurance fund и LP mint (Token2022).

**Доступ:** Admin (первый вызов, аккаунты создаются через `init`)

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `executor` | `Pubkey` | Адрес executor'а |
| `treasury` | `Pubkey` | Адрес казначейства |
| `fixed_fee` | `u64` | Фиксированная комиссия (lamports) |
| `fee_bps` | `u16` | Процентная комиссия (basis points, ≤ 10000) |
| `max_utilization_bps` | `u16` | Max утилизация пула (0 < bps ≤ 10000) |
| `position_timeout` | `i64` | Таймаут позиции (секунды, > 0) |
| `close_reward_bps` | `u16` | Награда за close (basis points, ≤ 10000) |
| `insurance_split_bps` | `u16` | Доля в insurance (basis points, ≤ 10000) |
| `redemption_fee_bps` | `u16` | Комиссия redeem (basis points, ≤ 10000) |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `admin` | Signer, mut | Создатель протокола, платит rent |
| 1 | `protocol_config` | PDA, init | Seed: `[b"protocol_config"]` |
| 2 | `lp_pool` | PDA, init | Seed: `[b"lp_pool"]` |
| 3 | `insurance_fund` | PDA, init | Seed: `[b"insurance_fund"]` |
| 4 | `lp_mint` | UncheckedAccount, mut | PDA: `[b"lp_mint"]`, инициализируется через Token2022 CPI |
| 5 | `token_program` | Program | Token2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) |
| 6 | `system_program` | Program | System Program |
| 7 | `rent` | Sysvar | Rent sysvar |

**Логика:**
1. Валидация: все bps ≤ 10000, position_timeout > 0
2. Создание LP mint PDA через CPI к Token2022 (`create_account` + `initialize_mint2`): 9 decimals, authority = lp_mint PDA
3. Инициализация ProtocolConfig: admin = signer, status = Active
4. Инициализация LpPool: все нули, lp_mint = PDA
5. Инициализация InsuranceFund: total_sol = 0
6. Emit `ProtocolInitializedEvent`

---

### 2. update_protocol_config

Обновление параметров протокола. Все аргументы опциональны — обновляются только переданные.

**Доступ:** Admin (проверка `admin.key() == protocol_config.admin`)

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `new_executor` | `Option<Pubkey>` | Новый executor |
| `new_treasury` | `Option<Pubkey>` | Новый treasury |
| `new_fixed_fee` | `Option<u64>` | Новая фиксированная комиссия |
| `new_fee_bps` | `Option<u16>` | Новая процентная комиссия |
| `new_max_utilization_bps` | `Option<u16>` | Новый max utilization |
| `new_position_timeout` | `Option<i64>` | Новый таймаут |
| `new_close_reward_bps` | `Option<u16>` | Новая награда за close |
| `new_insurance_split_bps` | `Option<u16>` | Новая доля insurance |
| `new_redemption_fee_bps` | `Option<u16>` | Новая комиссия redeem |
| `new_admin` | `Option<Pubkey>` | Новый admin (transfer ownership) |
| `new_status` | `Option<ProtocolStatus>` | Новый статус (Active/Paused) |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `admin` | Signer | Текущий admin |
| 1 | `protocol_config` | PDA, mut | Seed: `[b"protocol_config"]` |

**Логика:**
1. Проверка: signer == config.admin
2. Обновление каждого переданного поля с валидацией (bps ≤ 10000, timeout > 0)
3. Emit `ProtocolConfigUpdatedEvent`

---

### 3. deposit_lp

Депозит SOL в LP пул, получение mimi-LP токенов.

**Доступ:** Любой пользователь

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Сумма SOL для депозита (lamports, > 0) |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `depositor` | Signer, mut | Депозитор |
| 1 | `lp_pool` | PDA, mut | Seed: `[b"lp_pool"]` |
| 2 | `lp_mint` | UncheckedAccount, mut | LP mint PDA, проверяется vs lp_pool.lp_mint |
| 3 | `depositor_lp_ata` | UncheckedAccount, mut | ATA депозитора для LP токенов |
| 4 | `token_program` | Program | Token2022 |
| 5 | `associated_token_program` | Program | Associated Token Program |
| 6 | `system_program` | Program | System Program |

**Логика:**
1. Проверка: amount > 0
2. Рассчёт lp_tokens_to_mint: 1:1 если первый депозит, иначе `amount * supply / total_liquidity`
3. Проверка: lp_tokens_to_mint > 0
4. Transfer SOL: depositor → lp_pool PDA (system_program::transfer)
5. Create ATA idempotently (CPI к Associated Token Program)
6. Mint LP tokens: lp_mint → depositor_lp_ata (CPI к Token2022, authority = lp_mint PDA)
7. Update lp_pool: total_liquidity += amount, available_liquidity = total - reserved, lp_mint_supply += minted
8. Emit `LpDepositedEvent`

---

### 4. withdraw_lp

Вывод SOL из LP пула, сжигание mimi-LP токенов.

**Доступ:** Любой пользователь (holder LP токенов)

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `lp_amount` | `u64` | Количество LP токенов для сжигания (> 0) |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `withdrawer` | Signer, mut | Владелец LP токенов |
| 1 | `lp_pool` | PDA, mut | Seed: `[b"lp_pool"]` |
| 2 | `lp_mint` | UncheckedAccount, mut | LP mint PDA |
| 3 | `withdrawer_lp_ata` | UncheckedAccount, mut | ATA withdrawer'а для LP токенов |
| 4 | `token_program` | Program | Token2022 |
| 5 | `system_program` | Program | System Program |

**Логика:**
1. Проверка: lp_amount > 0, lp_mint_supply > 0
2. Рассчёт: `sol_out = lp_amount * total_liquidity / lp_mint_supply`
3. Проверка: sol_out > 0, sol_out ≤ available_liquidity, rent-exemption сохраняется
4. Burn LP tokens: withdrawer сжигает из своего ATA (CPI к Token2022, authority = withdrawer)
5. Transfer SOL: lp_pool PDA → withdrawer (прямой перенос lamports)
6. Update lp_pool: total_liquidity -= sol_out, lp_mint_supply -= lp_amount, available = total - reserved
7. Emit `LpWithdrawnEvent`

---

### 5. proxy_create_token

Создание токена на Pump.fun v2 без открытия позиции (standalone).

**Доступ:** Любой пользователь

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `name` | `String` | Название токена |
| `symbol` | `String` | Символ токена |
| `uri` | `String` | URI метаданных |
| `is_mayhem_mode` | `bool` | Использовать Mayhem mode |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `user` | Signer, mut | Создатель токена |
| 1 | `mint` | Signer, mut | Новый keypair для токена |
| 2 | `pump_program` | Pump.fun program | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| 3 | `pump_global` | UncheckedAccount, mut | Pump global state |
| 4 | `pump_mint_authority` | UncheckedAccount | Pump mint authority PDA |
| 5 | `pump_bonding_curve` | UncheckedAccount, mut | Bonding curve PDA |
| 6 | `pump_associated_bonding_curve` | UncheckedAccount, mut | Associated bonding curve token account |
| 7 | `mayhem_program` | UncheckedAccount, mut | Mayhem program (`MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e`) |
| 8 | `mayhem_global_params` | UncheckedAccount | Mayhem global params PDA |
| 9 | `mayhem_sol_vault` | UncheckedAccount, mut | Mayhem SOL vault |
| 10 | `mayhem_state` | UncheckedAccount, mut | Mayhem state PDA |
| 11 | `mayhem_token_vault` | UncheckedAccount, mut | Mayhem token vault |
| 12 | `pump_event_authority` | UncheckedAccount | Event authority PDA |
| 13 | `system_program` | Program | System Program |
| 14 | `token_program` | UncheckedAccount | Token2022 |
| 15 | `associated_token_program` | Program | Associated Token Program |

**Логика:**
1. Build CPI `create_v2` instruction для Pump.fun v2
2. `invoke()` (пользователь подписывает, mint keypair подписывает)
3. Emit `TokenCreatedEvent`

---

### 6. open_position

**Основная инструкция протокола.** Создаёт токен на Pump.fun, платит upfront fee, покупает токены через buyer PDA, консолидирует в vault.

**Доступ:** Любой пользователь (executor не требуется как signer — buyer PDA подписывают CPI)

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `name` | `String` | Название токена |
| `symbol` | `String` | Символ токена |
| `uri` | `String` | URI метаданных |
| `is_mayhem_mode` | `bool` | Mayhem mode при создании |
| `lp_allocation` | `u64` | SOL из LP пула (lamports, > 0) |
| `user_contribution` | `u64` | Собственный SOL пользователя (lamports, > 0) |
| `buy_amounts` | `Vec<u64>` | Количество токенов для каждого buyer (1–5 элементов) |
| `max_sol_costs` | `Vec<u64>` | Max SOL для каждого buyer |

**Аккаунты (именованные):**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `user` | Signer, mut | Создатель позиции |
| 1 | `mint` | Signer, mut | Keypair нового токена |
| 2 | `vault_state` | UncheckedAccount, mut | PDA vault (инициализируется вручную) |
| 3 | `protocol_config` | PDA | Seed: `[b"protocol_config"]`, status == Active |
| 4 | `lp_pool` | PDA, mut | Seed: `[b"lp_pool"]` |
| 5 | `treasury` | UncheckedAccount, mut | Проверяется vs protocol_config.treasury |
| 6 | `insurance_fund` | UncheckedAccount, mut | Seed: `[b"insurance_fund"]` |
| 7 | `pump_program` | Pump.fun program | |
| 8 | `pump_global` | mut | Pump global state |
| 9 | `pump_mint_authority` | | Pump mint authority |
| 10 | `pump_bonding_curve` | mut | Bonding curve PDA |
| 11 | `pump_associated_bonding_curve` | mut | |
| 12 | `pump_event_authority` | | |
| 13 | `pump_fee_recipient` | mut | |
| 14 | `mayhem_program` | mut | |
| 15 | `mayhem_global_params` | | |
| 16 | `mayhem_sol_vault` | mut | |
| 17 | `mayhem_state` | mut | |
| 18 | `mayhem_token_vault` | mut | |
| 19 | `pump_global_volume_accumulator` | | |
| 20 | `pump_creator_vault` | mut | |
| 21 | `pump_fee_config` | | |
| 22 | `pump_bonding_curve_v2` | | |
| 23 | `pump_fee_program` | | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` |
| 24 | `system_program` | Program | |
| 25 | `token_program` | | Token2022 |
| 26 | `associated_token_program` | Program | |
| 27 | `rent` | Sysvar | |

**remaining_accounts (динамические):**

```
[vault_token_account, buyer_0_pda, buyer_0_ata, buyer_0_vol, buyer_1_pda, buyer_1_ata, buyer_1_vol, ...]
```

Итого: `1 + num_buyers * 3` remaining accounts.

**Логика (7 шагов):**

1. **Validation:**
   - 1 ≤ num_buyers ≤ 5
   - buy_amounts.len() == max_sol_costs.len()
   - lp_allocation > 0, user_contribution > 0
   - lp_allocation ≤ available_liquidity
   - Utilization cap: `(reserved + lp_allocation) / total_liquidity ≤ max_utilization_bps`
   - remaining_accounts.len() == 1 + num_buyers * 3
   - sum(max_sol_costs) ≤ lp_allocation + user_contribution

2. **Calculate & pay upfront fee:**
   - `percentage_fee = lp_allocation * fee_bps / 10000`
   - `total_fee = fixed_fee + percentage_fee`
   - `insurance_amount = total_fee * insurance_split_bps / 10000` → insurance_fund
   - `treasury_amount = total_fee - insurance_amount` → treasury

3. **CPI create_v2:** Создание токена на Pump.fun через invoke() (user и mint подписывают)

4. **Initialize vault_state PDA:** Ручное создание аккаунта через `create_account` + invoke_signed

5. **Create vault ATA:** ATA vault_pda для token_mint

6. **Reserve LP + Buy loop (для каждого buyer i):**
   - Reserve: lp_pool.reserved += lp_allocation, available = total - reserved
   - Fund buyer PDA: user → buyer_pda_i (max_sol_costs[i] SOL)
   - Create buyer ATA
   - CPI buy: buyer PDA подписывает через invoke_signed
   - Read actual tokens purchased
   - Transfer tokens: buyer ATA → vault ATA
   - Close buyer ATA (rent → user)
   - Return unused SOL: buyer PDA → user

7. **Finalize:**
   - Reimburse user for LP pool share: `pool_share = min(total_sol_spent, lp_allocation)`, pool → user
   - Adjust reservation if buys cost less than lp_allocation
   - Write vault state: status = Active, actual lp_deployed, total tokens, etc.
   - Emit `PositionOpenedEvent`

---

### 7. sell_position

Продажа токенов через Pump.fun CPI. SOL возвращается в LP пул (пропорционально LP allocation).

**Доступ:** Vault owner ИЛИ executor (keeper)

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Количество токенов для продажи (> 0) |
| `min_sol_output` | `u64` | Минимальный SOL от продажи (slippage protection) |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `seller` | Signer, mut | vault_state.user ИЛИ protocol_config.executor |
| 1 | `vault_state` | PDA, mut | Seed: `[b"vault", user, mint]`, status == Active |
| 2 | `protocol_config` | PDA | |
| 3 | `lp_pool` | PDA, mut | |
| 4 | `vault_token_account` | UncheckedAccount, mut | ATA vault PDA для token_mint |
| 5 | `token_mint` | UncheckedAccount | mint == vault_state.token_mint |
| 6–16 | Pump.fun accounts | | global, fee_recipient, bonding_curve, associated_bonding_curve, event_authority, creator_vault, fee_config, bonding_curve_v2, pump_fee_program |
| 17 | `system_program` | Program | |
| 18 | `token_program` | | Token2022 |

**Логика:**
1. Проверка: amount > 0, amount ≤ remaining_token_amount
2. Запись vault lamports до продажи
3. CPI sell: vault PDA подписывает через invoke_signed (SOL приходит на vault PDA)
4. `sol_received = vault_lamports_after - vault_lamports_before`
5. Чтение фактического остатка токенов, рассчёт tokens_sold
6. `proportional_lp = tokens_sold * remaining_lp / remaining_tokens`
7. `pool_recovery = min(sol_received, proportional_lp)` → transfer vault PDA → lp_pool
8. Update vault: remaining_token_amount, remaining_lp_allocation; если tokens == 0 → status = Closed
9. Update lp_pool: reserved -= proportional_lp; если lp_loss > 0: total -= lp_loss; available = total - reserved
10. Emit `PositionSoldEvent`

> **Примечание:** Если SOL от продажи > proportional_lp, разница (прибыль) остаётся на vault PDA и возвращается user при close_position.

---

### 8. redeem_tokens

Возврат токенов пользователю за SOL (пользователь оплачивает LP долг + redemption fee).

**Доступ:** Vault owner

**Аргументы:**

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Количество токенов для выкупа (> 0) |

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `user` | Signer, mut | vault_state.user |
| 1 | `vault_state` | PDA, mut | Seed: `[b"vault", user, mint]`, status == Active |
| 2 | `protocol_config` | PDA | |
| 3 | `lp_pool` | PDA, mut | |
| 4 | `treasury` | UncheckedAccount, mut | protocol_config.treasury |
| 5 | `vault_token_account` | UncheckedAccount, mut | ATA vault PDA |
| 6 | `user_token_account` | UncheckedAccount, mut | ATA пользователя |
| 7 | `token_mint` | UncheckedAccount | vault_state.token_mint |
| 8 | `system_program` | Program | |
| 9 | `token_program` | | Token2022 |

**Логика:**
1. Проверка: amount > 0, amount ≤ remaining_token_amount
2. `proportional_lp = amount * remaining_lp_allocation / remaining_token_amount`
3. Проверка: proportional_lp > 0
4. `redemption_fee = proportional_lp * redemption_fee_bps / 10000`
5. CEI: обновление state до трансферов
   - remaining_token_amount -= amount
   - remaining_lp_allocation -= proportional_lp
   - если remaining_tokens == 0 → status = Closed
6. Update lp_pool: reserved -= proportional_lp, available = total - reserved
7. Transfer SOL: user → lp_pool (proportional_lp)
8. Transfer SOL: user → treasury (redemption_fee)
9. Transfer tokens: vault ATA → user ATA (CPI Token2022, vault PDA подписывает)
10. Emit `TokensRedeemedEvent`

---

### 9. close_position

Финальная очистка vault: закрытие token account, возврат rent, удаление vault state.

**Доступ:**
- Vault owner: когда status == Closed или TimedOut
- Любой: когда `current_time > open_timestamp + position_timeout` (permissionless)

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `closer` | Signer, mut | Owner или любой (после timeout) |
| 1 | `vault_state` | PDA, mut | Seed: `[b"vault", user, mint]` |
| 2 | `protocol_config` | PDA | |
| 3 | `lp_pool` | PDA, mut | |
| 4 | `vault_owner` | UncheckedAccount, mut | vault_state.user (получает rent refund) |
| 5 | `vault_token_account` | UncheckedAccount, mut | ATA vault PDA |
| 6 | `token_program` | | Token2022 |
| 7 | `system_program` | Program | |

**Логика:**
1. Определение is_owner = (closer == vault.user)
2. Если owner: проверка status == Closed || TimedOut
3. Если не owner: проверка `current_time > open_timestamp + position_timeout`
4. Проверка: token account пустой (amount == 0)
5. Рассчёт close_reward для permissionless closer (если !is_owner)
6. Если remaining_lp > 0:
   - lp_pool.reserved -= remaining_lp
   - lp_pool.total -= remaining_lp (LP loss — дефолт)
   - lp_pool.total_defaults += 1
7. lp_pool.total_positions_closed += 1
8. Если close_reward > 0: transfer lp_pool → closer
9. Close vault token account (CPI Token2022): rent → vault_owner
10. Если !is_owner: vault.status = TimedOut
11. Emit `PositionClosedEvent`
12. Close vault_state account: все lamports → vault_owner, zero-out + resize(0)

---

### 10. force_close_position

Экстренная ликвидация: executor продаёт все оставшиеся токены с min_sol_output = 0.

**Доступ:** Executor only

**Аккаунты:**

| # | Аккаунт | Тип | Описание |
|---|---------|-----|----------|
| 0 | `executor` | Signer | protocol_config.executor |
| 1 | `vault_state` | PDA, mut | status == Active |
| 2 | `protocol_config` | PDA | |
| 3 | `lp_pool` | PDA, mut | |
| 4 | `vault_token_account` | UncheckedAccount, mut | ATA vault PDA |
| 5 | `token_mint` | UncheckedAccount | |
| 6–16 | Pump.fun accounts | | Аналогично sell_position |
| 17 | `system_program` | Program | |
| 18 | `token_program` | | Token2022 |

**Логика:**
1. Запись vault lamports до продажи
2. CPI sell всех remaining tokens с `min_sol_output = 0` (принимает любую цену)
3. `sol_recovered = vault_lamports_after - vault_lamports_before`
4. Transfer восстановленного SOL: vault PDA → lp_pool (с учётом rent-exemption)
5. `lp_loss = lp_at_risk - sol_to_pool`
6. Update vault: remaining = 0, status = Closed
7. Update lp_pool:
   - reserved -= lp_at_risk
   - если lp_loss > 0: total -= lp_loss, total_defaults += 1
   - available = total - reserved
   - total_positions_closed += 1
8. Emit `PositionForceClosedEvent`

> **Примечание:** После force_close позиция в статусе Closed, но vault_state аккаунт остаётся. Owner должен вызвать close_position для утилизации аккаунта и возврата rent.

---

## CPI к Pump.fun v2

Program ID: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

### create_v2 (16 accounts)

Создание нового токена на bonding curve.

| # | Аккаунт | Writable | Signer |
|---|---------|----------|--------|
| 0 | mint | ✓ | ✓ |
| 1 | mint_authority | | |
| 2 | bonding_curve | ✓ | |
| 3 | associated_bonding_curve | ✓ | |
| 4 | global | ✓ | |
| 5 | user | ✓ | ✓ |
| 6 | system_program | | |
| 7 | token_program | | |
| 8 | associated_token_program | | |
| 9 | mayhem_program | ✓ | |
| 10 | mayhem_global_params | | |
| 11 | mayhem_sol_vault | ✓ | |
| 12 | mayhem_state | ✓ | |
| 13 | mayhem_token_vault | ✓ | |
| 14 | event_authority | | |
| 15 | pump_program (self) | | |

Discriminator: `[0xd6, 0x90, 0x4c, 0xec, 0x5f, 0x8b, 0x31, 0xb4]`

Args: `CreateV2Args { name, symbol, uri, creator, is_mayhem_mode, is_cashback_enabled: None }`

### buy (17 accounts)

Покупка токенов на bonding curve.

| # | Аккаунт | Writable | Signer |
|---|---------|----------|--------|
| 0 | global | | |
| 1 | fee_recipient | ✓ | |
| 2 | mint | | |
| 3 | bonding_curve | ✓ | |
| 4 | associated_bonding_curve | ✓ | |
| 5 | associated_user (buyer ATA) | ✓ | |
| 6 | user (buyer PDA) | ✓ | ✓ |
| 7 | system_program | | |
| 8 | token_program | | |
| 9 | creator_vault | ✓ | |
| 10 | event_authority | | |
| 11 | pump_program (self) | | |
| 12 | global_volume_accumulator | | |
| 13 | user_volume_accumulator | ✓ | |
| 14 | fee_config | | |
| 15 | fee_program | | |
| 16 | bonding_curve_v2 | | |

Discriminator: `[0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]`

Args: `BuyArgs { amount: u64, max_sol_cost: u64 }`

### sell (15 accounts)

Продажа токенов обратно на bonding curve.

| # | Аккаунт | Writable | Signer |
|---|---------|----------|--------|
| 0 | global | | |
| 1 | fee_recipient | ✓ | |
| 2 | mint | | |
| 3 | bonding_curve | ✓ | |
| 4 | associated_bonding_curve | ✓ | |
| 5 | associated_user (vault ATA) | ✓ | |
| 6 | user (vault PDA) | ✓ | ✓ |
| 7 | system_program | | |
| 8 | creator_vault | ✓ | |
| 9 | token_program | | |
| 10 | event_authority | | |
| 11 | pump_program (self) | | |
| 12 | fee_config | | |
| 13 | fee_program | | |
| 14 | bonding_curve_v2 | | |

Discriminator: `[0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]`

Args: `SellArgs { amount: u64, min_sol_output: u64 }`

> **Важно:** Layout sell отличается от buy:
> - creator_vault на позиции 8 (перед token_program)
> - Нет volume accumulators (они только для buy)
> - 15 аккаунтов (vs 17 для buy)

### Внешние программы

| Программа | ID |
|-----------|-----|
| Pump.fun v2 | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| Mayhem | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` |
| PumpFun Fee Program | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` |
| Token2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| Associated Token | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |

### PumpFun PDA Derivation Helpers

```
global_volume_accumulator: PDA [b"global_volume_accumulator"] from PUMP_FUN_PROGRAM_ID
user_volume_accumulator:   PDA [b"user_volume_accumulator", user] from PUMP_FUN_PROGRAM_ID
creator_vault:             PDA [b"creator-vault", creator] from PUMP_FUN_PROGRAM_ID
fee_config:                PDA [b"fee_config", FEE_SEED_CONST] from FEE_PROGRAM_ID
bonding_curve_v2:          PDA [b"bonding-curve-v2", mint] from PUMP_FUN_PROGRAM_ID
```

---

## CPI Token2022 (token_utils)

Вспомогательные функции в `cpi/token_utils.rs` для ручного построения инструкций Token2022:

| Функция | Описание |
|---------|----------|
| `read_token_account_amount()` | Чтение amount из raw token account data (offset 64..72) |
| `build_transfer_checked_instruction()` | TransferChecked (instruction index = 12) |
| `build_mint_to_instruction()` | MintTo (instruction index = 7) |
| `build_burn_instruction()` | Burn (instruction index = 8) |
| `build_close_account_instruction()` | CloseAccount (instruction index = 9) |
| `build_initialize_mint2_instruction()` | InitializeMint2 (instruction index = 20) |
| `build_create_ata_instruction()` | Create ATA via Associated Token Program |
| `build_create_ata_idempotent_instruction()` | Create ATA idempotent (instruction index = 1) |

---

## SOL Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                          SOL FLOW                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  LP Provider                                                       │
│    │  deposit_lp(amount)                                           │
│    └──────────► [LpPool PDA] ◄─── withdraw_lp (sol_out)            │
│                     │                    │                          │
│                     │ reimburse pool_share                          │
│                     ▼                    ▲                          │
│  User ──── open_position ──────►  user (refund unused)             │
│    │                                                               │
│    ├── total_fee ──► [Treasury] (treasury_amount)                  │
│    │                                                               │
│    ├── total_fee ──► [Insurance Fund] (insurance_amount)           │
│    │                                                               │
│    ├── max_sol_costs ──► [Buyer PDAs] ──► Pump.fun (buy)           │
│    │                          │                                    │
│    │                          └── unused SOL ──► user              │
│    │                                                               │
│  sell_position:                                                    │
│    Pump.fun ──► [Vault PDA] (sol_received)                         │
│    [Vault PDA] ──► [LpPool] (pool_recovery = min(sol, prop_lp))   │
│    [Vault PDA] остаток = прибыль user ──► при close_position       │
│                                                                    │
│  redeem_tokens:                                                    │
│    User ──► [LpPool] (proportional_lp)                             │
│    User ──► [Treasury] (redemption_fee)                            │
│                                                                    │
│  close_position:                                                   │
│    [Vault PDA] ──► [Vault Owner] (все оставшиеся lamports)         │
│    [LpPool] ──► [Closer] (close_reward, если permissionless)       │
│                                                                    │
│  force_close_position:                                             │
│    Pump.fun ──► [Vault PDA] (sol_recovered)                        │
│    [Vault PDA] ──► [LpPool] (min(sol_recovered, lp_at_risk))      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Token Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        TOKEN FLOW                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  open_position:                                                    │
│    Pump.fun ──► [Buyer ATA] ──► [Vault ATA]                       │
│    (для каждого buyer_i, токены консолидируются в vault ATA)       │
│    buyer ATA закрывается после трансфера                           │
│                                                                    │
│  sell_position:                                                    │
│    [Vault ATA] ──► Pump.fun (bonding curve sell)                   │
│    (vault PDA подписывает CPI sell)                                │
│                                                                    │
│  redeem_tokens:                                                    │
│    [Vault ATA] ──► [User ATA]                                     │
│    (vault PDA подписывает transfer_checked)                        │
│                                                                    │
│  close_position:                                                   │
│    vault ATA закрывается (rent → vault owner)                      │
│    vault_state аккаунт закрывается (lamports → vault owner)        │
│                                                                    │
│  LP tokens (mimi-LP, Token2022, 9 decimals):                      │
│    deposit_lp:  mint lp_tokens ──► depositor ATA                   │
│    withdraw_lp: depositor ATA ──► burn                             │
│    (mint authority = lp_mint PDA)                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Vault Lifecycle

```
                  ┌──────────────┐
                  │ open_position │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │    Active     │
                  └──┬───┬───┬───┘
                     │   │   │
        ┌────────────┘   │   └────────────┐
        ▼                ▼                ▼
  sell_position    redeem_tokens   force_close_position
  (partial/full)   (partial/full)   (executor only)
        │                │                │
        │                │                ▼
        │                │         ┌──────────┐
        │                │         │  Closed   │
        │ all sold       │ all     │(force)    │
        ▼ redeemed       ▼        └─────┬─────┘
  ┌──────────┐    ┌──────────┐          │
  │  Closed   │    │  Closed   │         │
  │(by sell)  │    │(by redeem)│         │
  └─────┬─────┘    └─────┬─────┘         │
        │                │               │
        └────────┬───────┘               │
                 │                       │
                 ▼                       ▼
          ┌──────────────┐        ┌──────────────┐
          │close_position│        │close_position│
          │ (by owner)   │        │ (by owner)   │
          └──────────────┘        └──────────────┘


  === Permissionless path (timeout) ===

  Active ──── (timeout expires) ────►  close_position (by anyone)
                                              │
                                              ▼
                                        ┌──────────┐
                                        │ TimedOut  │
                                        └──────────┘
                                    (vault_state deleted,
                                     rent → vault owner,
                                     close_reward → closer,
                                     remaining LP → loss)
```

### Состояния vault

| Статус | Описание | Кто может перевести |
|--------|----------|---------------------|
| `Active` | Позиция открыта, токены в vault | open_position создаёт |
| `Closed` | Все токены проданы/выкуплены или force_close | sell_position (если all sold), redeem_tokens (если all redeemed), force_close_position |
| `TimedOut` | Permissionless close после timeout | close_position (если !is_owner) |

---

## Ошибки

| Код | Название | Описание |
|-----|----------|----------|
| 6000 | `UnauthorizedAdmin` | Только admin может выполнить это действие |
| 6001 | `UnauthorizedUser` | Только владелец vault может выполнить это действие |
| 6002 | `UnauthorizedExecutor` | Только executor может выполнить это действие |
| 6003 | `InvalidVaultStatus` | Неверный статус vault для данной операции |
| 6004 | `ProtocolPaused` | Протокол на паузе |
| 6005 | `InsufficientLpLiquidity` | Недостаточно ликвидности в LP пуле |
| 6006 | `InsufficientAvailableLiquidity` | Недостаточно доступной ликвидности для вывода |
| 6007 | `RedeemAmountExceedsRemaining` | Сумма redeem превышает оставшиеся токены |
| 6008 | `ZeroRedeemAmount` | Сумма redeem должна быть > 0 |
| 6009 | `ZeroTokenAmount` | Количество токенов должно быть > 0 |
| 6010 | `InvalidRedemptionFeeBps` | redemption_fee_bps должен быть ≤ 10000 |
| 6011 | `InvalidTreasury` | Неверный treasury аккаунт |
| 6012 | `ArithmeticOverflow` | Арифметическое переполнение |
| 6013 | `VaultTokenAccountNotEmpty` | Token account vault не пустой (нужно сначала продать) |
| 6014 | `ZeroLpAllocation` | LP allocation должен быть > 0 |
| 6015 | `ZeroUserContribution` | User contribution должен быть > 0 |
| 6016 | `BudgetExceeded` | Max SOL cost превышает бюджет на покупку |
| 6017 | `MaxBuyersExceeded` | Слишком много buyer'ов (max 5) |
| 6018 | `BuyParamsMismatch` | buy_amounts и max_sol_costs должны иметь одинаковую длину |
| 6019 | `NoBuyers` | Нужен хотя бы один buyer |
| 6020 | `InvalidRemainingAccounts` | Неверное количество remaining accounts |
| 6021 | `InvalidBuyerPda` | Неверный buyer PDA |
| 6022 | `InvalidVaultTokenAccount` | Неверный vault token account |
| 6023 | `UtilizationCapReached` | Лимит утилизации пула будет превышен |
| 6024 | `PositionNotTimedOut` | Позиция ещё не просрочена |
| 6025 | `InvalidFeeBps` | Неверное значение fee BPS |
| 6026 | `InvalidUtilizationBps` | Неверное значение utilization BPS |
| 6027 | `InvalidPositionTimeout` | Position timeout должен быть > 0 |
| 6028 | `ZeroDepositAmount` | Сумма депозита должна быть > 0 |
| 6029 | `ZeroWithdrawAmount` | Сумма вывода должна быть > 0 |
| 6030 | `InvalidLpTokenAmount` | Неверное количество LP токенов |
| 6031 | `UnauthorizedSeller` | Только владелец vault или executor может продавать |
| 6032 | `SlippageExceeded` | Минимальный SOL output не достигнут |

---

## События (Events)

### ProtocolInitializedEvent

| Поле | Тип |
|------|-----|
| `admin` | `Pubkey` |
| `executor` | `Pubkey` |
| `treasury` | `Pubkey` |
| `fixed_fee` | `u64` |
| `fee_bps` | `u16` |
| `max_utilization_bps` | `u16` |
| `position_timeout` | `i64` |
| `redemption_fee_bps` | `u16` |
| `timestamp` | `i64` |

### PositionOpenedEvent

| Поле | Тип |
|------|-----|
| `vault` | `Pubkey` |
| `user` | `Pubkey` |
| `token_mint` | `Pubkey` |
| `num_buyers` | `u8` |
| `total_tokens` | `u64` |
| `total_sol_spent` | `u64` |
| `lp_allocation` | `u64` |
| `user_contribution` | `u64` |
| `fee_paid` | `u64` |
| `timestamp` | `i64` |

### PositionSoldEvent

| Поле | Тип |
|------|-----|
| `vault` | `Pubkey` |
| `seller` | `Pubkey` |
| `token_mint` | `Pubkey` |
| `tokens_sold` | `u64` |
| `sol_received` | `u64` |
| `sol_returned_to_pool` | `u64` |
| `timestamp` | `i64` |

### TokensRedeemedEvent

| Поле | Тип |
|------|-----|
| `vault` | `Pubkey` |
| `user` | `Pubkey` |
| `token_amount` | `u64` |
| `lp_returned` | `u64` |
| `redemption_fee` | `u64` |
| `remaining_tokens` | `u64` |
| `remaining_lp` | `u64` |
| `vault_closed` | `bool` |
| `timestamp` | `i64` |

### PositionClosedEvent

| Поле | Тип |
|------|-----|
| `vault` | `Pubkey` |
| `closer` | `Pubkey` |
| `is_permissionless` | `bool` |
| `close_reward` | `u64` |
| `timestamp` | `i64` |

### PositionForceClosedEvent

| Поле | Тип |
|------|-----|
| `vault` | `Pubkey` |
| `executor` | `Pubkey` |
| `token_mint` | `Pubkey` |
| `tokens_sold` | `u64` |
| `sol_recovered` | `u64` |
| `lp_loss` | `u64` |
| `timestamp` | `i64` |

### ProtocolConfigUpdatedEvent

| Поле | Тип |
|------|-----|
| `admin` | `Pubkey` |
| `timestamp` | `i64` |

### LpDepositedEvent

| Поле | Тип |
|------|-----|
| `depositor` | `Pubkey` |
| `sol_amount` | `u64` |
| `lp_tokens_minted` | `u64` |
| `new_total_liquidity` | `u64` |
| `lp_token_price` | `u64` |
| `timestamp` | `i64` |

### LpWithdrawnEvent

| Поле | Тип |
|------|-----|
| `withdrawer` | `Pubkey` |
| `lp_tokens_burned` | `u64` |
| `sol_amount` | `u64` |
| `new_total_liquidity` | `u64` |
| `lp_token_price` | `u64` |
| `timestamp` | `i64` |

### TokenCreatedEvent

| Поле | Тип |
|------|-----|
| `mint` | `Pubkey` |
| `creator` | `Pubkey` |
| `name` | `String` |
| `symbol` | `String` |
| `is_mayhem_mode` | `bool` |
| `timestamp` | `i64` |

### InsuranceFundUpdatedEvent

| Поле | Тип |
|------|-----|
| `new_total` | `u64` |
| `amount_added` | `u64` |
| `timestamp` | `i64` |

---

## Структура файлов

```
launch_vault/programs/launch_vault/src/
├── lib.rs                          # Entrypoint: declare_id!, #[program] mod, 10 instructions
├── errors.rs                       # LaunchVaultError enum (33 варианта)
├── events.rs                       # 11 event structs
├── state/
│   ├── mod.rs                      # Re-exports
│   ├── protocol_config.rs          # ProtocolConfig + ProtocolStatus enum
│   ├── lp_pool.rs                  # LpPool
│   ├── launch_vault_state.rs       # LaunchVaultState + VaultStatus enum
│   └── insurance_fund.rs           # InsuranceFund
├── instructions/
│   ├── mod.rs                      # Re-exports
│   ├── initialize_protocol.rs      # InitializeProtocol accounts + handler
│   ├── update_protocol_config.rs   # UpdateProtocolConfig accounts + handler
│   ├── deposit_lp.rs               # DepositLp accounts + handler
│   ├── withdraw_lp.rs              # WithdrawLp accounts + handler
│   ├── proxy_create_token.rs       # ProxyCreateToken accounts + handler
│   ├── open_position.rs            # OpenPosition accounts + handler (630 lines)
│   ├── sell_position.rs            # SellPosition accounts + handler
│   ├── redeem_tokens.rs            # RedeemTokens accounts + handler
│   ├── close_position.rs           # ClosePosition accounts + handler
│   └── force_close_position.rs     # ForceClosePosition accounts + handler
└── cpi/
    ├── mod.rs                      # Re-exports
    ├── pump_fun.rs                 # Pump.fun CPI builders (create_v2, buy, sell) + PDA derivation
    └── token_utils.rs              # Token2022 instruction builders + read_token_account_amount
```
