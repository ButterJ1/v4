import { Address, Hash, PublicClient, WalletClient } from 'viem'
import { contractService } from './contractService'
import { getContractAddress, ChainId } from '../utils/contractAddresses'

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

export class BridgeService {
  private contractService = contractService

  /**
   * Send a cross-chain message
   */
  public async sendMessage(params: {
    chainId: ChainId
    targetChainId: number
    target: Address
    payload: `0x${string}`
    userAddress: Address
  }): Promise<{ hash: Hash; messageHash: `0x${string}` }> {
    const { chainId, targetChainId, target, payload, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    // Create message hash
    const messageHash = await this.calculateMessageHash({
      sourceChainId: chainId,
      targetChainId,
      sender: userAddress,
      target,
      payload,
      nonce: await this.getChainNonce(chainId, targetChainId),
      timestamp: Math.floor(Date.now() / 1000),
    })

    // Send message through bridge contract
    const hash = await this.contractService.getWalletClient(chainId).writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'sendMessage',
      args: [targetChainId, target, payload],
      account: userAddress,
    })

    return { hash, messageHash }
  }

  /**
   * Execute a cross-chain message
   */
  public async executeMessage(params: {
    chainId: ChainId
    message: CrossChainMessage
    userAddress: Address
  }): Promise<{ hash: Hash; success: boolean }> {
    const { chainId, message, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    const hash = await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'executeMessage',
      args: [message],
      account: userAddress,
    })

    // Wait for execution and check result
    const receipt = await this.contractService.waitForTransaction({
      chainId,
      hash,
      confirmations: 1,
    })

    return {
      hash,
      success: receipt.status === 'confirmed',
    }
  }

  /**
   * Verify message signatures
   */
  public async verifySignatures(params: {
    chainId: ChainId
    messageHash: `0x${string}`
    signatures: `0x${string}`[]
  }): Promise<{ isValid: boolean; validatorCount: number }> {
    const { chainId, messageHash, signatures } = params

    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    const result = await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'verifySignatures',
      args: [messageHash, signatures],
    }) as any

    return {
      isValid: result[0],
      validatorCount: Number(result[1]),
    }
  }

  /**
   * Get validator information
   */
  public async getValidator(params: {
    chainId: ChainId
    validatorAddress: Address
  }): Promise<ValidatorInfo> {
    const { chainId, validatorAddress } = params

    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    const result = await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'getValidator',
      args: [validatorAddress],
    }) as any

    return {
      validator: result.validator,
      stake: result.stake,
      isActive: result.isActive,
      joinedAt: Number(result.joinedAt),
      lastActivity: Number(result.lastActivity),
      slashCount: Number(result.slashCount),
    }
  }

  /**
   * Get active validators
   */
  public async getActiveValidators(chainId: ChainId): Promise<Address[]> {
    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'getActiveValidators',
      args: [],
    }) as Address[]
  }

  /**
   * Get bridge configuration
   */
  public async getBridgeConfig(chainId: ChainId): Promise<BridgeConfig> {
    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    const result = await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'getBridgeConfig',
      args: [],
    }) as any

    return {
      requiredSignatures: Number(result.requiredSignatures),
      messageTimeout: Number(result.messageTimeout),
      minStake: result.minStake,
      slashAmount: result.slashAmount,
      isPaused: result.isPaused,
    }
  }

  /**
   * Check if message has been executed
   */
  public async isMessageExecuted(params: {
    chainId: ChainId
    messageHash: `0x${string}`
  }): Promise<boolean> {
    const { chainId, messageHash } = params

    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'isMessageExecuted',
      args: [messageHash],
    }) as boolean
  }

  /**
   * Calculate message hash
   */
  public async calculateMessageHash(params: {
    sourceChainId: number
    targetChainId: number
    sender: Address
    target: Address
    payload: `0x${string}`
    nonce: number
    timestamp: number
  }): Promise<`0x${string}`> {
    const { sourceChainId, targetChainId, sender, target, payload, nonce, timestamp } = params

    // Use the same calculation as the contract
    const publicClient = this.contractService.getPublicClient(sourceChainId as ChainId)
    const bridgeAddress = getContractAddress(sourceChainId as ChainId, 'dogeChainBridge')

    return await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'calculateMessageHash',
      args: [sourceChainId, targetChainId, sender, target, payload, nonce, timestamp],
    }) as `0x${string}`
  }

  /**
   * Get bridge statistics
   */
  public async getBridgeStatistics(chainId: ChainId): Promise<BridgeStats> {
    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    const result = await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'getBridgeStatistics',
      args: [],
    }) as any

    return {
      totalValidators: Number(result[0]),
      activeValidators: Number(result[1]),
      totalMessages: Number(result[2]),
      supportedChainCount: Number(result[3]),
    }
  }

  /**
   * Add validator (admin only)
   */
  public async addValidator(params: {
    chainId: ChainId
    validatorAddress: Address
    stake: bigint
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, validatorAddress, stake, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'addValidator',
      args: [validatorAddress, stake],
      account: userAddress,
    })
  }

  /**
   * Remove validator (admin only)
   */
  public async removeValidator(params: {
    chainId: ChainId
    validatorAddress: Address
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, validatorAddress, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'removeValidator',
      args: [validatorAddress],
      account: userAddress,
    })
  }

  /**
   * Slash validator (admin only)
   */
  public async slashValidator(params: {
    chainId: ChainId
    validatorAddress: Address
    amount: bigint
    reason: string
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, validatorAddress, amount, reason, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'slashValidator',
      args: [validatorAddress, amount, reason],
      account: userAddress,
    })
  }

  /**
   * Pause bridge (admin only)
   */
  public async pauseBridge(params: {
    chainId: ChainId
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'pauseBridge',
      args: [],
      account: userAddress,
    })
  }

  /**
   * Unpause bridge (admin only)
   */
  public async unpauseBridge(params: {
    chainId: ChainId
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'unpauseBridge',
      args: [],
      account: userAddress,
    })
  }

  /**
   * Update bridge configuration (admin only)
   */
  public async updateBridgeConfig(params: {
    chainId: ChainId
    config: BridgeConfig
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, config, userAddress } = params

    const walletClient = this.contractService.getWalletClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await walletClient.writeContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'updateBridgeConfig',
      args: [config],
      account: userAddress,
    })
  }

  /**
   * Check if validator is healthy
   */
  public async isValidatorHealthy(params: {
    chainId: ChainId
    validatorAddress: Address
  }): Promise<boolean> {
    const { chainId, validatorAddress } = params

    const publicClient = this.contractService.getPublicClient(chainId)
    const bridgeAddress = getContractAddress(chainId, 'dogeChainBridge')

    return await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'isValidatorHealthy',
      args: [validatorAddress],
    }) as boolean
  }

  /**
   * Get chain nonce for cross-chain messages
   */
  private async getChainNonce(sourceChainId: ChainId, targetChainId: number): Promise<number> {
    const publicClient = this.contractService.getPublicClient(sourceChainId)
    const bridgeAddress = getContractAddress(sourceChainId, 'dogeChainBridge')

    const nonce = await publicClient.readContract({
      address: bridgeAddress,
      abi: this.getBridgeABI(),
      functionName: 'chainNonces',
      args: [targetChainId],
    }) as bigint

    return Number(nonce)
  }

  /**
   * Get bridge contract ABI
   */
  private getBridgeABI() {
    // Simplified ABI for demo - in production, this would be imported from artifacts
    return [
      {
        type: 'function',
        name: 'sendMessage',
        inputs: [
          { name: 'targetChainId', type: 'uint256' },
          { name: 'target', type: 'address' },
          { name: 'payload', type: 'bytes' }
        ],
        outputs: [{ name: 'messageHash', type: 'bytes32' }],
        stateMutability: 'nonpayable'
      },
      {
        type: 'function',
        name: 'executeMessage',
        inputs: [
          {
            name: 'message',
            type: 'tuple',
            components: [
              { name: 'sourceChainId', type: 'uint256' },
              { name: 'targetChainId', type: 'uint256' },
              { name: 'sender', type: 'address' },
              { name: 'target', type: 'address' },
              { name: 'payload', type: 'bytes' },
              { name: 'nonce', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' },
              { name: 'messageHash', type: 'bytes32' },
              { name: 'signatures', type: 'bytes[]' }
            ]
          }
        ],
        outputs: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
        ],
        stateMutability: 'nonpayable'
      },
      {
        type: 'function',
        name: 'verifySignatures',
        inputs: [
          { name: 'messageHash', type: 'bytes32' },
          { name: 'signatures', type: 'bytes[]' }
        ],
        outputs: [
          { name: 'isValid', type: 'bool' },
          { name: 'validatorCount', type: 'uint256' }
        ],
        stateMutability: 'view'
      },
      // ... other functions would be included here
    ] as const
  }
}

// Export singleton instance
export const bridgeService = new BridgeService()