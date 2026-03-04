# LaunchVault Protocol

Solana-программа (Anchor 0.32.1) — протокол ликвидности для запуска токенов на Pump.fun v2.

**Program ID:** `2hpb3dPckVbTf81WoeYt2BybcUZQCevxi1N5DwjaRsL7`

---

## Оглавление

- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Роли](#роли)
- [State (PDA-аккаунты)](#state-pda-аккаунты)
- [PDA-адреса](#pda-адреса)
- [Fees (комиссии)](#fees-комиссии)
- [Инструкции](#инструкции)
  - [initialize_protocol](#1-initialize_protocol)
  - [update_protocol_config](#2-update_protocol_config)
  - [deposit_lp](#3-deposit_lp)
  - [withdraw_lp](#4-withdraw_lp)
  - [proxy_create_token](#5-proxy_create_token)
  - [create_vault](#6-create_vault)
  - [proxy_buy_token](#7-proxy_buy_token)
  - [pay_rental](#8-pay_rental)
  - [redeem_tokens](#9-redeem_tokens)
  - [mark_defaulted](#10-mark_defaulted)
  - [liquidate_vault](#11-liquidate_vault)
  - [close_vault](#12-close_vault)
  - [launch_bundle](#13-launch_bundle)
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

### Как это работает

1. LP-провайдеры наполняют пул SOL
2. Пользователь создаёт токен на Pump.fun через CPI
3. Протокол выделяет SOL из LP пула + user contribution для покупки токенов
4. Купленные токены блокируются в vault PDA
5. Пользователь платит **аренду** за использование ликвидности каждый период
6. Для выкупа токенов пользователь возвращает пропорциональную часть LP + redemption fee
7. При неоплате аренды — vault переходит в дефолт, токены ликвидируются

### Два сценария запуска

**Пошаговый:**
```
proxy_create_token → create_vault → proxy_buy_token → pay_rental → redeem_tokens → close_vault
```

**Атомарный (launch_bundle):**
```
launch_bundle (create + vault + 5 buy с разных PDA) → pay_rental → redeem_tokens → close_vault
```

---

## Архитектура

- **Фреймворк:** Anchor 0.32.1
- **Сеть:** Solana
- **Токен-стандарт:** Token2022 (используется Pump.fun v2)
- **Внешние программы:**
  - Pump.fun v2: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
  - Mayhem: `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e`
  - SPL Token2022
  - SPL Associated Token Account
  - System Program

### Зависимости (Cargo.toml)

```toml
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
anchor-spl = { version = "0.32.1", features = ["token", "associated_token"] }
```

---

## Роли

| Роль | Описание | Инструкции |
|------|----------|------------|
| **Admin** | Управляет протоколом. Устанавливается при `initialize_protocol`. Может передать другому через `update_protocol_config`. | `initialize_protocol`, `update_protocol_config` |
| **Executor** | Авторизованный оператор. Выполняет покупки токенов и ликвидации. Устанавливается admin'ом в `protocol_config.executor`. | `proxy_buy_token`, `liquidate_vault`, `launch_bundle` (co-signer) |
| **User** | Создатель токена и владелец vault. Платит fees и аренду. | `proxy_create_token`, `create_vault`, `pay_rental`, `redeem_tokens`, `close_vault`, `launch_bundle` |
| **LP Authority** | Поставщик ликвидности. По умолчанию = Admin (устанавливается как `lp_pool.authority` при init). | `deposit_lp`, `withdraw_lp` |
| **Cranker** | Permissionless — любой аккаунт. Помечает просроченные vault'ы. | `mark_defaulted` |

---

## State (PDA-аккаунты)

### ProtocolConfig

Глобальная конфигурация протокола. Один на всю программу.

```rust
#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,              // Администратор протокола
    pub executor: Pubkey,           // Авторизованный оператор
    pub treasury: Pubkey,           // Получатель комиссий
    pub rental_period: i64,         // Период аренды в секундах (напр. 86400 = 24ч)
    pub rental_fee_rate: u64,       // Стоимость аренды за период (lamports)
    pub infrastructure_fee: u64,    // Разовая комиссия при создании vault (lamports)
    pub redemption_fee_bps: u16,    // Комиссия при выкупе токенов (BPS, 10000 = 100%)
    pub grace_period: i64,          // Допустимая просрочка до дефолта (секунды)
    pub status: ProtocolStatus,     // Active / Paused
    pub bump: u8,                   // PDA bump
}
```

### LpPool

Пул ликвидности. Хранит SOL. Один на всю программу.

```rust
#[account]
pub struct LpPool {
    pub total_liquidity: u64,       // Весь SOL в пуле (lamports)
    pub reserved_liquidity: u64,    // Зарезервирован под активные vault'ы (lamports)
    pub available_liquidity: u64,   // Доступен для новых vault'ов: total - reserved (lamports)
    pub authority: Pubkey,          // Кто может deposit/withdraw
    pub bump: u8,                   // PDA bump
}
```

**Инвариант:** `total_liquidity = reserved_liquidity + available_liquidity`

### LaunchVaultState

Состояние одного vault'а. Создаётся при `create_vault` или `launch_bundle`.

```rust
#[account]
pub struct LaunchVaultState {
    pub user: Pubkey,                    // Владелец vault
    pub token_mint: Pubkey,              // Адрес минта токена
    pub total_token_amount: u64,         // Всего куплено токенов
    pub remaining_token_amount: u64,     // Осталось токенов в vault
    pub total_lp_allocation: u64,        // Общая LP ликвидность задействована (lamports)
    pub remaining_lp_allocation: u64,    // LP ликвидность к возврату (lamports)
    pub user_contribution: u64,          // Вклад пользователя (lamports)
    pub status: VaultStatus,             // ReadyForExecution / Active / Closed / Defaulted
    pub rental_start_timestamp: i64,     // Unix timestamp начала аренды
    pub rental_due_timestamp: i64,       // Дедлайн текущего периода аренды
    pub rental_status: RentalStatus,     // Active / Overdue
    pub bump: u8,                        // PDA bump
}
```

### Enum'ы

```rust
pub enum ProtocolStatus {
    Active,     // Протокол работает
    Paused,     // Протокол на паузе — новые vault'ы нельзя создавать
}

pub enum VaultStatus {
    ReadyForExecution,  // Vault создан, ожидает покупки токенов (proxy_buy_token)
    Active,             // Токены куплены, аренда активна
    Closed,             // Все токены выкуплены или vault закрыт
    Defaulted,          // Просрочка аренды, vault помечен как дефолтный
}

pub enum RentalStatus {
    Active,     // Аренда оплачена вовремя
    Overdue,    // Аренда просрочена
}
```

---

## PDA-адреса

| PDA | Seeds | Описание |
|-----|-------|----------|
| `protocol_config` | `[b"protocol_config"]` | Глобальная конфигурация |
| `lp_pool` | `[b"lp_pool"]` | Пул ликвидности |
| `vault_state` | `[b"vault", user.key(), mint.key()]` | Состояние vault (уникально для user + mint) |
| `buyer_pda` | `[b"buyer", vault.key(), &[index]]` | PDA-кошелёк покупателя в launch_bundle (index: 0..4) |

---

## Fees (комиссии)

Все fees получает **treasury** (кроме redemption, где часть идёт в LP pool).

### 1. Infrastructure Fee

- **Когда:** при создании vault (`create_vault`, `launch_bundle`)
- **Размер:** `protocol_config.infrastructure_fee` (lamports, фиксированная сумма)
- **Кто платит:** User
- **Куда:** Treasury
- **Разовая**

### 2. Rental Fee

- **Когда:** первый раз при создании vault, затем каждый период через `pay_rental`
- **Размер:** `protocol_config.rental_fee_rate` (lamports за период)
- **Кто платит:** User
- **Куда:** Treasury
- **Периодическая** (каждые `rental_period` секунд)

### 3. Redemption Fee

- **Когда:** при выкупе токенов (`redeem_tokens`)
- **Размер:** `protocol_config.redemption_fee_bps` (BPS от возвращаемого LP; 100 BPS = 1%)
- **Формула:** `redemption_fee = proportional_lp * redemption_fee_bps / 10000`
- **Кто платит:** User
- **Куда:** Treasury

### Пример расчёта

```
infrastructure_fee = 0.01 SOL
rental_fee_rate = 0.005 SOL/период
rental_period = 86400 (24 часа)
redemption_fee_bps = 200 (2%)

При создании vault:
  User платит: 0.01 (infra) + 0.005 (первый rental) = 0.015 SOL → Treasury

При выкупе 50% токенов (LP allocation = 10 SOL):
  proportional_lp = 5 SOL
  redemption_fee = 5 * 200 / 10000 = 0.1 SOL → Treasury
  User платит: 5 SOL → LP Pool + 0.1 SOL → Treasury
  User получает: 50% токенов из vault
```

---

## Инструкции

### 1. initialize_protocol

Инициализация протокола. Создаёт `ProtocolConfig` и `LpPool`. Вызывается один раз.

**Кто вызывает:** Admin (signer)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `admin` | `Signer` (mut) | Администратор, платит за создание аккаунтов |
| `protocol_config` | `Account<ProtocolConfig>` (init) | PDA `[b"protocol_config"]` |
| `lp_pool` | `Account<LpPool>` (init) | PDA `[b"lp_pool"]` |
| `system_program` | `Program<System>` | System Program |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `executor` | `Pubkey` | Адрес авторизованного оператора |
| `treasury` | `Pubkey` | Адрес получателя комиссий |
| `rental_period` | `i64` | Период аренды в секундах (> 0) |
| `rental_fee_rate` | `u64` | Стоимость аренды за период (lamports) |
| `infrastructure_fee` | `u64` | Разовая комиссия (lamports) |
| `redemption_fee_bps` | `u16` | Комиссия при выкупе (BPS, <= 10000) |
| `grace_period` | `i64` | Допустимая просрочка (секунды, >= 0) |

**Валидация:**
- `rental_period > 0`
- `grace_period >= 0`
- `redemption_fee_bps <= 10000`

**Логика:**
1. Инициализирует `ProtocolConfig` со всеми параметрами, `status = Active`
2. Инициализирует `LpPool` с нулевой ликвидностью, `authority = admin`
3. Эмитит `ProtocolInitializedEvent`

**Event:** `ProtocolInitializedEvent`

---

### 2. update_protocol_config

Обновление параметров протокола. Все параметры опциональны.

**Кто вызывает:** Admin

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `admin` | `Signer` | Должен совпадать с `protocol_config.admin` |
| `protocol_config` | `Account<ProtocolConfig>` (mut) | PDA `[b"protocol_config"]` |

**Аргументы (все Option):**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `new_executor` | `Option<Pubkey>` | Новый executor |
| `new_treasury` | `Option<Pubkey>` | Новый treasury |
| `new_rental_period` | `Option<i64>` | Новый период аренды (> 0) |
| `new_rental_fee_rate` | `Option<u64>` | Новая стоимость аренды |
| `new_infrastructure_fee` | `Option<u64>` | Новая infra fee |
| `new_redemption_fee_bps` | `Option<u16>` | Новая redemption fee (<= 10000) |
| `new_grace_period` | `Option<i64>` | Новый grace period (>= 0) |
| `new_admin` | `Option<Pubkey>` | Передать права admin |
| `new_status` | `Option<ProtocolStatus>` | Пауза / возобновление |

**Логика:** обновляет только переданные поля (Some), остальные не трогает.

**Event:** `ProtocolConfigUpdatedEvent`

---

### 3. deposit_lp

Депозит SOL в LP пул.

**Кто вызывает:** LP Authority (`lp_pool.authority`)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `authority` | `Signer` (mut) | Должен совпадать с `lp_pool.authority` |
| `lp_pool` | `Account<LpPool>` (mut) | PDA `[b"lp_pool"]` |
| `system_program` | `Program<System>` | System Program |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Сумма депозита (lamports, > 0) |

**Логика:**
1. Transfer SOL: `authority → lp_pool` (system_program::transfer)
2. `lp_pool.total_liquidity += amount`
3. `lp_pool.available_liquidity += amount`
4. Эмитит `LpDepositedEvent`

**Event:** `LpDepositedEvent`

---

### 4. withdraw_lp

Вывод доступного SOL из LP пула.

**Кто вызывает:** LP Authority (`lp_pool.authority`)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `authority` | `Signer` (mut) | Должен совпадать с `lp_pool.authority` |
| `lp_pool` | `Account<LpPool>` (mut) | PDA `[b"lp_pool"]` |
| `system_program` | `Program<System>` | System Program |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Сумма вывода (lamports, > 0) |

**Валидация:**
- `amount <= lp_pool.available_liquidity` (нельзя вывести зарезервированные средства)

**Логика:**
1. Transfer SOL: `lp_pool → authority` (прямая манипуляция lamports)
2. `lp_pool.total_liquidity -= amount`
3. `lp_pool.available_liquidity -= amount`
4. Эмитит `LpWithdrawnEvent`

**Event:** `LpWithdrawnEvent`

---

### 5. proxy_create_token

CPI-прокси для создания токена на Pump.fun v2 через `create_v2`.

**Кто вызывает:** User

**Accounts (16):**
| Account | Тип | Описание |
|---------|-----|----------|
| `user` | `Signer` (mut) | Создатель токена, платит за создание |
| `mint` | `Signer` (mut) | Свежий keypair для нового минта |
| `pump_program` | `UncheckedAccount` | Pump.fun v2 program (`6EF8...`) |
| `pump_global` | `UncheckedAccount` (mut) | Pump global state PDA `["global"]` |
| `pump_mint_authority` | `UncheckedAccount` | Mint authority PDA `["mint-authority"]` |
| `pump_bonding_curve` | `UncheckedAccount` (mut) | Bonding curve PDA `["bonding-curve", mint]` |
| `pump_associated_bonding_curve` | `UncheckedAccount` (mut) | ATA bonding curve |
| `mayhem_program` | `UncheckedAccount` (mut) | Mayhem program (`MAyh...`) |
| `mayhem_global_params` | `UncheckedAccount` | Mayhem global params PDA |
| `mayhem_sol_vault` | `UncheckedAccount` (mut) | Mayhem SOL vault |
| `mayhem_state` | `UncheckedAccount` (mut) | Mayhem state PDA `["mayhem-state", mint]` |
| `mayhem_token_vault` | `UncheckedAccount` (mut) | Mayhem token vault |
| `pump_event_authority` | `UncheckedAccount` | Event authority `["__event_authority"]` |
| `system_program` | `Program<System>` | System Program |
| `token_program` | `UncheckedAccount` | Token2022 |
| `associated_token_program` | `Program<AssociatedToken>` | ATA Program |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `name` | `String` | Имя токена |
| `symbol` | `String` | Символ токена |
| `uri` | `String` | URI метаданных |
| `is_mayhem_mode` | `bool` | Режим mayhem |

**Логика:**
1. Собирает `create_v2` instruction через `pump_fun::build_create_v2_instruction()`
2. Вызывает `invoke()` с user + mint как signers
3. Pump.fun создаёт: mint, bonding curve, ATA bonding curve
4. Весь supply (~1 млрд токенов) минтится на `associated_bonding_curve`
5. Эмитит `TokenCreatedEvent`

**Event:** `TokenCreatedEvent`

---

### 6. create_vault

Создание vault: резервирует LP, принимает user contribution, оплата fees.

**Кто вызывает:** User

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `user` | `Signer` (mut) | Создатель vault, платит fees |
| `token_mint` | `UncheckedAccount` | Минт уже существующего токена (Token2022) |
| `vault_state` | `Account<LaunchVaultState>` (init) | PDA `[b"vault", user, mint]` |
| `vault_token_account` | `UncheckedAccount` (mut) | ATA vault'а для токена — создаётся CPI в handler |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация |
| `lp_pool` | `Account<LpPool>` (mut) | LP пул |
| `treasury` | `UncheckedAccount` (mut) | Получатель fees |
| `system_program` | `Program<System>` | System Program |
| `token_program` | `UncheckedAccount` | Token2022 |
| `associated_token_program` | `Program<AssociatedToken>` | ATA Program |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `lp_allocation` | `u64` | Сколько SOL выделить из LP (lamports, > 0) |
| `user_contribution` | `u64` | Вклад пользователя (lamports, > 0) |

**Валидация:**
- `lp_allocation > 0`
- `user_contribution > 0`
- `lp_allocation <= lp_pool.available_liquidity`
- `protocol_config.status == Active`

**Логика:**
1. Создаёт ATA vault'а через CPI к Associated Token Program (Token2022 compatible)
2. Transfer fees: `user → treasury` (infrastructure_fee + rental_fee_rate)
3. Transfer contribution: `user → lp_pool` (user_contribution)
4. Reserve LP:
   - `lp_pool.total_liquidity += user_contribution`
   - `buy_budget = lp_allocation + user_contribution`
   - `lp_pool.reserved_liquidity += buy_budget`
   - `lp_pool.available_liquidity = total_liquidity - reserved_liquidity`
5. Инициализирует vault_state:
   - `status = ReadyForExecution`
   - `total_token_amount = 0` (ещё не куплены)
   - `rental_due_timestamp = now + rental_period`
6. Эмитит `VaultCreatedEvent`

**Event:** `VaultCreatedEvent`

---

### 7. proxy_buy_token

On-chain покупка токенов с bonding curve через CPI к Pump.fun `buy`. Vault PDA выступает покупателем.

**Кто вызывает:** Executor

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `executor` | `Signer` | Должен совпадать с `protocol_config.executor` |
| `vault_state` | `Account<LaunchVaultState>` (mut) | PDA vault (status = ReadyForExecution) |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация |
| `lp_pool` | `Account<LpPool>` (mut) | LP пул |
| `vault_token_account` | `UncheckedAccount` (mut) | ATA vault'а для токена |
| `token_mint` | `UncheckedAccount` | Минт токена |
| `pump_program` | `UncheckedAccount` | Pump.fun program |
| `pump_global` | `UncheckedAccount` | Pump global state |
| `pump_fee_recipient` | `UncheckedAccount` (mut) | Pump fee recipient |
| `pump_bonding_curve` | `UncheckedAccount` (mut) | Bonding curve |
| `pump_associated_bonding_curve` | `UncheckedAccount` (mut) | ATA bonding curve |
| `pump_event_authority` | `UncheckedAccount` | Event authority |
| `system_program` | `Program<System>` | System Program |
| `token_program` | `UncheckedAccount` | Token2022 |
| `rent` | `Sysvar<Rent>` | Rent sysvar |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Количество токенов для покупки (> 0) |
| `max_sol_cost` | `u64` | Максимальная стоимость (slippage protection) |

**Валидация:**
- `amount > 0`
- `max_sol_cost <= buy_budget` (buy_budget = lp_allocation + user_contribution)
- `vault_state.status == ReadyForExecution`

**Логика:**
1. Transfer SOL: `lp_pool → vault_state PDA` (invoke_signed с lp_pool seeds) — сумма = buy_budget
2. CPI buy: vault PDA как buyer → Pump.fun bonding curve (invoke_signed с vault seeds)
3. Токены приходят на `vault_token_account`
4. Return excess SOL: `vault_state → lp_pool` (неиспользованный остаток)
5. Update state:
   - `vault.total_token_amount = actual_tokens` (читает реальный баланс из ATA по offset `[64..72]`)
   - `vault.remaining_token_amount = actual_tokens`
   - `vault.status = Active`
6. Update LP pool:
   - `lp_pool.total_liquidity -= sol_spent`
   - `lp_pool.reserved_liquidity -= user_contribution` (LP allocation остаётся reserved до redeem/liquidate)
   - `lp_pool.available_liquidity = total_liquidity - reserved_liquidity`
7. Эмитит `TokenBoughtEvent`

**Event:** `TokenBoughtEvent`

---

### 8. pay_rental

Оплата аренды за использование LP. Продлевает период аренды.

**Кто вызывает:** User (владелец vault)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `user` | `Signer` (mut) | Владелец vault |
| `vault_state` | `Account<LaunchVaultState>` (mut) | PDA vault (status = Active, has_one = user) |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация |
| `treasury` | `UncheckedAccount` (mut) | Получатель аренды |
| `system_program` | `Program<System>` | System Program |

**Аргументы:** нет

**Логика:**
1. Transfer: `user → treasury` (rental_fee_rate)
2. `vault.rental_due_timestamp += rental_period`
3. `vault.rental_status = Active`
4. Эмитит `RentalPaidEvent`

**Примечание:** можно платить заранее (до истечения текущего периода). Каждый вызов добавляет ещё один `rental_period` к дедлайну.

**Event:** `RentalPaidEvent`

---

### 9. redeem_tokens

Выкуп токенов из vault. Пользователь возвращает пропорциональную часть LP + redemption fee и получает токены.

**Кто вызывает:** User (владелец vault)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `user` | `Signer` (mut) | Владелец vault |
| `vault_state` | `Account<LaunchVaultState>` (mut) | PDA vault (status = Active) |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация |
| `lp_pool` | `Account<LpPool>` (mut) | LP пул |
| `treasury` | `UncheckedAccount` (mut) | Получатель redemption fee |
| `vault_token_account` | `UncheckedAccount` (mut) | ATA vault'а |
| `user_token_account` | `UncheckedAccount` (mut) | ATA пользователя |
| `token_mint` | `UncheckedAccount` | Минт токена — нужен для transfer_checked |
| `system_program` | `Program<System>` | System Program |
| `token_program` | `UncheckedAccount` | Token2022 |

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `amount` | `u64` | Количество токенов для выкупа (> 0, <= remaining) |

**Логика:**
1. Расчёт пропорционального LP:
   ```
   proportional_lp = amount * remaining_lp_allocation / remaining_token_amount
   ```
2. Расчёт redemption fee:
   ```
   redemption_fee = proportional_lp * redemption_fee_bps / 10000
   ```
3. Обновление state (CEI — перед трансферами):
   - `vault.remaining_token_amount -= amount`
   - `vault.remaining_lp_allocation -= proportional_lp`
   - Если `remaining_token_amount == 0` → `vault.status = Closed`
4. Обновление LP pool:
   - `lp_pool.total_liquidity += proportional_lp` (SOL возвращается в пул)
   - `lp_pool.reserved_liquidity -= proportional_lp`
   - `lp_pool.available_liquidity = total_liquidity - reserved_liquidity`
5. Transfer LP: `user → lp_pool` (proportional_lp SOL)
6. Transfer fee: `user → treasury` (redemption_fee SOL)
7. Transfer tokens: `vault_token_account → user_token_account` (PDA signer)
8. Эмитит `TokensRedeemedEvent`

**Event:** `TokensRedeemedEvent`

---

### 10. mark_defaulted

Пометка vault как дефолтного. Permissionless — может вызвать любой.

**Кто вызывает:** Anyone (cranker)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `cranker` | `Signer` | Любой аккаунт |
| `vault_state` | `Account<LaunchVaultState>` (mut) | PDA vault (status = Active) |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация |

**Аргументы:** нет

**Валидация:**
- `vault_state.status == Active`
- `current_time > rental_due_timestamp + grace_period`

**Логика:**
1. Проверяет что `now > rental_due + grace_period`
2. `vault.status = Defaulted`
3. `vault.rental_status = Overdue`
4. Эмитит `VaultDefaultedEvent`

**Event:** `VaultDefaultedEvent`

---

### 11. liquidate_vault

Ликвидация дефолтного vault. Все оставшиеся токены переходят executor'у. LP потерян.

**Кто вызывает:** Executor

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `executor` | `Signer` | Должен совпадать с `protocol_config.executor` |
| `vault_state` | `Account<LaunchVaultState>` (mut) | PDA vault (status = Defaulted) |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация |
| `lp_pool` | `Account<LpPool>` (mut) | LP пул |
| `vault_token_account` | `UncheckedAccount` (mut) | ATA vault'а |
| `executor_token_account` | `UncheckedAccount` (mut) | ATA executor'а |
| `token_mint` | `UncheckedAccount` | Минт токена — нужен для transfer_checked |
| `token_program` | `UncheckedAccount` | Token2022 |

**Аргументы:** нет

**Логика:**
1. Сохраняет `tokens_to_liquidate` и `lp_lost`
2. Обновление state:
   - `vault.remaining_token_amount = 0`
   - `vault.remaining_lp_allocation = 0`
   - `vault.status = Closed`
3. LP потерян (штраф):
   - `lp_pool.total_liquidity -= lp_lost`
   - `lp_pool.reserved_liquidity -= lp_lost`
   - `lp_pool.available_liquidity = total_liquidity - reserved_liquidity`
4. Transfer tokens: `vault_token_account → executor_token_account` (PDA signer, Token2022 transfer_checked)
5. Эмитит `VaultLiquidatedEvent`

**Важно:** LP, выделенный под vault, безвозвратно потерян. Это стимулирует пользователей платить аренду вовремя.

**Event:** `VaultLiquidatedEvent`

---

### 12. close_vault

Закрытие пустого vault. Возвращает rent пользователю.

**Кто вызывает:** User (владелец vault)

**Accounts:**
| Account | Тип | Описание |
|---------|-----|----------|
| `user` | `Signer` (mut) | Владелец vault |
| `vault_state` | `Account<LaunchVaultState>` (mut, close = user) | PDA vault (status = Closed) |
| `vault_token_account` | `UncheckedAccount` (mut) | ATA vault'а (amount == 0) |
| `token_program` | `UncheckedAccount` | Token2022 |
| `system_program` | `Program<System>` | System Program |

**Аргументы:** нет

**Валидация:**
- `vault_state.status == Closed`
- Token account balance == 0 (проверяется чтением raw data по offset `[64..72]`)

**Логика:**
1. Закрывает `vault_token_account` через CPI `token_utils::build_close_account_instruction` (rent → user, Token2022 compatible)
2. `vault_state` закрывается автоматически через Anchor `close = user`
3. Эмитит `VaultClosedEvent`

**Event:** `VaultClosedEvent`

---

### 13. launch_bundle

Атомарная мега-инструкция: создание токена + создание vault + 5 покупок с разных PDA-кошельков. Всё в одной Solana-транзакции.

**Зачем:** имитация органического спроса — 5 покупок с 5 разных адресов вместо одной большой покупки.

**Кто вызывает:** User + Executor (оба signer)

**Accounts (24 фиксированных + remaining_accounts):**

| Account | Тип | Описание |
|---------|-----|----------|
| `user` | `Signer` (mut) | Создатель токена, платит fees |
| `mint` | `Signer` (mut) | Свежий keypair для нового минта |
| `executor` | `Signer` | Авторизованный executor |
| `vault_state` | `UncheckedAccount` (mut) | PDA vault — инициализируется вручную |
| `protocol_config` | `Account<ProtocolConfig>` | Конфигурация (status = Active) |
| `lp_pool` | `Account<LpPool>` (mut) | LP пул |
| `treasury` | `UncheckedAccount` (mut) | Получатель fees |
| `pump_program` | `UncheckedAccount` | Pump.fun program |
| `pump_global` | `UncheckedAccount` (mut) | Pump global state |
| `pump_mint_authority` | `UncheckedAccount` | Mint authority |
| `pump_bonding_curve` | `UncheckedAccount` (mut) | Bonding curve |
| `pump_associated_bonding_curve` | `UncheckedAccount` (mut) | ATA bonding curve |
| `pump_event_authority` | `UncheckedAccount` | Event authority |
| `pump_fee_recipient` | `UncheckedAccount` (mut) | Pump fee recipient |
| `mayhem_program` | `UncheckedAccount` (mut) | Mayhem program |
| `mayhem_global_params` | `UncheckedAccount` | Mayhem global params |
| `mayhem_sol_vault` | `UncheckedAccount` (mut) | Mayhem SOL vault |
| `mayhem_state` | `UncheckedAccount` (mut) | Mayhem state |
| `mayhem_token_vault` | `UncheckedAccount` (mut) | Mayhem token vault |
| `system_program` | `Program<System>` | System Program |
| `token_program` | `UncheckedAccount` | Token2022 |
| `associated_token_program` | `Program<AssociatedToken>` | ATA Program |
| `rent` | `Sysvar<Rent>` | Rent sysvar |

**remaining_accounts (1 + num_buyers * 2):**
```
[vault_token_account, buyer_0_pda, buyer_0_ata, buyer_1_pda, buyer_1_ata, ...]
```

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `name` | `String` | Имя токена |
| `symbol` | `String` | Символ токена |
| `uri` | `String` | URI метаданных |
| `is_mayhem_mode` | `bool` | Режим mayhem |
| `lp_allocation` | `u64` | LP из пула (lamports, > 0) |
| `user_contribution` | `u64` | Вклад пользователя (lamports, > 0) |
| `buy_amounts` | `Vec<u64>` | Количество токенов для каждого buyer'а |
| `max_sol_costs` | `Vec<u64>` | Максимальная стоимость для каждого buyer'а (slippage) |

**Валидация:**
- `1 <= num_buyers <= 5`
- `buy_amounts.len() == max_sol_costs.len()`
- `lp_allocation > 0`, `user_contribution > 0`
- `lp_allocation <= lp_pool.available_liquidity`
- `sum(max_sol_costs) <= lp_allocation + user_contribution`
- `remaining_accounts.len() == 1 + num_buyers * 2`
- Каждый buyer PDA проверяется через `find_program_address`

**Логика (8 шагов):**

**Шаг 1: CPI create_v2** — создание токена на Pump.fun
- Полностью как в `proxy_create_token`
- `invoke()` с user + mint signers

**Шаг 2: Init vault_state PDA вручную**
- Нельзя использовать Anchor `init` потому что mint не существует в момент десериализации accounts
- `invoke_signed` → `system_instruction::create_account` с vault seeds
- User платит rent

**Шаг 3: Create vault ATA**
- CPI к Associated Token Program
- Создаёт ATA для vault PDA по минту нового токена

**Шаг 4: Pay fees + reserve LP**
- `user → treasury`: infrastructure_fee + rental_fee_rate
- `user → lp_pool`: user_contribution
- `lp_pool.reserved_liquidity += lp_allocation`
- `lp_pool.available_liquidity -= lp_allocation`

**Шаг 5: Loop по buyer'ам (0..N)**
Для каждого buyer (i = 0..num_buyers):
```
a) LP pool → buyer PDA (SOL, invoke_signed lp_pool seeds)
b) Create buyer ATA via CPI (Token2022)
c) CPI buy на Pump.fun (invoke_signed buyer seeds)
d) Transfer tokens: buyer ATA → vault ATA (Token2022 transfer_checked, invoke_signed buyer seeds)
e) Return unused SOL: buyer PDA → lp_pool
```

Buyer PDA seeds: `[b"buyer", vault_pda, &[index], &[bump]]`

**Шаг 6: Write vault state**
- Вручную записывает Anchor discriminator + сериализованные данные
- `status = Active`, `total_token_amount = total_tokens_bought`

**Шаг 7: Update LP pool accounting**
- `lp_pool.total_liquidity -= total_sol_spent`
- `lp_pool.reserved_liquidity -= lp_allocation`

**Шаг 8: Emit event**
- `LaunchBundleEvent` с итоговыми данными

**Compute Budget:** ~910k CU (лимит 1.4M с ComputeBudget)

**Event:** `LaunchBundleEvent`

---

## CPI к Pump.fun v2

Все CPI к Pump.fun строятся вручную в `cpi/pump_fun.rs`.

### Константы

```rust
PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
MAYHEM_PROGRAM_ID   = "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e"
MAX_BUYERS          = 5
BUYER_SEED          = b"buyer"
```

### create_v2

Создание токена. Дискриминатор: `d6904cec5f8b31b4`

**Аргументы (CreateV2Args):**
```rust
struct CreateV2Args {
    name: String,
    symbol: String,
    uri: String,
    creator: Pubkey,
    is_mayhem_mode: bool,
    is_cashback_enabled: OptionBool,  // всегда None
}
```

**Accounts (16):**
1. `mint` (signer, mut) — новый keypair
2. `mint_authority` (readonly)
3. `bonding_curve` (mut)
4. `associated_bonding_curve` (mut)
5. `global` (mut)
6. `user` (signer, mut)
7. `system_program` (readonly)
8. `token_program` (readonly) — Token2022
9. `associated_token_program` (readonly)
10. `mayhem_program` (readonly)
11. `mayhem_global_params` (readonly)
12. `mayhem_sol_vault` (mut)
13. `mayhem_state` (mut)
14. `mayhem_token_vault` (mut)
15. `event_authority` (readonly)
16. `pump_program` (readonly)

### buy

Покупка токенов с bonding curve. Дискриминатор: `66063d1201daebea`

**Аргументы (BuyArgs):**
```rust
struct BuyArgs {
    amount: u64,         // количество токенов
    max_sol_cost: u64,   // максимальная стоимость (slippage)
}
```

**Accounts (12):**
1. `global` (readonly)
2. `fee_recipient` (mut)
3. `mint` (readonly)
4. `bonding_curve` (mut)
5. `associated_bonding_curve` (mut)
6. `associated_user` (mut) — ATA покупателя
7. `user` (signer, mut) — покупатель (платит SOL)
8. `system_program` (readonly)
9. `token_program` (readonly) — Token2022
10. `rent` (readonly)
11. `event_authority` (readonly)
12. `pump_program` (readonly)

---

## CPI Token2022 (token_utils)

Утилиты для ручного построения CPI-инструкций к SPL Token / Token2022. Находятся в `cpi/token_utils.rs`. Используются вместо типизированных Anchor-хелперов для совместимости с Token2022.

### build_transfer_checked_instruction

Построение `TransferChecked` инструкции (opcode 12).

```rust
pub fn build_transfer_checked_instruction(
    token_program: &Pubkey,   // SPL Token или Token2022
    source: &Pubkey,          // Откуда
    mint: &Pubkey,            // Минт токена
    destination: &Pubkey,     // Куда
    authority: &Pubkey,       // Authority (signer)
    amount: u64,              // Количество токенов
    decimals: u8,             // Decimals минта (6 для Pump.fun)
) -> Instruction
```

**Используется в:** `redeem_tokens`, `liquidate_vault`

### build_close_account_instruction

Построение `CloseAccount` инструкции (opcode 9).

```rust
pub fn build_close_account_instruction(
    token_program: &Pubkey,   // SPL Token или Token2022
    account: &Pubkey,         // Token account для закрытия
    destination: &Pubkey,     // Получатель rent
    authority: &Pubkey,       // Authority (signer)
) -> Instruction
```

**Используется в:** `close_vault`

### build_create_ata_instruction

Построение `CreateAssociatedTokenAccount` инструкции (opcode 0).

```rust
pub fn build_create_ata_instruction(
    payer: &Pubkey,           // Кто платит за создание
    wallet: &Pubkey,          // Владелец ATA
    mint: &Pubkey,            // Минт токена
    token_program: &Pubkey,   // SPL Token или Token2022
    ata_program: &Pubkey,     // Associated Token Program
) -> Instruction
```

**Используется в:** `create_vault`

**Примечание:** `launch_bundle` содержит собственные локальные копии этих функций, т.к. ему нужна полная автономность в рамках одной атомарной транзакции.

---

## SOL Flow

### При создании vault (create_vault / launch_bundle)

```
User
 ├── infrastructure_fee ──────→ Treasury
 ├── rental_fee_rate ─────────→ Treasury
 └── user_contribution ───────→ LP Pool (total_liquidity += user_contribution)
                                   │
                           buy_budget = lp_allocation + user_contribution
                           reserved_liquidity += buy_budget
```

### При покупке токенов (proxy_buy_token)

```
LP Pool (buy_budget = lp_allocation + user_contribution)
 └──→ Vault PDA ──→ Pump.fun Bonding Curve (CPI buy)
                  │
                  └──→ Неиспользованный SOL → LP Pool (возврат)
```

### При покупке токенов (launch_bundle)

```
LP Pool
 ├──→ Buyer PDA 0 ──→ Pump.fun Bonding Curve
 │                  └──→ Остаток SOL → LP Pool
 ├──→ Buyer PDA 1 ──→ Pump.fun Bonding Curve
 │                  └──→ Остаток SOL → LP Pool
 ├──→ Buyer PDA 2 ──→ ...
 ├──→ Buyer PDA 3 ──→ ...
 └──→ Buyer PDA 4 ──→ ...
```

### При выкупе (redeem_tokens)

```
User
 ├── proportional_lp ─────────→ LP Pool (возврат ликвидности)
 └── redemption_fee ──────────→ Treasury
```

### При ликвидации (liquidate_vault)

```
LP Pool
 └── lp_lost ── СПИСЫВАЕТСЯ (total_liquidity -= lp_lost, reserved -= lp_lost)
     LP безвозвратно потерян
```

### При оплате аренды (pay_rental)

```
User
 └── rental_fee_rate ─────────→ Treasury
```

---

## Token Flow

### Создание токена

```
Pump.fun create_v2
 └──→ Весь supply (~1 млрд) ──→ Associated Bonding Curve ATA
```

### Покупка (proxy_buy_token)

```
Bonding Curve ATA
 └──→ Токены ──→ Vault Token Account (ATA vault PDA)
```

### Покупка (launch_bundle)

```
Bonding Curve ATA
 ├──→ Buyer 0 ATA ──→ (transfer_checked) ──→ Vault ATA
 ├──→ Buyer 1 ATA ──→ (transfer_checked) ──→ Vault ATA
 ├──→ Buyer 2 ATA ──→ (transfer_checked) ──→ Vault ATA
 ├──→ Buyer 3 ATA ──→ (transfer_checked) ──→ Vault ATA
 └──→ Buyer 4 ATA ──→ (transfer_checked) ──→ Vault ATA
```

### Выкуп (redeem_tokens)

```
Vault ATA
 └──→ Токены ──→ User Token Account (ATA пользователя)
```

### Ликвидация (liquidate_vault)

```
Vault ATA
 └──→ Все токены ──→ Executor Token Account (ATA executor'а)
```

---

## Vault Lifecycle

```
                 create_vault
                 launch_bundle
                      │
                      ▼
          ┌─ ReadyForExecution ─┐
          │   (только create_vault)  │
          │                     │
          │  proxy_buy_token    │
          │                     │
          ▼                     │
       Active ◄─────────────────┘
          │         (launch_bundle создаёт сразу Active)
          │
          ├── pay_rental ──→ Active (продление)
          │
          ├── redeem_tokens (partial) ──→ Active
          │
          ├── redeem_tokens (all) ──→ Closed ──→ close_vault ──→ [удалён]
          │
          └── (просрочка + grace_period)
                      │
               mark_defaulted
                      │
                      ▼
                 Defaulted
                      │
               liquidate_vault
                      │
                      ▼
                   Closed ──→ close_vault ──→ [удалён]
```

### Переходы статусов

| Из | В | Инструкция | Условие |
|----|---|------------|---------|
| — | ReadyForExecution | `create_vault` | Новый vault |
| — | Active | `launch_bundle` | Атомарный запуск |
| ReadyForExecution | Active | `proxy_buy_token` | Токены куплены |
| Active | Active | `pay_rental` | Аренда продлена |
| Active | Active | `redeem_tokens` (partial) | Частичный выкуп |
| Active | Closed | `redeem_tokens` (all) | Все токены выкуплены |
| Active | Defaulted | `mark_defaulted` | now > due + grace |
| Defaulted | Closed | `liquidate_vault` | Токены → executor |
| Closed | [deleted] | `close_vault` | Rent → user |

---

## Ошибки

```rust
pub enum LaunchVaultError {
    // Авторизация
    UnauthorizedAdmin,          // Только admin
    UnauthorizedUser,           // Только владелец vault
    UnauthorizedExecutor,       // Только executor

    // Статусы
    InvalidVaultStatus,         // Неверный статус vault для операции
    ProtocolPaused,             // Протокол на паузе

    // Ликвидность
    InsufficientLpLiquidity,    // Недостаточно LP в пуле
    InsufficientAvailableLiquidity, // Недостаточно доступной ликвидности для вывода

    // Выкуп
    RedeemAmountExceedsRemaining, // Количество превышает остаток в vault
    ZeroRedeemAmount,           // Нулевое количество для выкупа

    // Покупка
    ZeroTokenAmount,            // Нулевое количество токенов
    BudgetExceeded,             // max_sol_cost превышает buy_budget

    // Дефолт
    GracePeriodNotExpired,      // Grace period ещё не истёк

    // Валидация параметров
    InvalidRedemptionFeeBps,    // BPS > 10000
    InvalidRentalPeriod,        // Период <= 0
    InvalidGracePeriod,         // Grace period < 0
    InvalidTreasury,            // Неверный treasury account

    // Общее
    ArithmeticOverflow,         // Переполнение при вычислениях
    VaultTokenAccountNotEmpty,  // Token account не пуст при close_vault

    // Vault creation
    ZeroLpAllocation,           // LP allocation = 0
    ZeroUserContribution,       // User contribution = 0

    // Launch bundle
    MaxBuyersExceeded,          // Более 5 покупателей
    BuyParamsMismatch,          // buy_amounts.len() != max_sol_costs.len()
    NoBuyers,                   // Пустой массив покупателей
    InvalidRemainingAccounts,   // Неверное количество remaining_accounts
    InvalidBuyerPda,            // Buyer PDA не совпадает с ожидаемым

    // Token accounts
    InvalidVaultTokenAccount,   // Неверный vault token account (ATA derivation mismatch)
}
```

---

## События (Events)

### ProtocolInitializedEvent
```rust
pub struct ProtocolInitializedEvent {
    pub admin: Pubkey,
    pub executor: Pubkey,
    pub treasury: Pubkey,
    pub rental_period: i64,
    pub rental_fee_rate: u64,
    pub infrastructure_fee: u64,
    pub redemption_fee_bps: u16,
    pub grace_period: i64,
    pub timestamp: i64,
}
```

### ProtocolConfigUpdatedEvent
```rust
pub struct ProtocolConfigUpdatedEvent {
    pub admin: Pubkey,
    pub timestamp: i64,
}
```

### LpDepositedEvent
```rust
pub struct LpDepositedEvent {
    pub authority: Pubkey,
    pub amount: u64,
    pub new_total_liquidity: u64,
    pub new_available_liquidity: u64,
    pub timestamp: i64,
}
```

### LpWithdrawnEvent
```rust
pub struct LpWithdrawnEvent {
    pub authority: Pubkey,
    pub amount: u64,
    pub new_total_liquidity: u64,
    pub new_available_liquidity: u64,
    pub timestamp: i64,
}
```

### TokenCreatedEvent
```rust
pub struct TokenCreatedEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub is_mayhem_mode: bool,
    pub timestamp: i64,
}
```

### VaultCreatedEvent
```rust
pub struct VaultCreatedEvent {
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub lp_allocation: u64,
    pub user_contribution: u64,
    pub rental_due_timestamp: i64,
    pub timestamp: i64,
}
```

### TokenBoughtEvent
```rust
pub struct TokenBoughtEvent {
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub token_mint: Pubkey,
    pub token_amount: u64,
    pub sol_spent: u64,
    pub timestamp: i64,
}
```

### RentalPaidEvent
```rust
pub struct RentalPaidEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub rental_fee: u64,
    pub new_rental_due_timestamp: i64,
    pub timestamp: i64,
}
```

### TokensRedeemedEvent
```rust
pub struct TokensRedeemedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_amount: u64,
    pub lp_returned: u64,
    pub redemption_fee: u64,
    pub remaining_tokens: u64,
    pub remaining_lp: u64,
    pub vault_closed: bool,
    pub timestamp: i64,
}
```

### VaultDefaultedEvent
```rust
pub struct VaultDefaultedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub remaining_tokens: u64,
    pub remaining_lp: u64,
    pub cranker: Pubkey,
    pub timestamp: i64,
}
```

### VaultLiquidatedEvent
```rust
pub struct VaultLiquidatedEvent {
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub token_mint: Pubkey,
    pub tokens_liquidated: u64,
    pub lp_lost: u64,
    pub timestamp: i64,
}
```

### VaultClosedEvent
```rust
pub struct VaultClosedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub timestamp: i64,
}
```

### LaunchBundleEvent
```rust
pub struct LaunchBundleEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub num_buyers: u8,
    pub total_tokens: u64,
    pub total_sol_spent: u64,
    pub lp_allocation: u64,
    pub user_contribution: u64,
    pub timestamp: i64,
}
```

---

## Структура файлов

```
programs/launch_vault/
├── Cargo.toml
└── src/
    ├── lib.rs                              # Program entry point, 13 инструкций
    │
    ├── state/
    │   ├── mod.rs                          # Re-exports
    │   ├── protocol_config.rs              # ProtocolConfig, ProtocolStatus
    │   ├── launch_vault_state.rs           # LaunchVaultState, VaultStatus, RentalStatus
    │   └── lp_pool.rs                      # LpPool
    │
    ├── instructions/
    │   ├── mod.rs                          # Re-exports
    │   ├── initialize_protocol.rs          # Инициализация протокола
    │   ├── update_protocol_config.rs       # Обновление конфигурации
    │   ├── deposit_lp.rs                   # Депозит SOL в LP пул
    │   ├── withdraw_lp.rs                  # Вывод SOL из LP пула
    │   ├── proxy_create_token.rs           # CPI create_v2 на Pump.fun
    │   ├── create_vault.rs                 # Создание vault
    │   ├── proxy_buy_token.rs              # CPI buy на Pump.fun
    │   ├── pay_rental.rs                   # Оплата аренды
    │   ├── redeem_tokens.rs                # Выкуп токенов
    │   ├── mark_defaulted.rs               # Пометка дефолта
    │   ├── liquidate_vault.rs              # Ликвидация vault
    │   ├── close_vault.rs                  # Закрытие vault
    │   └── launch_bundle.rs                # Атомарный запуск (create + 5 buy)
    │
    ├── cpi/
    │   ├── mod.rs                          # Re-exports
    │   ├── pump_fun.rs                     # CPI builders: create_v2, buy + константы
    │   └── token_utils.rs                  # Token2022 CPI helpers: transfer_checked, close_account, create_ata
    │
    ├── errors.rs                           # LaunchVaultError (26 вариантов)
    └── events.rs                           # 13 event structs
```

---

## Devnet Deployment

| Компонент | Адрес |
|----------|-------|
| Program | `2hpb3dPckVbTf81WoeYt2BybcUZQCevxi1N5DwjaRsL7` |
| Admin / Executor / Treasury | `66HBrTxNii7eFzSTgo8mUzsij3FM7xC2L9jE2H89sDYs` |
| ProtocolConfig PDA | `4Zjh2HcUSCSaqqTt7xT4hr28A8Wmz4eXXJ2hqWuVRWwM` |
| LP Pool PDA | `HbDnSjsk5WZSpmGTRNkTmpS2gFryWZ6nva4jte9am4aM` |
| Address Lookup Table | `G7Aqezkcab2GJtphbNCi8HUG2hfW6ZQman3GT9UgjP6M` |

### Текущие параметры (devnet)

```
rental_period:      86400s (24ч)
rental_fee_rate:    100,000 lamports (0.0001 SOL)
infrastructure_fee: 50,000 lamports (0.00005 SOL)
redemption_fee_bps: 250 (2.5%)
grace_period:       3600s (1ч)
```

---

## CLI

```bash
# Управление протоколом
yarn cli init                                     # Инициализация
yarn cli deposit-lp --amount 5                    # Депозит SOL
yarn cli withdraw-lp --amount 1                   # Вывод SOL
yarn cli status                                   # Статус протокола

# Загрузка метаданных токена
yarn cli upload-metadata \
  --name "MimiCat" --symbol "MIMI" \
  --description "Community meme token" \
  --image "https://example.com/logo.png" \
  --twitter "https://x.com/..." \
  --telegram "https://t.me/..."

# Пошаговый запуск
yarn cli create-token --name "Token" --symbol "TKN" --uri <URI>
yarn cli create-vault --mint <PUBKEY> --lp-allocation 0.5 --user-contribution 0.3
yarn cli proxy-buy --mint <PUBKEY> --amount 1000000 --max-sol-cost 0.5

# Атомарный запуск (всё в одной TX)
yarn cli launch-bundle \
  --name "Token" --symbol "TKN" --uri <URI> \
  --lp-allocation 0.5 --user-contribution 0.3 \
  --buy-amounts 1000000 --max-sol-costs 0.5

# Глобальные опции
#   --keypair <PATH>      (default: ~/solana-wallet.json)
#   --cluster <CLUSTER>   (devnet | mainnet-beta, default: devnet)
#   --rpc <URL>           (custom RPC)
#   --priority-fee <NUM>  (microLamports, default: 50000)
```

---

## Успешные тесты (devnet)

| Тест | TX | Токен |
|------|-----|-------|
| launch_bundle (1 buyer) | `61nkJDGanFMA...` | `41ZNEY...` |
| launch_bundle (MimiCat) | `uaZn2FD9Un1n...` | `6R1oEJ...` |
