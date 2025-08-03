import { Address, Hash } from 'viem'

// HTLC Contract Types
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

export interface CreateHTLCParams {
  recipient: Address
  token: Address
  amount: bigint
  hashlock: `0x${string}`
  timelock: bigint
  counterpartId: `0x${string}`
}

export interface WithdrawHTLCParams {
  contractId: `0x${string}`
  preimage: `0x${string}`
}

export interface RefundHTLCParams {
  contractId: `0x${string}`
}

// Fusion+ Adapter Types
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

export interface CreateOrderParams {
  srcToken: Address
  dstToken: Address
  srcAmount: bigint
  dstAmount: bigint
  dstChainId: number
  hashlock: `0x${string}`
  deadline: bigint
  taker: Address
}

export interface TakeOrderParams {
  orderId: `0x${string}`
  resolverInfo: ResolverInfo
}

export interface CompleteOrderParams {
  orderId: `0x${string}`
  preimage: `0x${string}`
}

// Bridge Contract Types
export interface CrossChainMessage {
  sourceChainId: number
  targetChainId: number
  sender: Address
  target: Address
  payload: `0x${string}`
  nonce: number
  timestamp: number
  messageHash: `0x${string}`
  signatures: `0x${string}`[]
}

export interface ValidatorInfo {
  validator: Address
  stake: bigint
  isActive: boolean
  joinedAt: number
  lastActivity: number
  slashCount: number
}

export interface BridgeConfig {
  requiredSignatures: number
  messageTimeout: number
  minStake: bigint
  slashAmount: bigint
  isPaused: boolean
}

// Transaction Types
export interface TransactionStatus {
  hash: Hash
  status: 'pending' | 'confirmed' | 'failed'
  confirmations: number
  blockNumber?: bigint
  gasUsed?: bigint
  effectiveGasPrice?: bigint
  timestamp?: number
}

export interface ContractCall {
  address: Address
  abi: any[]
  functionName: string
  args: any[]
  value?: bigint
}

export interface ContractEvent {
  address: Address
  eventName: string
  args: any
  blockNumber: bigint
  transactionHash: Hash
  logIndex: number
  timestamp: number
}

// Error Types
export interface ContractError {
  name: string
  message: string
  code?: number
  data?: any
  cause?: Error
}

export interface RevertError extends ContractError {
  reason: string
  signature?: string
}

export interface GasEstimateError extends ContractError {
  gasLimit?: bigint
  gasPrice?: bigint
}

// Contract Deployment Types
export interface DeploymentConfig {
  chainId: number
  contracts: {
    [contractName: string]: {
      address: Address
      deployedAt: number
      deploymentTx: Hash
      constructorArgs: any[]
      verified: boolean
    }
  }
}

export interface ContractArtifact {
  contractName: string
  abi: any[]
  bytecode: `0x${string}`
  deployedBytecode: `0x${string}`
  linkReferences?: any
  deployedLinkReferences?: any
}

// Gas and Fee Types
export interface GasEstimate {
  gasLimit: bigint
  gasPrice: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  totalCost: bigint
}

export interface FeeStructure {
  protocolFee: bigint
  bridgeFee: bigint
  gasFee: bigint
  resolverFee: bigint
  totalFee: bigint
}

// Token Contract Types
export interface TokenContract {
  address: Address
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  isNative: boolean
}

export interface TokenBalance {
  token: TokenContract
  balance: bigint
  formattedBalance: string
  usdValue?: number
}

export interface TokenAllowance {
  token: Address
  owner: Address
  spender: Address
  allowance: bigint
  formattedAllowance: string
}

export interface FaucetInfo {
  token: Address
  amount: bigint
  cooldown: number
  lastRequest: number
  canRequest: boolean
  remainingTime: number
}

// Mock Contract Types (for testing)
export interface MockResolverConfig {
  name: string
  fee: number
  minAmount: bigint
  maxAmount: bigint
  isActive: boolean
  successRate: number
  averageExecutionTime: number
}

export interface MockTokenConfig {
  name: string
  symbol: string
  decimals: number
  initialSupply: bigint
  maxSupply: bigint
  faucetEnabled: boolean
  faucetAmount: bigint
  faucetCooldown: number
}

// Event Filter Types
export interface EventFilter {
  address?: Address
  topics?: (string | string[] | null)[]
  fromBlock?: bigint | 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized'
  toBlock?: bigint | 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized'
}

export interface EventLog {
  address: Address
  topics: `0x${string}`[]
  data: `0x${string}`
  blockNumber: bigint
  transactionHash: Hash
  transactionIndex: number
  blockHash: `0x${string}`
  logIndex: number
  removed: boolean
}

// Contract Interaction Types
export interface ReadContractParams {
  address: Address
  abi: any[]
  functionName: string
  args?: any[]
  blockNumber?: bigint
}

export interface WriteContractParams {
  address: Address
  abi: any[]
  functionName: string
  args?: any[]
  value?: bigint
  gas?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number
}

export interface SimulateContractParams extends WriteContractParams {
  account: Address
}

export interface MulticallRequest {
  target: Address
  callData: `0x${string}`
  allowFailure?: boolean
}

export interface MulticallResult {
  success: boolean
  returnData: `0x${string}`
}