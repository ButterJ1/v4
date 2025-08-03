import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  formatEther,
  getContract,
  Address,
  Hash,
  PublicClient,
  WalletClient,
  parseUnits,
  formatUnits
} from 'viem'
import { sepolia, localhost } from 'viem/chains'
import { 
  HTLCContract, 
  CrossChainOrder, 
  TokenInfo, 
  TransactionStatus,
  ChainId 
} from '@/types'
import { getContractAddress, getChainConfig } from '@/utils/contractAddresses'

// Contract ABIs (simplified for demo - in production these would be imported from artifacts)
const HTLC_ABI = [
  {
    "type": "function",
    "name": "createHTLC",
    "inputs": [
      {"name": "recipient", "type": "address"},
      {"name": "token", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "hashlock", "type": "bytes32"},
      {"name": "timelock", "type": "uint256"},
      {"name": "counterpartId", "type": "bytes32"}
    ],
    "outputs": [{"name": "contractId", "type": "bytes32"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      {"name": "contractId", "type": "bytes32"},
      {"name": "preimage", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "refund",
    "inputs": [{"name": "contractId", "type": "bytes32"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getHTLC",
    "inputs": [{"name": "contractId", "type": "bytes32"}],
    "outputs": [
      {
        "name": "contract_",
        "type": "tuple",
        "components": [
          {"name": "sender", "type": "address"},
          {"name": "recipient", "type": "address"},
          {"name": "token", "type": "address"},
          {"name": "amount", "type": "uint256"},
          {"name": "hashlock", "type": "bytes32"},
          {"name": "timelock", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "createdAt", "type": "uint256"},
          {"name": "chainId", "type": "uint256"},
          {"name": "counterpartId", "type": "bytes32"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "calculateContractId",
    "inputs": [
      {"name": "sender", "type": "address"},
      {"name": "recipient", "type": "address"},
      {"name": "token", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "hashlock", "type": "bytes32"},
      {"name": "timelock", "type": "uint256"}
    ],
    "outputs": [{"name": "contractId", "type": "bytes32"}],
    "stateMutability": "pure"
  }
] as const

const ADAPTER_ABI = [
  {
    "type": "function",
    "name": "createCrossChainOrder",
    "inputs": [
      {"name": "srcToken", "type": "address"},
      {"name": "dstToken", "type": "address"},
      {"name": "srcAmount", "type": "uint256"},
      {"name": "dstAmount", "type": "uint256"},
      {"name": "dstChainId", "type": "uint256"},
      {"name": "hashlock", "type": "bytes32"},
      {"name": "deadline", "type": "uint256"},
      {"name": "taker", "type": "address"}
    ],
    "outputs": [{"name": "orderId", "type": "bytes32"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "takeCrossChainOrder",
    "inputs": [
      {"name": "orderId", "type": "bytes32"},
      {
        "name": "resolverInfo",
        "type": "tuple",
        "components": [
          {"name": "resolver", "type": "address"},
          {"name": "fee", "type": "uint256"},
          {"name": "resolverData", "type": "bytes"},
          {"name": "signature", "type": "bytes"}
        ]
      }
    ],
    "outputs": [
      {"name": "srcHTLCId", "type": "bytes32"},
      {"name": "dstHTLCId", "type": "bytes32"}
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "completeCrossChainOrder",
    "inputs": [
      {"name": "orderId", "type": "bytes32"},
      {"name": "preimage", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelCrossChainOrder",
    "inputs": [{"name": "orderId", "type": "bytes32"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getCrossChainOrder",
    "inputs": [{"name": "orderId", "type": "bytes32"}],
    "outputs": [
      {
        "name": "order",
        "type": "tuple",
        "components": [
          {"name": "maker", "type": "address"},
          {"name": "taker", "type": "address"},
          {"name": "srcToken", "type": "address"},
          {"name": "dstToken", "type": "address"},
          {"name": "srcAmount", "type": "uint256"},
          {"name": "dstAmount", "type": "uint256"},
          {"name": "srcChainId", "type": "uint256"},
          {"name": "dstChainId", "type": "uint256"},
          {"name": "hashlock", "type": "bytes32"},
          {"name": "deadline", "type": "uint256"},
          {"name": "nonce", "type": "uint256"},
          {"name": "makerSignature", "type": "bytes"},
          {"name": "htlcId", "type": "bytes32"},
          {"name": "state", "type": "uint8"}
        ]
      }
    ],
    "stateMutability": "view"
  }
] as const

const ERC20_ABI = [
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{"name": "account", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "faucet",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const

export class ContractService {
  private publicClients: Map<ChainId, PublicClient> = new Map()
  private walletClients: Map<ChainId, WalletClient> = new Map()

  constructor() {
    this.initializeClients()
  }

  /**
   * Initialize viem clients for supported chains
   */
  private initializeClients() {
    // Ethereum Sepolia
    this.publicClients.set(11155111, createPublicClient({
      chain: sepolia,
      transport: http()
    }))

    // DogeChain Testnet (custom chain)
    const dogeChainTestnet = {
      id: 568,
      name: 'DogeChain Testnet',
      network: 'dogechain-testnet',
      nativeCurrency: {
        decimals: 18,
        name: 'Dogecoin',
        symbol: 'DOGE',
      },
      rpcUrls: {
        public: { http: ['https://rpc-testnet.dogechain.dog'] },
        default: { http: ['https://rpc-testnet.dogechain.dog'] },
      },
      blockExplorers: {
        default: { name: 'DogeChain Explorer', url: 'https://explorer-testnet.dogechain.dog' },
      },
    }

    this.publicClients.set(568, createPublicClient({
      chain: dogeChainTestnet,
      transport: http()
    }))

    // Hardhat Local
    this.publicClients.set(31337, createPublicClient({
      chain: localhost,
      transport: http()
    }))
  }

  /**
   * Set wallet client for a specific chain
   */
  public setWalletClient(chainId: ChainId, walletClient: WalletClient) {
    this.walletClients.set(chainId, walletClient)
  }

  /**
   * Get public client for a chain
   */
  public getPublicClient(chainId: ChainId): PublicClient {
    const client = this.publicClients.get(chainId)
    if (!client) {
      throw new Error(`No public client available for chain ${chainId}`)
    }
    return client
  }

  /**
   * Get wallet client for a chain
   */
  public getWalletClient(chainId: ChainId): WalletClient {
    const client = this.walletClients.get(chainId)
    if (!client) {
      throw new Error(`No wallet client available for chain ${chainId}`)
    }
    return client
  }

  // ============================================================================
  // HTLC Contract Methods
  // ============================================================================

  /**
   * Create HTLC contract
   */
  public async createHTLC(params: {
    chainId: ChainId
    recipient: Address
    token: Address
    amount: bigint
    hashlock: `0x${string}`
    timelock: bigint
    counterpartId: `0x${string}`
    userAddress: Address
  }): Promise<{ hash: Hash; contractId: `0x${string}` }> {
    const { chainId, recipient, token, amount, hashlock, timelock, counterpartId, userAddress } = params

    const walletClient = this.getWalletClient(chainId)
    const publicClient = this.getPublicClient(chainId)
    
    const htlcAddress = getContractAddress(chainId, 'crossChainHTLC')

    // Get contract instance
    const contract = getContract({
      address: htlcAddress,
      abi: HTLC_ABI,
      client: walletClient
    })

    // Calculate contract ID first
    const contractId = await publicClient.readContract({
      address: htlcAddress,
      abi: HTLC_ABI,
      functionName: 'calculateContractId',
      args: [userAddress, recipient, token, amount, hashlock, timelock]
    }) as `0x${string}`

    // Create HTLC
    const hash = await contract.write.createHTLC([
      recipient,
      token,
      amount,
      hashlock,
      timelock,
      counterpartId
    ], {
      account: userAddress,
      value: token === '0x0000000000000000000000000000000000000000' ? amount : 0n
    })

    return { hash, contractId }
  }

  /**
   * Withdraw from HTLC
   */
  public async withdrawHTLC(params: {
    chainId: ChainId
    contractId: `0x${string}`
    preimage: `0x${string}`
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, contractId, preimage, userAddress } = params

    const walletClient = this.getWalletClient(chainId)
    const htlcAddress = getContractAddress(chainId, 'crossChainHTLC')

    const contract = getContract({
      address: htlcAddress,
      abi: HTLC_ABI,
      client: walletClient
    })

    return await contract.write.withdraw([contractId, preimage], {
      account: userAddress
    })
  }

  /**
   * Refund HTLC
   */
  public async refundHTLC(params: {
    chainId: ChainId
    contractId: `0x${string}`
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, contractId, userAddress } = params

    const walletClient = this.getWalletClient(chainId)
    const htlcAddress = getContractAddress(chainId, 'crossChainHTLC')

    const contract = getContract({
      address: htlcAddress,
      abi: HTLC_ABI,
      client: walletClient
    })

    return await contract.write.refund([contractId], {
      account: userAddress
    })
  }

  /**
   * Get HTLC details
   */
  public async getHTLC(params: {
    chainId: ChainId
    contractId: `0x${string}`
  }): Promise<HTLCContract> {
    const { chainId, contractId } = params

    const publicClient = this.getPublicClient(chainId)
    const htlcAddress = getContractAddress(chainId, 'crossChainHTLC')

    const result = await publicClient.readContract({
      address: htlcAddress,
      abi: HTLC_ABI,
      functionName: 'getHTLC',
      args: [contractId]
    }) as any

    return {
      sender: result.sender,
      recipient: result.recipient,
      token: result.token,
      amount: result.amount,
      hashlock: result.hashlock,
      timelock: result.timelock,
      state: result.state,
      createdAt: result.createdAt,
      chainId: result.chainId,
      counterpartId: result.counterpartId
    }
  }

  // ============================================================================
  // Fusion+ Adapter Methods
  // ============================================================================

  /**
   * Create cross-chain order
   */
  public async createCrossChainOrder(params: {
    chainId: ChainId
    srcToken: Address
    dstToken: Address
    srcAmount: bigint
    dstAmount: bigint
    dstChainId: number
    hashlock: `0x${string}`
    deadline: bigint
    taker: Address
    userAddress: Address
  }): Promise<{ hash: Hash; orderId: `0x${string}` }> {
    const { 
      chainId, 
      srcToken, 
      dstToken, 
      srcAmount, 
      dstAmount, 
      dstChainId, 
      hashlock, 
      deadline, 
      taker, 
      userAddress 
    } = params

    const walletClient = this.getWalletClient(chainId)
    const adapterAddress = getContractAddress(chainId, 'fusionPlusAdapter')

    const contract = getContract({
      address: adapterAddress,
      abi: ADAPTER_ABI,
      client: walletClient
    })

    // Calculate order ID (this would typically be done by the contract)
    const orderId = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`

    const hash = await contract.write.createCrossChainOrder([
      srcToken,
      dstToken,
      srcAmount,
      dstAmount,
      BigInt(dstChainId),
      hashlock,
      deadline,
      taker
    ], {
      account: userAddress,
      value: srcToken === '0x0000000000000000000000000000000000000000' ? srcAmount : 0n
    })

    return { hash, orderId }
  }

  /**
   * Take cross-chain order
   */
  public async takeCrossChainOrder(params: {
    chainId: ChainId
    orderId: `0x${string}`
    resolverInfo: {
      resolver: Address
      fee: bigint
      resolverData: `0x${string}`
      signature: `0x${string}`
    }
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, orderId, resolverInfo, userAddress } = params

    const walletClient = this.getWalletClient(chainId)
    const adapterAddress = getContractAddress(chainId, 'fusionPlusAdapter')

    const contract = getContract({
      address: adapterAddress,
      abi: ADAPTER_ABI,
      client: walletClient
    })

    return await contract.write.takeCrossChainOrder([orderId, resolverInfo], {
      account: userAddress
    })
  }

  /**
   * Complete cross-chain order
   */
  public async completeCrossChainOrder(params: {
    chainId: ChainId
    orderId: `0x${string}`
    preimage: `0x${string}`
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, orderId, preimage, userAddress } = params

    const walletClient = this.getWalletClient(chainId)
    const adapterAddress = getContractAddress(chainId, 'fusionPlusAdapter')

    const contract = getContract({
      address: adapterAddress,
      abi: ADAPTER_ABI,
      client: walletClient
    })

    return await contract.write.completeCrossChainOrder([orderId, preimage], {
      account: userAddress
    })
  }

  /**
   * Get cross-chain order details
   */
  public async getCrossChainOrder(params: {
    chainId: ChainId
    orderId: `0x${string}`
  }): Promise<CrossChainOrder> {
    const { chainId, orderId } = params

    const publicClient = this.getPublicClient(chainId)
    const adapterAddress = getContractAddress(chainId, 'fusionPlusAdapter')

    const result = await publicClient.readContract({
      address: adapterAddress,
      abi: ADAPTER_ABI,
      functionName: 'getCrossChainOrder',
      args: [orderId]
    }) as any

    return {
      maker: result.maker,
      taker: result.taker,
      srcToken: result.srcToken,
      dstToken: result.dstToken,
      srcAmount: result.srcAmount,
      dstAmount: result.dstAmount,
      srcChainId: result.srcChainId,
      dstChainId: result.dstChainId,
      hashlock: result.hashlock,
      deadline: result.deadline,
      nonce: result.nonce,
      makerSignature: result.makerSignature,
      htlcId: result.htlcId,
      state: result.state
    }
  }

  // ============================================================================
  // Token Methods
  // ============================================================================

  /**
   * Get token balance
   */
  public async getTokenBalance(params: {
    chainId: ChainId
    tokenAddress: Address
    userAddress: Address
  }): Promise<bigint> {
    const { chainId, tokenAddress, userAddress } = params

    const publicClient = this.getPublicClient(chainId)

    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      // Native token balance
      return await publicClient.getBalance({ address: userAddress })
    } else {
      // ERC20 token balance
      return await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress]
      }) as bigint
    }
  }

  /**
   * Get token allowance
   */
  public async getTokenAllowance(params: {
    chainId: ChainId
    tokenAddress: Address
    ownerAddress: Address
    spenderAddress: Address
  }): Promise<bigint> {
    const { chainId, tokenAddress, ownerAddress, spenderAddress } = params

    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return BigInt(2 ** 256 - 1) // Native tokens don't need approval
    }

    const publicClient = this.getPublicClient(chainId)

    return await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress]
    }) as bigint
  }

  /**
   * Approve token spending
   */
  public async approveToken(params: {
    chainId: ChainId
    tokenAddress: Address
    spenderAddress: Address
    amount: bigint
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, tokenAddress, spenderAddress, amount, userAddress } = params

    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Native tokens do not require approval')
    }

    const walletClient = this.getWalletClient(chainId)

    const contract = getContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      client: walletClient
    })

    return await contract.write.approve([spenderAddress, amount], {
      account: userAddress
    })
  }

  /**
   * Use faucet to get test tokens
   */
  public async useFaucet(params: {
    chainId: ChainId
    tokenAddress: Address
    userAddress: Address
  }): Promise<Hash> {
    const { chainId, tokenAddress, userAddress } = params

    const walletClient = this.getWalletClient(chainId)

    const contract = getContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      client: walletClient
    })

    return await contract.write.faucet([], {
      account: userAddress
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Wait for transaction confirmation
   */
  public async waitForTransaction(params: {
    chainId: ChainId
    hash: Hash
    confirmations?: number
  }): Promise<TransactionStatus> {
    const { chainId, hash, confirmations = 1 } = params

    const publicClient = this.getPublicClient(chainId)

    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations
      })

      return {
        hash,
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        confirmations: Number(receipt.confirmations || 0),
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      }
    } catch (error) {
      return {
        hash,
        status: 'failed',
        confirmations: 0
      }
    }
  }

  /**
   * Estimate gas for transaction
   */
  public async estimateGas(params: {
    chainId: ChainId
    to: Address
    data: `0x${string}`
    value?: bigint
    userAddress: Address
  }): Promise<bigint> {
    const { chainId, to, data, value = 0n, userAddress } = params

    const publicClient = this.getPublicClient(chainId)

    return await publicClient.estimateGas({
      account: userAddress,
      to,
      data,
      value
    })
  }

  /**
   * Get current gas price
   */
  public async getGasPrice(chainId: ChainId): Promise<bigint> {
    const publicClient = this.getPublicClient(chainId)
    return await publicClient.getGasPrice()
  }
}

// Export singleton instance
export const contractService = new ContractService()