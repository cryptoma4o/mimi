use anchor_lang::prelude::*;

#[error_code]
pub enum LaunchVaultError {
    #[msg("Unauthorized: only admin can perform this action")]
    UnauthorizedAdmin,

    #[msg("Unauthorized: only the vault owner can perform this action")]
    UnauthorizedUser,

    #[msg("Unauthorized: only the authorized executor can perform this action")]
    UnauthorizedExecutor,

    #[msg("Invalid vault status for this operation")]
    InvalidVaultStatus,

    #[msg("Protocol is currently paused")]
    ProtocolPaused,

    #[msg("Insufficient LP liquidity available")]
    InsufficientLpLiquidity,

    #[msg("Insufficient available liquidity for withdrawal")]
    InsufficientAvailableLiquidity,

    #[msg("Redeem amount exceeds remaining tokens in vault")]
    RedeemAmountExceedsRemaining,

    #[msg("Redeem amount must be greater than zero")]
    ZeroRedeemAmount,

    #[msg("Token amount must be greater than zero")]
    ZeroTokenAmount,

    #[msg("Redemption fee BPS must be <= 10000")]
    InvalidRedemptionFeeBps,

    #[msg("Invalid treasury account")]
    InvalidTreasury,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Vault token account is not empty")]
    VaultTokenAccountNotEmpty,

    #[msg("LP allocation must be greater than zero")]
    ZeroLpAllocation,

    #[msg("User contribution must be greater than zero")]
    ZeroUserContribution,

    #[msg("Max SOL cost exceeds buy budget")]
    BudgetExceeded,

    #[msg("Too many buyers in bundle (max 5)")]
    MaxBuyersExceeded,

    #[msg("Buy amounts and max sol costs must have same length")]
    BuyParamsMismatch,

    #[msg("At least one buyer required")]
    NoBuyers,

    #[msg("Invalid remaining accounts count for bundle")]
    InvalidRemainingAccounts,

    #[msg("Invalid buyer PDA")]
    InvalidBuyerPda,

    #[msg("Invalid vault token account")]
    InvalidVaultTokenAccount,

    #[msg("Pool utilization cap would be exceeded")]
    UtilizationCapReached,

    #[msg("Position has not timed out yet")]
    PositionNotTimedOut,

    #[msg("Invalid fee BPS value")]
    InvalidFeeBps,

    #[msg("Invalid utilization BPS value")]
    InvalidUtilizationBps,

    #[msg("Position timeout must be positive")]
    InvalidPositionTimeout,

    #[msg("Deposit amount must be greater than zero")]
    ZeroDepositAmount,

    #[msg("Withdraw amount must be greater than zero")]
    ZeroWithdrawAmount,

    #[msg("Invalid LP token amount")]
    InvalidLpTokenAmount,

    #[msg("Only vault owner or executor can sell position")]
    UnauthorizedSeller,

    #[msg("Minimum SOL output not met")]
    SlippageExceeded,

    #[msg("User contribution below minimum required")]
    UserContributionTooLow,

    #[msg("LP allocation exceeds maximum allowed")]
    LpAllocationTooHigh,

    #[msg("User contribution ratio below minimum required")]
    InsufficientUserRatio,

    #[msg("Stop-loss not configured for this position")]
    StopLossNotConfigured,

    #[msg("Stop-loss already triggered")]
    StopLossAlreadyTriggered,

    #[msg("Stop-loss condition not met (price above threshold)")]
    StopLossConditionNotMet,

    #[msg("Circuit breaker triggered — too many positions or cooldown active")]
    CircuitBreakerTriggered,

    #[msg("Insurance fund withdrawal would exceed minimum balance")]
    InsuranceFundBelowMinimum,

    #[msg("Invalid insurance fund authority")]
    InvalidInsuranceFundAuthority,

    #[msg("Insurance fund amount must be greater than zero")]
    ZeroInsuranceFundAmount,

    #[msg("Cannot resume protocol — circuit breaker still in cooldown")]
    CircuitBreakerInCooldown,

    #[msg("Only admin or executor can pause protocol")]
    UnauthorizedPauser,

    #[msg("Invalid circuit breaker parameter")]
    InvalidCircuitBreakerParam,

    #[msg("Stop-loss basis points must be 0 or less than 10000")]
    InvalidStopLossParam,

    #[msg("Protocol is not paused")]
    ProtocolNotPaused,

    #[msg("Invalid PumpFun fee program")]
    InvalidPumpFeeProgram,

    #[msg("Invalid bonding curve account data")]
    InvalidBondingCurveData,

    #[msg("Invalid token program — expected Token2022")]
    InvalidTokenProgram,
}
