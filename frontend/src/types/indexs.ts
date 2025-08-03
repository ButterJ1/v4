import { Address } from 'viem'

// ============================================================================
// Contract Types
// ============================================================================

export interface HTLCContract {
  sender: Address
  recipient: Address
  token: Address
  amount: bigint
  hashlock: `0x${string}`
  timelock: bigint
  state: HTLCState
  createdAt: bigint
  chainId: bigint
  counterpartId: `0x${string}`
}

export enum HTLCState {
  INVALID = 0,
  ACTIVE = 1,
  WITHDRAWN = 2,
  REFUNDED = 3
}

export interface CrossChainOrder {
  maker: Address
  taker: Address
  srcToken: Address
  dstToken: Address
  srcAmount: bigint
  dstAmount: bigint
  srcChainId: bigint
  dstChainId: bigint
  hashlock: `0x${string}`
  deadline: bigint
  nonce: bigint
  makerSignature: `0x${string}`
  htlcId: `0x${string}`
  state: OrderState
}

export enum OrderState {
  INVALID = 0,
  PENDING = 1,
  MATCHED = 2,
  COMPLETED = 3,
  CANCELLED = 4,
  EXPIRED = 5,
  DISPUTED = 6
}

export interface ResolverInfo {
  resolver: Address
  fee: bigint
  resolverData: `0x${string}`
  signature: `0x${string}`
}

// ============================================================================
// UI Types
// ============================================================================

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

// ============================================================================
// 1inch SDK Types
// ============================================================================

export interface OneInchQuote {
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: string
  toAmount: string
  protocols: Protocol[]
  estimatedGas: string
  tx?: OneInchTransaction
}

export interface OneInchTransaction {
  from: Address
  to: Address
  data: `0x${string}`
  value: string
  gasPrice: string
  gas: string
}

export interface Protocol {
  name: string
  part: number
  fromTokenAddress: Address
  toTokenAddress: Address
}

export interface CrossChainQuote {
  fromChain: ChainInfo
  toChain: ChainInfo
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  route: RouteStep[]
  estimatedTime: number
  fees: {
    protocol: bigint
    bridge: bigint
    gas: bigint
    total: bigint
  }
  priceImpact: number
}

export interface RouteStep {
  chainId: number
  protocol: string
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  estimatedGas: bigint
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface TransactionStatus {
  hash: `0x${string}`
  status: 'pending' | 'confirmed' | 'failed'
  confirmations: number
  blockNumber?: bigint
  gasUsed?: bigint
  effectiveGasPrice?: bigint
  timestamp?: number
}

export interface SwapTransaction {
  id: string
  type: 'swap' | 'htlc-create' | 'htlc-withdraw' | 'htlc-refund' | 'order-create' | 'order-take'
  status: TransactionStatus
  fromChain: ChainInfo
  toChain?: ChainInfo
  fromToken: TokenInfo
  toToken?: TokenInfo
  amount: bigint
  fee?: bigint
  createdAt: Date
  updatedAt: Date
  error?: string
}

// ============================================================================
// Resolver Types
// ============================================================================

export interface ResolverProfile {
  address: Address
  name: string
  description: string
  fee: number // in basis points
  supportedChains: number[]
  totalVolume: bigint
  successRate: number
  averageExecutionTime: number
  isActive: boolean
  reputation: number
}

export interface ResolverQuote {
  resolver: ResolverProfile
  fee: bigint
  estimatedTime: number
  canExecute: boolean
  confidence: number
  requirements?: string[]
}

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletBalance {
  token: TokenInfo
  balance: bigint
  formattedBalance: string
  usdValue?: number
}

export interface WalletState {
  address?: Address
  chainId?: number
  balances: WalletBalance[]
  isConnecting: boolean
  isConnected: boolean
  error?: string
}

// ============================================================================
// Application State Types
// ============================================================================

export interface AppState {
  wallet: WalletState
  swap: {
    formData: SwapFormData
    quote?: CrossChainQuote
    order?: OrderInfo
    isLoading: boolean
    error?: string
  }
  orders: {
    items: OrderInfo[]
    isLoading: boolean
    error?: string
  }
  settings: {
    slippage: number
    deadline: number
    theme: 'light' | 'dark'
    currency: 'USD' | 'EUR' | 'GBP'
    notifications: boolean
  }
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ============================================================================
// Error Types
// ============================================================================

export interface ContractError {
  name: string
  message: string
  code?: number
  data?: any
}

export interface SwapError {
  type: 'network' | 'contract' | 'user' | 'timeout' | 'unknown'
  message: string
  details?: any
  recoverable: boolean
}

// ============================================================================
// Event Types
// ============================================================================

export interface ContractEvent {
  event: string
  args: any[]
  blockNumber: bigint
  transactionHash: `0x${string}`
  timestamp: number
}

export interface HTLCCreatedEvent extends ContractEvent {
  event: 'HTLCCreated'
  args: {
    contractId: `0x${string}`
    sender: Address
    recipient: Address
    token: Address
    amount: bigint
    hashlock: `0x${string}`
    timelock: bigint
    chainId: bigint
    counterpartId: `0x${string}`
  }
}

export interface OrderCreatedEvent extends ContractEvent {
  event: 'CrossChainOrderCreated'
  args: {
    orderId: `0x${string}`
    maker: Address
    srcToken: Address
    dstToken: Address
    srcAmount: bigint
    dstAmount: bigint
    srcChainId: bigint
    dstChainId: bigint
    deadline: bigint
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type ChainId = 1 | 11155111 | 2000 | 568 | 31337

export type SupportedToken = 'ETH' | 'DOGE' | 'USDC' | 'WETH' | 'WDOGE'

export type SwapDirection = 'eth-to-doge' | 'doge-to-eth'

export type TimeFrame = '1h' | '24h' | '7d' | '30d' | 'all'

// ============================================================================
// Component Props Types
// ============================================================================

export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface SwapFormProps extends BaseComponentProps {
  onSubmit: (data: SwapFormData) => void
  isLoading?: boolean
  error?: string
}

export interface TokenSelectorProps extends BaseComponentProps {
  tokens: TokenInfo[]
  selectedToken?: TokenInfo
  onSelect: (token: TokenInfo) => void
  chainId?: number
}

export interface OrderListProps extends BaseComponentProps {
  orders: OrderInfo[]
  onOrderSelect?: (order: OrderInfo) => void
  isLoading?: boolean
}

export interface TransactionHistoryProps extends BaseComponentProps {
  transactions: SwapTransaction[]
  isLoading?: boolean
}