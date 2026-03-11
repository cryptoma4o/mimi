/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/launch_vault.json`.
 */
export type LaunchVault = {
  "address": "2hpb3dPckVbTf81WoeYt2BybcUZQCevxi1N5DwjaRsL7",
  "metadata": {
    "name": "launchVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "closePosition",
      "discriminator": [
        123,
        134,
        81,
        0,
        49,
        68,
        98,
        98
      ],
      "accounts": [
        {
          "name": "closer",
          "docs": [
            "Closer: vault owner (anytime when Closed) or anyone (after timeout)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.user",
                "account": "launchVaultState"
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "launchVaultState"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "vaultOwner",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositLp",
      "discriminator": [
        83,
        107,
        16,
        26,
        26,
        20,
        130,
        56
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "depositorLpAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "forceClosePosition",
      "discriminator": [
        109,
        177,
        151,
        242,
        227,
        130,
        79,
        37
      ],
      "accounts": [
        {
          "name": "executor",
          "signer": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.user",
                "account": "launchVaultState"
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "launchVaultState"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "pumpProgram"
        },
        {
          "name": "pumpGlobal",
          "writable": true
        },
        {
          "name": "pumpFeeRecipient",
          "writable": true
        },
        {
          "name": "pumpBondingCurve",
          "writable": true
        },
        {
          "name": "pumpAssociatedBondingCurve",
          "writable": true
        },
        {
          "name": "pumpEventAuthority"
        },
        {
          "name": "pumpCreatorVault",
          "writable": true
        },
        {
          "name": "pumpGlobalVolumeAccumulator"
        },
        {
          "name": "pumpVaultVolumeAccumulator",
          "writable": true
        },
        {
          "name": "pumpFeeConfig"
        },
        {
          "name": "pumpBondingCurveV2"
        },
        {
          "name": "pumpFeeProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "initializeProtocol",
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "insuranceFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  117,
                  114,
                  97,
                  110,
                  99,
                  101,
                  95,
                  102,
                  117,
                  110,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "executor",
          "type": "pubkey"
        },
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "fixedFee",
          "type": "u64"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "maxUtilizationBps",
          "type": "u16"
        },
        {
          "name": "positionTimeout",
          "type": "i64"
        },
        {
          "name": "closeRewardBps",
          "type": "u16"
        },
        {
          "name": "insuranceSplitBps",
          "type": "u16"
        },
        {
          "name": "redemptionFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "openPosition",
      "discriminator": [
        135,
        128,
        47,
        77,
        15,
        152,
        240,
        49
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true,
          "signer": true
        },
        {
          "name": "executor",
          "signer": true
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "insuranceFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  117,
                  114,
                  97,
                  110,
                  99,
                  101,
                  95,
                  102,
                  117,
                  110,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "pumpProgram"
        },
        {
          "name": "pumpGlobal",
          "writable": true
        },
        {
          "name": "pumpMintAuthority"
        },
        {
          "name": "pumpBondingCurve",
          "writable": true
        },
        {
          "name": "pumpAssociatedBondingCurve",
          "writable": true
        },
        {
          "name": "pumpEventAuthority"
        },
        {
          "name": "pumpFeeRecipient",
          "writable": true
        },
        {
          "name": "mayhemProgram",
          "writable": true
        },
        {
          "name": "mayhemGlobalParams"
        },
        {
          "name": "mayhemSolVault",
          "writable": true
        },
        {
          "name": "mayhemState",
          "writable": true
        },
        {
          "name": "mayhemTokenVault",
          "writable": true
        },
        {
          "name": "pumpGlobalVolumeAccumulator"
        },
        {
          "name": "pumpCreatorVault",
          "writable": true
        },
        {
          "name": "pumpFeeConfig"
        },
        {
          "name": "pumpBondingCurveV2"
        },
        {
          "name": "pumpFeeProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "isMayhemMode",
          "type": "bool"
        },
        {
          "name": "lpAllocation",
          "type": "u64"
        },
        {
          "name": "userContribution",
          "type": "u64"
        },
        {
          "name": "buyAmounts",
          "type": {
            "vec": "u64"
          }
        },
        {
          "name": "maxSolCosts",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "proxyCreateToken",
      "discriminator": [
        35,
        118,
        72,
        201,
        188,
        163,
        244,
        80
      ],
      "accounts": [
        {
          "name": "user",
          "docs": [
            "Создатель токена, платит за создание"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "Свежий keypair для нового токена (mint)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "pumpProgram"
        },
        {
          "name": "pumpGlobal",
          "writable": true
        },
        {
          "name": "pumpMintAuthority"
        },
        {
          "name": "pumpBondingCurve",
          "writable": true
        },
        {
          "name": "pumpAssociatedBondingCurve",
          "writable": true
        },
        {
          "name": "mayhemProgram",
          "writable": true
        },
        {
          "name": "mayhemGlobalParams"
        },
        {
          "name": "mayhemSolVault",
          "writable": true
        },
        {
          "name": "mayhemState",
          "writable": true
        },
        {
          "name": "mayhemTokenVault",
          "writable": true
        },
        {
          "name": "pumpEventAuthority"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "isMayhemMode",
          "type": "bool"
        }
      ]
    },
    {
      "name": "redeemTokens",
      "discriminator": [
        246,
        98,
        134,
        41,
        152,
        33,
        120,
        69
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "launchVaultState"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellPosition",
      "discriminator": [
        11,
        170,
        234,
        139,
        126,
        196,
        142,
        74
      ],
      "accounts": [
        {
          "name": "seller",
          "docs": [
            "Seller: must be vault owner OR executor (keeper)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.user",
                "account": "launchVaultState"
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "launchVaultState"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "pumpProgram"
        },
        {
          "name": "pumpGlobal",
          "writable": true
        },
        {
          "name": "pumpFeeRecipient",
          "writable": true
        },
        {
          "name": "pumpBondingCurve",
          "writable": true
        },
        {
          "name": "pumpAssociatedBondingCurve",
          "writable": true
        },
        {
          "name": "pumpEventAuthority"
        },
        {
          "name": "pumpCreatorVault",
          "writable": true
        },
        {
          "name": "pumpGlobalVolumeAccumulator"
        },
        {
          "name": "pumpVaultVolumeAccumulator",
          "writable": true
        },
        {
          "name": "pumpFeeConfig"
        },
        {
          "name": "pumpBondingCurveV2"
        },
        {
          "name": "pumpFeeProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "minSolOutput",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateProtocolConfig",
      "discriminator": [
        197,
        97,
        123,
        54,
        221,
        168,
        11,
        135
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newExecutor",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newTreasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newFixedFee",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newMaxUtilizationBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newPositionTimeout",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "newCloseRewardBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newInsuranceSplitBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newRedemptionFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newAdmin",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newStatus",
          "type": {
            "option": {
              "defined": {
                "name": "protocolStatus"
              }
            }
          }
        }
      ]
    },
    {
      "name": "withdrawLp",
      "discriminator": [
        225,
        221,
        45,
        211,
        49,
        60,
        51,
        163
      ],
      "accounts": [
        {
          "name": "withdrawer",
          "writable": true,
          "signer": true
        },
        {
          "name": "lpPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "withdrawerLpAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lpAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "insuranceFund",
      "discriminator": [
        43,
        134,
        170,
        87,
        102,
        16,
        142,
        147
      ]
    },
    {
      "name": "launchVaultState",
      "discriminator": [
        113,
        30,
        216,
        238,
        22,
        236,
        100,
        73
      ]
    },
    {
      "name": "lpPool",
      "discriminator": [
        185,
        127,
        131,
        141,
        197,
        198,
        170,
        147
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    }
  ],
  "events": [
    {
      "name": "insuranceFundUpdatedEvent",
      "discriminator": [
        200,
        112,
        105,
        226,
        111,
        104,
        63,
        38
      ]
    },
    {
      "name": "lpDepositedEvent",
      "discriminator": [
        154,
        184,
        157,
        28,
        12,
        68,
        193,
        215
      ]
    },
    {
      "name": "lpWithdrawnEvent",
      "discriminator": [
        25,
        242,
        227,
        145,
        171,
        233,
        47,
        98
      ]
    },
    {
      "name": "positionClosedEvent",
      "discriminator": [
        76,
        129,
        10,
        225,
        238,
        51,
        158,
        126
      ]
    },
    {
      "name": "positionForceClosedEvent",
      "discriminator": [
        23,
        243,
        247,
        70,
        163,
        70,
        5,
        100
      ]
    },
    {
      "name": "positionOpenedEvent",
      "discriminator": [
        163,
        1,
        92,
        149,
        138,
        188,
        177,
        23
      ]
    },
    {
      "name": "positionSoldEvent",
      "discriminator": [
        80,
        227,
        123,
        183,
        36,
        162,
        154,
        219
      ]
    },
    {
      "name": "protocolConfigUpdatedEvent",
      "discriminator": [
        98,
        236,
        65,
        133,
        134,
        245,
        105,
        49
      ]
    },
    {
      "name": "protocolInitializedEvent",
      "discriminator": [
        225,
        159,
        165,
        209,
        78,
        191,
        125,
        73
      ]
    },
    {
      "name": "tokenCreatedEvent",
      "discriminator": [
        96,
        122,
        113,
        138,
        50,
        227,
        149,
        57
      ]
    },
    {
      "name": "tokensRedeemedEvent",
      "discriminator": [
        88,
        18,
        211,
        148,
        118,
        235,
        206,
        221
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedAdmin",
      "msg": "Unauthorized: only admin can perform this action"
    },
    {
      "code": 6001,
      "name": "unauthorizedUser",
      "msg": "Unauthorized: only the vault owner can perform this action"
    },
    {
      "code": 6002,
      "name": "unauthorizedExecutor",
      "msg": "Unauthorized: only the authorized executor can perform this action"
    },
    {
      "code": 6003,
      "name": "invalidVaultStatus",
      "msg": "Invalid vault status for this operation"
    },
    {
      "code": 6004,
      "name": "protocolPaused",
      "msg": "Protocol is currently paused"
    },
    {
      "code": 6005,
      "name": "insufficientLpLiquidity",
      "msg": "Insufficient LP liquidity available"
    },
    {
      "code": 6006,
      "name": "insufficientAvailableLiquidity",
      "msg": "Insufficient available liquidity for withdrawal"
    },
    {
      "code": 6007,
      "name": "redeemAmountExceedsRemaining",
      "msg": "Redeem amount exceeds remaining tokens in vault"
    },
    {
      "code": 6008,
      "name": "zeroRedeemAmount",
      "msg": "Redeem amount must be greater than zero"
    },
    {
      "code": 6009,
      "name": "zeroTokenAmount",
      "msg": "Token amount must be greater than zero"
    },
    {
      "code": 6010,
      "name": "invalidRedemptionFeeBps",
      "msg": "Redemption fee BPS must be <= 10000"
    },
    {
      "code": 6011,
      "name": "invalidTreasury",
      "msg": "Invalid treasury account"
    },
    {
      "code": 6012,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6013,
      "name": "vaultTokenAccountNotEmpty",
      "msg": "Vault token account is not empty"
    },
    {
      "code": 6014,
      "name": "zeroLpAllocation",
      "msg": "LP allocation must be greater than zero"
    },
    {
      "code": 6015,
      "name": "zeroUserContribution",
      "msg": "User contribution must be greater than zero"
    },
    {
      "code": 6016,
      "name": "budgetExceeded",
      "msg": "Max SOL cost exceeds buy budget"
    },
    {
      "code": 6017,
      "name": "maxBuyersExceeded",
      "msg": "Too many buyers in bundle (max 5)"
    },
    {
      "code": 6018,
      "name": "buyParamsMismatch",
      "msg": "Buy amounts and max sol costs must have same length"
    },
    {
      "code": 6019,
      "name": "noBuyers",
      "msg": "At least one buyer required"
    },
    {
      "code": 6020,
      "name": "invalidRemainingAccounts",
      "msg": "Invalid remaining accounts count for bundle"
    },
    {
      "code": 6021,
      "name": "invalidBuyerPda",
      "msg": "Invalid buyer PDA"
    },
    {
      "code": 6022,
      "name": "invalidVaultTokenAccount",
      "msg": "Invalid vault token account"
    },
    {
      "code": 6023,
      "name": "utilizationCapReached",
      "msg": "Pool utilization cap would be exceeded"
    },
    {
      "code": 6024,
      "name": "positionNotTimedOut",
      "msg": "Position has not timed out yet"
    },
    {
      "code": 6025,
      "name": "invalidFeeBps",
      "msg": "Invalid fee BPS value"
    },
    {
      "code": 6026,
      "name": "invalidUtilizationBps",
      "msg": "Invalid utilization BPS value"
    },
    {
      "code": 6027,
      "name": "invalidPositionTimeout",
      "msg": "Position timeout must be positive"
    },
    {
      "code": 6028,
      "name": "zeroDepositAmount",
      "msg": "Deposit amount must be greater than zero"
    },
    {
      "code": 6029,
      "name": "zeroWithdrawAmount",
      "msg": "Withdraw amount must be greater than zero"
    },
    {
      "code": 6030,
      "name": "invalidLpTokenAmount",
      "msg": "Invalid LP token amount"
    },
    {
      "code": 6031,
      "name": "unauthorizedSeller",
      "msg": "Only vault owner or executor can sell position"
    },
    {
      "code": 6032,
      "name": "slippageExceeded",
      "msg": "Minimum SOL output not met"
    }
  ],
  "types": [
    {
      "name": "insuranceFund",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalSol",
            "docs": [
              "Total SOL accumulated in insurance fund (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "authority",
            "docs": [
              "Authority who can withdraw (admin/multisig)"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "insuranceFundUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "newTotal",
            "type": "u64"
          },
          {
            "name": "amountAdded",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "launchVaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "totalTokenAmount",
            "docs": [
              "Total tokens bought at position open"
            ],
            "type": "u64"
          },
          {
            "name": "remainingTokenAmount",
            "docs": [
              "Remaining tokens in vault"
            ],
            "type": "u64"
          },
          {
            "name": "totalLpAllocation",
            "docs": [
              "Total LP allocation from pool (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "remainingLpAllocation",
            "docs": [
              "Remaining LP to return (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "userContribution",
            "docs": [
              "User's own SOL contribution (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "vaultStatus"
              }
            }
          },
          {
            "name": "openTimestamp",
            "docs": [
              "Unix timestamp when position was opened"
            ],
            "type": "i64"
          },
          {
            "name": "feePaid",
            "docs": [
              "Total upfront fee paid (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "numSubWallets",
            "docs": [
              "Number of PDA sub-wallets used for buying"
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lpDepositedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "solAmount",
            "type": "u64"
          },
          {
            "name": "lpTokensMinted",
            "type": "u64"
          },
          {
            "name": "newTotalLiquidity",
            "type": "u64"
          },
          {
            "name": "lpTokenPrice",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "lpPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalLiquidity",
            "docs": [
              "Total SOL in pool (lamports) — includes both available and reserved"
            ],
            "type": "u64"
          },
          {
            "name": "reservedLiquidity",
            "docs": [
              "SOL reserved for active positions (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "availableLiquidity",
            "docs": [
              "SOL available for new positions and LP withdrawals (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "lpMint",
            "docs": [
              "LP token mint address (mimi-LP)"
            ],
            "type": "pubkey"
          },
          {
            "name": "lpMintSupply",
            "docs": [
              "Cached LP token supply (mirrors on-chain mint supply)"
            ],
            "type": "u64"
          },
          {
            "name": "totalDefaults",
            "docs": [
              "Total number of defaults (for circuit breaker / analytics)"
            ],
            "type": "u32"
          },
          {
            "name": "totalPositionsClosed",
            "docs": [
              "Total positions closed (for default rate calculation)"
            ],
            "type": "u32"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lpWithdrawnEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "withdrawer",
            "type": "pubkey"
          },
          {
            "name": "lpTokensBurned",
            "type": "u64"
          },
          {
            "name": "solAmount",
            "type": "u64"
          },
          {
            "name": "newTotalLiquidity",
            "type": "u64"
          },
          {
            "name": "lpTokenPrice",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "positionClosedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "closer",
            "type": "pubkey"
          },
          {
            "name": "isPermissionless",
            "type": "bool"
          },
          {
            "name": "closeReward",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "positionForceClosedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "executor",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "tokensSold",
            "type": "u64"
          },
          {
            "name": "solRecovered",
            "type": "u64"
          },
          {
            "name": "lpLoss",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "positionOpenedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "numBuyers",
            "type": "u8"
          },
          {
            "name": "totalTokens",
            "type": "u64"
          },
          {
            "name": "totalSolSpent",
            "type": "u64"
          },
          {
            "name": "lpAllocation",
            "type": "u64"
          },
          {
            "name": "userContribution",
            "type": "u64"
          },
          {
            "name": "feePaid",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "positionSoldEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "tokensSold",
            "type": "u64"
          },
          {
            "name": "solReceived",
            "type": "u64"
          },
          {
            "name": "solReturnedToPool",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "executor",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "fixedFee",
            "docs": [
              "Fixed fee per position open (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "feeBps",
            "docs": [
              "Percentage fee on LP capital (basis points, 200 = 2%)"
            ],
            "type": "u16"
          },
          {
            "name": "maxUtilizationBps",
            "docs": [
              "Max utilization of LP pool (basis points, 8500 = 85%)"
            ],
            "type": "u16"
          },
          {
            "name": "positionTimeout",
            "docs": [
              "Position timeout in seconds (after which permissionless close is allowed)"
            ],
            "type": "i64"
          },
          {
            "name": "closeRewardBps",
            "docs": [
              "Reward for permissionless closer (basis points of returned LP)"
            ],
            "type": "u16"
          },
          {
            "name": "insuranceSplitBps",
            "docs": [
              "Percentage of fees routed to insurance fund (basis points, 2000 = 20%)"
            ],
            "type": "u16"
          },
          {
            "name": "redemptionFeeBps",
            "docs": [
              "Fee on token redemption (basis points, 10000 = 100%)"
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "protocolStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "protocolConfigUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "executor",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "fixedFee",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "maxUtilizationBps",
            "type": "u16"
          },
          {
            "name": "positionTimeout",
            "type": "i64"
          },
          {
            "name": "redemptionFeeBps",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "paused"
          }
        ]
      }
    },
    {
      "name": "tokenCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "isMayhemMode",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokensRedeemedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "lpReturned",
            "type": "u64"
          },
          {
            "name": "redemptionFee",
            "type": "u64"
          },
          {
            "name": "remainingTokens",
            "type": "u64"
          },
          {
            "name": "remainingLp",
            "type": "u64"
          },
          {
            "name": "vaultClosed",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "closed"
          },
          {
            "name": "timedOut"
          }
        ]
      }
    }
  ]
};
