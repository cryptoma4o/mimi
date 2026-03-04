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
      "name": "closeVault",
      "discriminator": [
        141,
        103,
        17,
        126,
        72,
        75,
        29,
        29
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
      "name": "createVault",
      "discriminator": [
        29,
        237,
        247,
        208,
        193,
        82,
        54,
        135
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint"
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
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
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
          "name": "lpAllocation",
          "type": "u64"
        },
        {
          "name": "userContribution",
          "type": "u64"
        }
      ]
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
          "name": "authority",
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
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
          "name": "rentalPeriod",
          "type": "i64"
        },
        {
          "name": "rentalFeeRate",
          "type": "u64"
        },
        {
          "name": "infrastructureFee",
          "type": "u64"
        },
        {
          "name": "redemptionFeeBps",
          "type": "u16"
        },
        {
          "name": "gracePeriod",
          "type": "i64"
        }
      ]
    },
    {
      "name": "launchBundle",
      "discriminator": [
        62,
        117,
        251,
        150,
        1,
        231,
        160,
        120
      ],
      "accounts": [
        {
          "name": "user",
          "docs": [
            "Token creator, pays fees + user_contribution"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "Fresh keypair for new token mint"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "executor",
          "docs": [
            "Authorized executor"
          ],
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
      "name": "liquidateVault",
      "discriminator": [
        106,
        212,
        123,
        68,
        193,
        252,
        239,
        189
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
          "name": "executorTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "markDefaulted",
      "discriminator": [
        97,
        81,
        37,
        229,
        172,
        125,
        169,
        178
      ],
      "accounts": [
        {
          "name": "cranker",
          "docs": [
            "Permissionless cranker — anyone can call"
          ],
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
        }
      ],
      "args": []
    },
    {
      "name": "payRental",
      "discriminator": [
        114,
        15,
        111,
        207,
        115,
        207,
        108,
        169
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
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "proxyBuyToken",
      "discriminator": [
        173,
        178,
        67,
        161,
        39,
        206,
        187,
        5
      ],
      "accounts": [
        {
          "name": "executor",
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
          "name": "executorTokenAccount",
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
          "name": "pumpGlobalVolumeAccumulator"
        },
        {
          "name": "pumpUserVolumeAccumulator",
          "writable": true
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
          "name": "associatedTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "maxSolCost",
          "type": "u64"
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
          "name": "newRentalPeriod",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "newRentalFeeRate",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newInfrastructureFee",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newRedemptionFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newGracePeriod",
          "type": {
            "option": "i64"
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
          "name": "authority",
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
    }
  ],
  "accounts": [
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
      "name": "launchBundleEvent",
      "discriminator": [
        219,
        89,
        125,
        163,
        91,
        65,
        17,
        117
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
      "name": "rentalPaidEvent",
      "discriminator": [
        131,
        205,
        68,
        253,
        146,
        223,
        196,
        123
      ]
    },
    {
      "name": "tokenBoughtEvent",
      "discriminator": [
        71,
        89,
        222,
        124,
        215,
        192,
        230,
        138
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
    },
    {
      "name": "vaultClosedEvent",
      "discriminator": [
        104,
        71,
        213,
        247,
        195,
        133,
        16,
        106
      ]
    },
    {
      "name": "vaultCreatedEvent",
      "discriminator": [
        81,
        80,
        244,
        58,
        136,
        54,
        236,
        111
      ]
    },
    {
      "name": "vaultDefaultedEvent",
      "discriminator": [
        103,
        213,
        5,
        55,
        218,
        58,
        165,
        183
      ]
    },
    {
      "name": "vaultLiquidatedEvent",
      "discriminator": [
        87,
        47,
        75,
        26,
        204,
        149,
        94,
        109
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
      "name": "gracePeriodNotExpired",
      "msg": "Grace period has not expired yet, cannot mark as defaulted"
    },
    {
      "code": 6011,
      "name": "invalidRedemptionFeeBps",
      "msg": "Redemption fee BPS must be <= 10000"
    },
    {
      "code": 6012,
      "name": "invalidRentalPeriod",
      "msg": "Rental period must be positive"
    },
    {
      "code": 6013,
      "name": "invalidGracePeriod",
      "msg": "Grace period must be non-negative"
    },
    {
      "code": 6014,
      "name": "invalidTreasury",
      "msg": "Invalid treasury account"
    },
    {
      "code": 6015,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6016,
      "name": "vaultTokenAccountNotEmpty",
      "msg": "Vault token account is not empty"
    },
    {
      "code": 6017,
      "name": "zeroLpAllocation",
      "msg": "LP allocation must be greater than zero"
    },
    {
      "code": 6018,
      "name": "zeroUserContribution",
      "msg": "User contribution must be greater than zero"
    },
    {
      "code": 6019,
      "name": "budgetExceeded",
      "msg": "Max SOL cost exceeds buy budget"
    },
    {
      "code": 6020,
      "name": "maxBuyersExceeded",
      "msg": "Too many buyers in bundle (max 5)"
    },
    {
      "code": 6021,
      "name": "buyParamsMismatch",
      "msg": "Buy amounts and max sol costs must have same length"
    },
    {
      "code": 6022,
      "name": "noBuyers",
      "msg": "At least one buyer required"
    },
    {
      "code": 6023,
      "name": "invalidRemainingAccounts",
      "msg": "Invalid remaining accounts count for bundle"
    },
    {
      "code": 6024,
      "name": "invalidBuyerPda",
      "msg": "Invalid buyer PDA"
    },
    {
      "code": 6025,
      "name": "invalidVaultTokenAccount",
      "msg": "Invalid vault token account"
    }
  ],
  "types": [
    {
      "name": "launchBundleEvent",
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
              "Всего куплено токенов (устанавливается при execute_bundle_buy)"
            ],
            "type": "u64"
          },
          {
            "name": "remainingTokenAmount",
            "docs": [
              "Осталось токенов в vault"
            ],
            "type": "u64"
          },
          {
            "name": "totalLpAllocation",
            "docs": [
              "Общая LP ликвидность задействована (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "remainingLpAllocation",
            "docs": [
              "LP ликвидность к возврату (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "userContribution",
            "docs": [
              "Вклад создателя (lamports)"
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
            "name": "rentalStartTimestamp",
            "docs": [
              "Unix timestamp начала аренды"
            ],
            "type": "i64"
          },
          {
            "name": "rentalDueTimestamp",
            "docs": [
              "Дедлайн текущего периода аренды"
            ],
            "type": "i64"
          },
          {
            "name": "rentalStatus",
            "type": {
              "defined": {
                "name": "rentalStatus"
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
      "name": "lpDepositedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newTotalLiquidity",
            "type": "u64"
          },
          {
            "name": "newAvailableLiquidity",
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
              "Общая ликвидность в пуле (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "reservedLiquidity",
            "docs": [
              "Зарезервированная ликвидность (под активные vault'ы)"
            ],
            "type": "u64"
          },
          {
            "name": "availableLiquidity",
            "docs": [
              "Доступная ликвидность (total - reserved)"
            ],
            "type": "u64"
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
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newTotalLiquidity",
            "type": "u64"
          },
          {
            "name": "newAvailableLiquidity",
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
            "name": "rentalPeriod",
            "docs": [
              "Период аренды в секундах (напр. 86400 = 24ч)"
            ],
            "type": "i64"
          },
          {
            "name": "rentalFeeRate",
            "docs": [
              "Стоимость аренды за период (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "infrastructureFee",
            "docs": [
              "Разовая комиссия за инфраструктуру (lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "redemptionFeeBps",
            "docs": [
              "Комиссия при выкупе (bps, 10000 = 100%)"
            ],
            "type": "u16"
          },
          {
            "name": "gracePeriod",
            "docs": [
              "Grace period до дефолта (секунды)"
            ],
            "type": "i64"
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
            "name": "rentalPeriod",
            "type": "i64"
          },
          {
            "name": "rentalFeeRate",
            "type": "u64"
          },
          {
            "name": "infrastructureFee",
            "type": "u64"
          },
          {
            "name": "redemptionFeeBps",
            "type": "u16"
          },
          {
            "name": "gracePeriod",
            "type": "i64"
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
      "name": "rentalPaidEvent",
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
            "name": "rentalFee",
            "type": "u64"
          },
          {
            "name": "newRentalDueTimestamp",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "rentalStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "overdue"
          }
        ]
      }
    },
    {
      "name": "tokenBoughtEvent",
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
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "solSpent",
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
      "name": "vaultClosedEvent",
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
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultCreatedEvent",
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
            "name": "vault",
            "type": "pubkey"
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
            "name": "rentalDueTimestamp",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultDefaultedEvent",
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
            "name": "remainingTokens",
            "type": "u64"
          },
          {
            "name": "remainingLp",
            "type": "u64"
          },
          {
            "name": "cranker",
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
      "name": "vaultLiquidatedEvent",
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
            "name": "tokensLiquidated",
            "type": "u64"
          },
          {
            "name": "lpLost",
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
      "name": "vaultStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "readyForExecution"
          },
          {
            "name": "active"
          },
          {
            "name": "closed"
          },
          {
            "name": "defaulted"
          }
        ]
      }
    }
  ]
};
