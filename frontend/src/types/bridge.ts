import { Address } from 'viem'

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

export interface BridgeStats {
  totalValidators: number
  activeValidators: number
  totalMessages: number
  supportedChainCount: number
}

export interface TokenMapping {
  sourceChain: number
  sourceToken: Address
  targetChain: number
  targetToken: Address
  isActive: boolean
}

export interface MessageExecution {
  messageHash: `0x${string}`
  executed: boolean
  executionTime?: number
  executionTx?: `0x${string}`
  success?: boolean
  returnData?: `0x${string}`
}

export interface ValidatorSlash {
  validator: Address
  amount: bigint
  reason: string
  timestamp: number
  slashTx: `0x${string}`
}

export interface BridgeEvent {
  type: 'MessageSent' | 'MessageExecuted' | 'ValidatorAdded' | 'ValidatorRemoved' | 'ValidatorSlashed' | 'BridgePaused' | 'BridgeUnpaused'
  timestamp: number
  blockNumber: bigint
  transactionHash: `0x${string}`
  data: any
}

export enum BridgeStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  EMERGENCY = 'emergency',
}

export enum MessageStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  EXECUTED = 'executed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface BridgeMetrics {
  totalVolume: bigint
  totalMessages: number
  averageExecutionTime: number
  successRate: number
  activeValidators: number
  totalValidators: number
  bridgeHealth: 'healthy' | 'warning' | 'critical'
}

export interface ValidatorMetrics {
  validator: Address
  totalStake: bigint
  uptime: number
  messagesValidated: number
  slashCount: number
  performance: number
  lastActivity: number
}

export interface CrossChainRoute {
  sourceChain: number
  targetChain: number
  estimatedTime: number
  requiredValidators: number
  fee: bigint
  isActive: boolean
}

export interface BridgeHealth {
  overall: 'healthy' | 'warning' | 'critical'
  validators: {
    total: number
    active: number
    healthy: number
  }
  network: {
    latency: number
    throughput: number
    errorRate: number
  }
  security: {
    consensusReached: boolean
    slashingActive: boolean
    emergencyMode: boolean
  }
}