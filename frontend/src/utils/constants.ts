import { Address } from 'viem'

// Chain Constants
export const SUPPORTED_CHAIN_IDS = [11155111, 568, 31337] as const
export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number]

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Ethereum Sepolia',
  2000: 'DogeChain Mainnet', 
  568: 'DogeChain Testnet',
  31337: 'Hardhat Local',
}

export const CHAIN_SYMBOLS: Record<number, string> = {
  1: 'ETH',
  11155111: 'ETH',
  2000: 'DOGE',
  568: 'DOGE',
  31337: 'ETH',
}

export const BLOCK_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  2000: 'https://explorer.dogechain.dog',
  568: 'https://explorer-testnet.dogechain.dog',
  31337: 'http://localhost:8545',
}

export const RPC_URLS: Record<number, string> = {
  1: 'https://eth-mainnet.public.blastapi.io',
  11155111: 'https://sepolia.infura.io/v3/',
  2000: 'https://rpc.dogechain.dog',
  568: 'https://rpc-testnet.dogechain.dog',
  31337: 'http://127.0.0.1:8545',
}

// Token Constants
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const WRAPPED_NATIVE_TOKENS: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  11155111: '0x0000000000000000000000000000000000000000', // Mock WETH
  2000: '0x0000000000000000000000000000000000000000', // WDOGE
  568: '0x0000000000000000000000000000000000000000', // Mock WDOGE
}

export const COMMON_TOKENS: Record<number, Address[]> = {
  1: [
    '0xA0b86a33E6989C25E0d65B6B59D70e0f8F0f8F0f', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  ],
  11155111: [
    '0x0000000000000000000000000000000000000000', // Mock USDC
  ],
  568: [
    '0x0000000000000000000000000000000000000000', // Mock WDOGE
  ],
}

// Swap Constants
export const DEFAULT_SLIPPAGE = 0.5 // 0.5%
export const MAX_SLIPPAGE = 50 // 50%
export const MIN_SLIPPAGE = 0.1 // 0.1%

export const DEFAULT_DEADLINE = 20 // 20 minutes
export const MAX_DEADLINE = 1440 // 24 hours
export const MIN_DEADLINE = 1 // 1 minute

export const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 3.0] // %

// HTLC Constants
export const DEFAULT_HTLC_TIMELOCK = 4 * 60 * 60 // 4 hours
export const MIN_HTLC_TIMELOCK = 30 * 60 // 30 minutes
export const MAX_HTLC_TIMELOCK = 30 * 24 * 60 * 60 // 30 days

export const CROSS_CHAIN_TIMELOCK_BUFFER = 2 * 60 * 60 // 2 hours buffer between chains

// Fee Constants
export const PROTOCOL_FEE_BPS = 10 // 0.1%
export const MAX_PROTOCOL_FEE_BPS = 500 // 5%

export const RESOLVER_FEE_BPS = 25 // 0.25%
export const MAX_RESOLVER_FEE_BPS = 200 // 2%

// Gas Constants
export const GAS_LIMITS: Record<string, bigint> = {
  ERC20_APPROVE: 100000n,
  ERC20_TRANSFER: 65000n,
  HTLC_CREATE: 300000n,
  HTLC_WITHDRAW: 100000n,
  HTLC_REFUND: 80000n,
  ORDER_CREATE: 250000n,
  ORDER_TAKE: 200000n,
  ORDER_COMPLETE: 150000n,
  ORDER_CANCEL: 100000n,
}

export const GAS_PRICE_LEVELS = {
  SLOW: 'slow',
  STANDARD: 'standard', 
  FAST: 'fast',
  INSTANT: 'instant',
} as const

// UI Constants
export const TOAST_DURATION = 4000 // 4 seconds
export const REFRESH_INTERVAL = 30000 // 30 seconds
export const POLLING_INTERVAL = 10000 // 10 seconds

export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_SETTINGS: 'fusion_plus_user_settings',
  RECENT_TOKENS: 'fusion_plus_recent_tokens',
  RECENT_CHAINS: 'fusion_plus_recent_chains',
  SWAP_HISTORY: 'fusion_plus_swap_history',
  PENDING_ORDERS: 'fusion_plus_pending_orders',
  FAVORITES: 'fusion_plus_favorites',
} as const

// API Constants
export const API_ENDPOINTS = {
  ONE_INCH_V5: 'https://api.1inch.dev/swap/v5.2',
  COINGECKO: 'https://api.coingecko.com/api/v3',
  DEFI_PULSE: 'https://api.defipulse.com/v1',
} as const

export const API_TIMEOUTS = {
  QUOTE: 5000, // 5 seconds
  SWAP: 30000, // 30 seconds
  PRICE: 3000, // 3 seconds
} as const

// Error Messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet',
  UNSUPPORTED_CHAIN: 'Please switch to a supported network',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INSUFFICIENT_ALLOWANCE: 'Insufficient token allowance',
  INVALID_AMOUNT: 'Please enter a valid amount',
  AMOUNT_TOO_SMALL: 'Amount is too small',
  AMOUNT_TOO_LARGE: 'Amount is too large',
  SLIPPAGE_TOO_HIGH: 'Slippage tolerance is too high',
  DEADLINE_TOO_SHORT: 'Deadline is too short',
  DEADLINE_TOO_LONG: 'Deadline is too long',
  PRICE_IMPACT_HIGH: 'Price impact is unusually high',
  NETWORK_ERROR: 'Network error occurred',
  TRANSACTION_FAILED: 'Transaction failed',
  USER_REJECTED: 'Transaction was rejected',
  TIMEOUT: 'Request timed out',
  UNKNOWN_ERROR: 'An unknown error occurred',
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  SWAP_INITIATED: 'Swap initiated successfully',
  ORDER_CREATED: 'Order created successfully',
  ORDER_MATCHED: 'Order matched successfully',
  ORDER_COMPLETED: 'Order completed successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  APPROVAL_SUCCESS: 'Token approval successful',
  HTLC_CREATED: 'HTLC created successfully',
  HTLC_WITHDRAWN: 'HTLC withdrawn successfully',
  HTLC_REFUNDED: 'HTLC refunded successfully',
} as const

// Order Status Colors
export const ORDER_STATUS_COLORS = {
  PENDING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  MATCHING: 'text-blue-600 bg-blue-50 border-blue-200',
  MATCHED: 'text-purple-600 bg-purple-50 border-purple-200',
  EXECUTING: 'text-orange-600 bg-orange-50 border-orange-200',
  COMPLETED: 'text-green-600 bg-green-50 border-green-200',
  CANCELLED: 'text-gray-600 bg-gray-50 border-gray-200',
  EXPIRED: 'text-red-600 bg-red-50 border-red-200',
  FAILED: 'text-red-700 bg-red-50 border-red-200',
} as const

// Transaction Types
export const TRANSACTION_TYPES = {
  APPROVE: 'approve',
  SWAP: 'swap',
  CREATE_ORDER: 'create_order',
  TAKE_ORDER: 'take_order',
  COMPLETE_ORDER: 'complete_order',
  CANCEL_ORDER: 'cancel_order',
  CREATE_HTLC: 'create_htlc',
  WITHDRAW_HTLC: 'withdraw_htlc',
  REFUND_HTLC: 'refund_htlc',
} as const

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_CROSS_CHAIN_SWAPS: true,
  ENABLE_LIMIT_ORDERS: true,
  ENABLE_MEV_PROTECTION: true,
  ENABLE_GAS_OPTIMIZATION: true,
  ENABLE_PRICE_ALERTS: false,
  ENABLE_ANALYTICS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_DARK_MODE: true,
  ENABLE_ADVANCED_MODE: true,
} as const

// Performance Constants
export const PERFORMANCE_LIMITS = {
  MAX_TOKENS_PER_CHAIN: 1000,
  MAX_ORDERS_PER_USER: 100,
  MAX_HISTORY_ITEMS: 500,
  MAX_FAVORITE_TOKENS: 50,
  MAX_RECENT_SEARCHES: 20,
} as const

// Validation Constants
export const VALIDATION_RULES = {
  MIN_SWAP_AMOUNT_USD: 1, // $1
  MAX_SWAP_AMOUNT_USD: 1000000, // $1M
  MIN_TOKEN_DECIMALS: 0,
  MAX_TOKEN_DECIMALS: 18,
  MAX_ADDRESS_LENGTH: 42,
  MIN_ADDRESS_LENGTH: 42,
} as const

// Network Configuration
export const NETWORK_CONFIG = {
  ETHEREUM: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    confirmations: 3,
    blockTime: 12,
    gasMultiplier: 1.2,
  },
  DOGECHAIN: {
    chainId: 568,
    name: 'DogeChain Testnet',
    confirmations: 5,
    blockTime: 2,
    gasMultiplier: 1.1,
  },
} as const

// Cross-chain Configuration
export const CROSS_CHAIN_CONFIG = {
  SUPPORTED_PAIRS: [
    { from: 11155111, to: 568 }, // Ethereum Sepolia -> DogeChain Testnet
    { from: 568, to: 11155111 }, // DogeChain Testnet -> Ethereum Sepolia
  ],
  MIN_CONFIRMATIONS: {
    11155111: 3, // Ethereum Sepolia
    568: 5, // DogeChain Testnet
  },
  TIMELOCK_DURATIONS: {
    SOURCE: 4 * 60 * 60, // 4 hours
    DESTINATION: 2 * 60 * 60, // 2 hours
  },
} as const

// Security Constants
export const SECURITY_CONFIG = {
  MAX_APPROVAL_AMOUNT: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  ENABLE_SIGNATURE_VERIFICATION: true,
  ENABLE_TRANSACTION_SIMULATION: true,
  REQUIRE_CONFIRMATION_FOR_LARGE_AMOUNTS: true,
  LARGE_AMOUNT_THRESHOLD_USD: 10000, // $10k
} as const

// Development Constants
export const DEV_CONFIG = {
  ENABLE_CONSOLE_LOGS: process.env.NODE_ENV === 'development',
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
  MOCK_API_RESPONSES: process.env.NODE_ENV === 'development',
  ENABLE_TEST_TOKENS: process.env.NODE_ENV === 'development',
} as const

// External Service URLs
export const EXTERNAL_URLS = {
  GITHUB: 'https://github.com/ButterJ1/fusion-plus-crosschain',
  DOCUMENTATION: 'https://docs.1inch.io/',
  SUPPORT: 'https://help.1inch.io/',
  TWITTER: 'https://twitter.com/1inch',
  DISCORD: 'https://discord.gg/1inch',
  TELEGRAM: 'https://t.me/OneInchNetwork',
} as const

// Regex Patterns
export const REGEX_PATTERNS = {
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  NUMERIC_INPUT: /^\d*\.?\d*$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
} as const