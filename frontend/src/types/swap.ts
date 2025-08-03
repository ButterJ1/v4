import { Address } from 'viem'

// Swap Form Types
export interface SwapFormData {
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: string
  toAmount: string
  fromChain: ChainInfo
  toChain: ChainInfo
  slippage: number
  deadline: number
}

export interface TokenInfo {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  balance?: bigint
  price?: number
  isNative: boolean
}

export interface ChainInfo {
  id: number
  name: string
  symbol: string
  decimals: number
  blockExplorer: string
  rpcUrl: string
  isTestnet: boolean
  logoURI?: string
}

// Swap Execution Types
export interface SwapParams {
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  fromChain: ChainInfo
  toChain: ChainInfo
  deadline: number
  userAddress: Address
  slippage?: number
}

export interface SwapQuote {
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  estimatedGas: bigint
  priceImpact: number
  exchangeRate: number
  route: SwapRoute[]
  fees: SwapFees
  validUntil: number
}

export interface SwapRoute {
  protocol: string
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  percentage: number
}

export interface SwapFees {
  protocolFee: bigint
  bridgeFee: bigint
  gasFee: bigint
  resolverFee: bigint
  total: bigint
}

// Cross-Chain Swap Types
export interface CrossChainSwapParams extends SwapParams {
  hashlock: `0x${string}`
  secret?: `0x${string}`
  counterpartId?: `0x${string}`
}

export interface CrossChainQuote extends SwapQuote {
  fromChain: ChainInfo
  toChain: ChainInfo
  estimatedTime: number
  requiredConfirmations: {
    source: number
    destination: number
  }
  htlcTimelock: {
    source: number
    destination: number
  }
  bridgeProtocol: string
}

export interface AtomicSwapFlow {
  step: SwapStep
  progress: number
  estimatedTime: number
  currentAction: string
  transactions: SwapTransaction[]
  canCancel: boolean
  canRefund: boolean
}

export enum SwapStep {
  INITIALIZING = 'initializing',
  APPROVING_TOKEN = 'approving_token',
  CREATING_ORDER = 'creating_order',
  WAITING_FOR_MATCH = 'waiting_for_match',
  CREATING_HTLC_SOURCE = 'creating_htlc_source',
  CREATING_HTLC_DESTINATION = 'creating_htlc_destination',
  REVEALING_SECRET = 'revealing_secret',
  WITHDRAWING_SOURCE = 'withdrawing_source',
  WITHDRAWING_DESTINATION = 'withdrawing_destination',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export interface SwapTransaction {
  id: string
  hash: `0x${string}`
  chainId: number
  type: SwapTransactionType
  status: TransactionStatus
  timestamp: number
  gasUsed?: bigint
  gasCost?: bigint
  blockNumber?: bigint
  confirmations: number
}

export enum SwapTransactionType {
  APPROVE = 'approve',
  CREATE_ORDER = 'create_order',
  TAKE_ORDER = 'take_order',
  CREATE_HTLC = 'create_htlc',
  WITHDRAW_HTLC = 'withdraw_htlc',
  REFUND_HTLC = 'refund_htlc',
  COMPLETE_ORDER = 'complete_order',
  CANCEL_ORDER = 'cancel_order',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

// Order Types
export interface OrderInfo {
  id: string
  maker: Address
  taker?: Address
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  fromChain: ChainInfo
  toChain: ChainInfo
  status: OrderStatus
  createdAt: Date
  expiresAt: Date
  txHash?: string
  htlcIds?: {
    source?: string
    destination?: string
  }
  secret?: `0x${string}`
  hashlock?: `0x${string}`
}

export enum OrderStatus {
  CREATING = 'creating',
  PENDING = 'pending',
  MATCHING = 'matching',
  MATCHED = 'matched',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

// Resolver Types
export interface ResolverInfo {
  address: Address
  name: string
  description: string
  fee: number
  supportedChains: number[]
  minimumAmount: bigint
  maximumAmount: bigint
  successRate: number
  averageExecutionTime: number
  reputation: number
  isActive: boolean
}

export interface ResolverQuote {
  resolver: ResolverInfo
  fee: bigint
  estimatedTime: number
  confidence: number
  canExecute: boolean
  requirements: string[]
}

// Price and Market Types
export interface TokenPrice {
  address: Address
  symbol: string
  price: number
  priceChange24h: number
  marketCap?: number
  volume24h?: number
  lastUpdated: number
}

export interface ExchangeRate {
  fromToken: string
  toToken: string
  rate: number
  inverseRate: number
  lastUpdated: number
  source: string
}

export interface MarketData {
  tokenPrices: Record<string, TokenPrice>
  exchangeRates: Record<string, ExchangeRate>
  totalValueLocked: bigint
  volume24h: bigint
  totalTrades: number
  averageSlippage: number
}

// Slippage and MEV Types
export interface SlippageConfig {
  tolerance: number
  maxSlippage: number
  autoSlippage: boolean
  priceImpactThreshold: number
}

export interface MEVProtection {
  enabled: boolean
  strategy: 'private_mempool' | 'commit_reveal' | 'time_delay'
  maxFrontrunTime: number
  protectionFee: bigint
}

// Swap Settings Types
export interface SwapSettings {
  slippage: SlippageConfig
  deadline: number
  mevProtection: MEVProtection
  expertMode: boolean
  soundEnabled: boolean
  autoRefresh: boolean
  preferredResolver?: Address
}

// Statistics Types
export interface SwapStatistics {
  totalSwaps: number
  totalVolume: bigint
  averageSwapSize: bigint
  successRate: number
  averageExecutionTime: number
  popularPairs: SwapPair[]
  chainDistribution: Record<number, number>
}

export interface SwapPair {
  fromToken: TokenInfo
  toToken: TokenInfo
  volume24h: bigint
  trades24h: number
  averageSize: bigint
}

export interface UserSwapHistory {
  swaps: OrderInfo[]
  totalVolume: bigint
  totalFees: bigint
  successRate: number
  favoriteTokens: TokenInfo[]
  frequentPairs: SwapPair[]
}

// Error Types
export interface SwapError {
  type: SwapErrorType
  message: string
  details?: any
  recoverable: boolean
  suggestedAction?: string
}

export enum SwapErrorType {
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  INSUFFICIENT_ALLOWANCE = 'insufficient_allowance',
  SLIPPAGE_TOO_HIGH = 'slippage_too_high',
  DEADLINE_EXCEEDED = 'deadline_exceeded',
  NETWORK_ERROR = 'network_error',
  CONTRACT_ERROR = 'contract_error',
  USER_REJECTED = 'user_rejected',
  TIMEOUT = 'timeout',
  PRICE_CHANGED = 'price_changed',
  UNKNOWN = 'unknown',
}

// Validation Types
export interface SwapValidation {
  isValid: boolean
  errors: SwapError[]
  warnings: SwapWarning[]
}

export interface SwapWarning {
  type: SwapWarningType
  message: string
  severity: 'low' | 'medium' | 'high'
}

export enum SwapWarningType {
  HIGH_SLIPPAGE = 'high_slippage',
  HIGH_PRICE_IMPACT = 'high_price_impact',
  LOW_LIQUIDITY = 'low_liquidity',
  LONG_EXECUTION_TIME = 'long_execution_time',
  HIGH_GAS_FEES = 'high_gas_fees',
  EXPERIMENTAL_TOKEN = 'experimental_token',
}

// Event Types
export interface SwapEvent {
  type: SwapEventType
  timestamp: number
  orderId?: string
  data: any
}

export enum SwapEventType {
  ORDER_CREATED = 'order_created',
  ORDER_MATCHED = 'order_matched',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_EXPIRED = 'order_expired',
  HTLC_CREATED = 'htlc_created',
  HTLC_WITHDRAWN = 'htlc_withdrawn',
  HTLC_REFUNDED = 'htlc_refunded',
  PRICE_UPDATED = 'price_updated',
  BALANCE_UPDATED = 'balance_updated',
}