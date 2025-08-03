import { 
  LimitOrderBuilder, 
  LimitOrderProtocolFacade, 
  LimitOrderPredicateBuilder 
} from '@1inch/limit-order-sdk'
import { 
  CrossChainSDK,
  PresetEnum,
  OrderStatus as SDKOrderStatus,
  FusionOrderV4Struct,
  OrderInfoData
} from '@1inch/cross-chain-sdk'
import { Address } from 'viem'
import { 
  TokenInfo, 
  ChainInfo, 
  CrossChainQuote, 
  OneInchQuote,
  SwapFormData,
  OrderInfo,
  OrderStatus 
} from '@/types'

export class OneInchService {
  private limitOrderBuilder: LimitOrderBuilder
  private limitOrderProtocol: LimitOrderProtocolFacade
  private crossChainSDK: CrossChainSDK
  
  constructor() {
    // Initialize with default network (will be updated based on user's chain)
    this.initializeSDKs(1) // Default to Ethereum mainnet
  }

  /**
   * Initialize SDKs for specific chain
   */
  private initializeSDKs(chainId: number) {
    try {
      // Initialize Limit Order SDK
      this.limitOrderBuilder = new LimitOrderBuilder(
        chainId,
        this.getContractAddress(chainId),
        this.getProviderUrl(chainId)
      )

      this.limitOrderProtocol = new LimitOrderProtocolFacade(
        this.getContractAddress(chainId),
        chainId,
        this.getWeb3Provider(chainId)
      )

      // Initialize Cross-Chain SDK
      this.crossChainSDK = new CrossChainSDK({
        preset: this.isTestnet(chainId) ? PresetEnum.testnet : PresetEnum.mainnet,
        authKey: process.env.VITE_1INCH_API_KEY || '',
        blockchainProvider: this.getWeb3Provider(chainId)
      })

      console.log(`✅ 1inch SDKs initialized for chain ${chainId}`)
    } catch (error) {
      console.error('❌ Failed to initialize 1inch SDKs:', error)
      throw new Error('Failed to initialize 1inch SDK')
    }
  }

  /**
   * Switch to different chain
   */
  public switchChain(chainId: number) {
    this.initializeSDKs(chainId)
  }

  /**
   * Get quote for cross-chain swap
   */
  public async getCrossChainQuote(params: {
    fromToken: TokenInfo
    toToken: TokenInfo
    amount: bigint
    fromChain: ChainInfo
    toChain: ChainInfo
    userAddress: Address
  }): Promise<CrossChainQuote> {
    try {
      const { fromToken, toToken, amount, fromChain, toChain, userAddress } = params

      // Use cross-chain SDK to get quote
      const quote = await this.crossChainSDK.getQuote({
        srcChainId: fromChain.id,
        dstChainId: toChain.id,
        srcTokenAddress: fromToken.address,
        dstTokenAddress: toToken.address,
        amount: amount.toString(),
        walletAddress: userAddress,
        enableEstimate: true
      })

      // Transform SDK response to our format
      const crossChainQuote: CrossChainQuote = {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount: BigInt(quote.srcTokenAmount),
        toAmount: BigInt(quote.dstTokenAmount),
        route: this.parseRoute(quote),
        estimatedTime: quote.estimatedExecutionTimeSeconds || 300, // 5 min default
        fees: {
          protocol: BigInt(quote.protocolFee || '0'),
          bridge: BigInt(quote.bridgeFee || '0'),
          gas: BigInt(quote.estimatedGas || '0'),
          total: BigInt(quote.totalFee || '0')
        },
        priceImpact: parseFloat(quote.priceImpact || '0')
      }

      return crossChainQuote
    } catch (error) {
      console.error('❌ Failed to get cross-chain quote:', error)
      throw new Error(`Failed to get quote: ${error.message}`)
    }
  }

  /**
   * Create limit order for cross-chain swap
   */
  public async createLimitOrder(params: {
    maker: Address
    fromToken: TokenInfo
    toToken: TokenInfo
    fromAmount: bigint
    toAmount: bigint
    deadline: number
    chainId: number
  }) {
    try {
      const { maker, fromToken, toToken, fromAmount, toAmount, deadline, chainId } = params

      // Build limit order
      const order = this.limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: fromToken.address,
        takerAssetAddress: toToken.address,
        makerAddress: maker,
        makerAmount: fromAmount.toString(),
        takerAmount: toAmount.toString(),
        predicate: LimitOrderPredicateBuilder.timestampBelow(deadline),
        permit: '0x',
        interaction: '0x'
      })

      // Get order hash for signing
      const orderHash = this.limitOrderBuilder.buildOrderHash(order)

      return {
        order,
        orderHash,
        chainId
      }
    } catch (error) {
      console.error('❌ Failed to create limit order:', error)
      throw new Error(`Failed to create order: ${error.message}`)
    }
  }

  /**
   * Submit cross-chain order using Fusion+
   */
  public async submitFusionOrder(params: {
    order: FusionOrderV4Struct
    signature: string
    chainId: number
  }): Promise<string> {
    try {
      const { order, signature, chainId } = params

      // Submit order through cross-chain SDK
      const result = await this.crossChainSDK.submitOrder({
        order,
        signature,
        quoteId: undefined // Will be set by SDK if needed
      })

      return result.orderHash
    } catch (error) {
      console.error('❌ Failed to submit Fusion order:', error)
      throw new Error(`Failed to submit order: ${error.message}`)
    }
  }

  /**
   * Get order status
   */
  public async getOrderStatus(orderHash: string): Promise<OrderStatus> {
    try {
      const status = await this.crossChainSDK.getOrderStatus(orderHash)
      
      // Map SDK status to our status
      return this.mapOrderStatus(status.status)
    } catch (error) {
      console.error('❌ Failed to get order status:', error)
      throw new Error(`Failed to get order status: ${error.message}`)
    }
  }

  /**
   * Get user's orders
   */
  public async getUserOrders(userAddress: Address): Promise<OrderInfo[]> {
    try {
      const orders = await this.crossChainSDK.getActiveOrders({
        walletAddress: userAddress
      })

      return orders.map(order => this.transformSDKOrder(order))
    } catch (error) {
      console.error('❌ Failed to get user orders:', error)
      throw new Error(`Failed to get orders: ${error.message}`)
    }
  }

  /**
   * Get supported tokens for a chain
   */
  public async getSupportedTokens(chainId: number): Promise<TokenInfo[]> {
    try {
      // This would typically come from 1inch API
      // For now, return hardcoded list for demo
      return this.getDefaultTokens(chainId)
    } catch (error) {
      console.error('❌ Failed to get supported tokens:', error)
      return this.getDefaultTokens(chainId)
    }
  }

  /**
   * Get token price in USD
   */
  public async getTokenPrice(tokenAddress: Address, chainId: number): Promise<number> {
    try {
      // This would use 1inch price API
      // For demo, return mock prices
      const mockPrices = {
        '0x0000000000000000000000000000000000000000': 2000, // ETH
        'ETH': 2000,
        'DOGE': 0.08,
        'USDC': 1.00
      }

      return mockPrices[tokenAddress as keyof typeof mockPrices] || 0
    } catch (error) {
      console.error('❌ Failed to get token price:', error)
      return 0
    }
  }

  /**
   * Estimate gas for swap
   */
  public async estimateGas(params: {
    fromToken: Address
    toToken: Address
    amount: bigint
    userAddress: Address
    chainId: number
  }): Promise<bigint> {
    try {
      // Use 1inch API to estimate gas
      // For demo, return estimated values
      const baseGas = 200000n // Base gas for swap
      const tokenGas = params.fromToken === '0x0000000000000000000000000000000000000000' ? 0n : 50000n
      
      return baseGas + tokenGas
    } catch (error) {
      console.error('❌ Failed to estimate gas:', error)
      return 300000n // Fallback gas estimate
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getContractAddress(chainId: number): string {
    const addresses = {
      1: '0x119c71d3bbac22029622cbaec24854d3d32d2828', // Ethereum mainnet
      11155111: '0x119c71d3bbac22029622cbaec24854d3d32d2828', // Sepolia (placeholder)
      568: '0x0000000000000000000000000000000000000000', // DogeChain testnet
      31337: '0x0000000000000000000000000000000000000000' // Hardhat
    }
    
    return addresses[chainId as keyof typeof addresses] || addresses[1]
  }

  private getProviderUrl(chainId: number): string {
    const urls = {
      1: 'https://eth-mainnet.public.blastapi.io',
      11155111: 'https://sepolia.infura.io/v3/' + (process.env.VITE_INFURA_KEY || ''),
      568: 'https://rpc-testnet.dogechain.dog',
      31337: 'http://127.0.0.1:8545'
    }
    
    return urls[chainId as keyof typeof urls] || urls[1]
  }

  private getWeb3Provider(chainId: number) {
    // This would return a proper Web3 provider
    // For now, return a mock provider
    return {
      request: async (params: any) => {
        console.log('Mock provider request:', params)
        return null
      }
    }
  }

  private isTestnet(chainId: number): boolean {
    return [11155111, 568, 31337].includes(chainId)
  }

  private parseRoute(quote: any): any[] {
    // Parse the route from SDK response
    // This is simplified for demo
    return []
  }

  private mapOrderStatus(sdkStatus: SDKOrderStatus): OrderStatus {
    const statusMap = {
      [SDKOrderStatus.Created]: OrderStatus.PENDING,
      [SDKOrderStatus.Pending]: OrderStatus.PENDING,
      [SDKOrderStatus.Processing]: OrderStatus.EXECUTING,
      [SDKOrderStatus.Executed]: OrderStatus.COMPLETED,
      [SDKOrderStatus.Cancelled]: OrderStatus.CANCELLED,
      [SDKOrderStatus.Expired]: OrderStatus.EXPIRED,
      [SDKOrderStatus.Failed]: OrderStatus.FAILED
    }

    return statusMap[sdkStatus] || OrderStatus.PENDING
  }

  private transformSDKOrder(sdkOrder: OrderInfoData): OrderInfo {
    // Transform SDK order to our format
    return {
      id: sdkOrder.orderHash,
      maker: sdkOrder.order.maker as Address,
      fromToken: {
        address: sdkOrder.order.makerAsset as Address,
        symbol: 'TOKEN',
        name: 'Token',
        decimals: 18,
        isNative: false
      },
      toToken: {
        address: sdkOrder.order.takerAsset as Address,
        symbol: 'TOKEN',
        name: 'Token',
        decimals: 18,
        isNative: false
      },
      fromAmount: BigInt(sdkOrder.order.makerAmount),
      toAmount: BigInt(sdkOrder.order.takerAmount),
      fromChain: { id: 1 } as ChainInfo,
      toChain: { id: 1 } as ChainInfo,
      status: this.mapOrderStatus(sdkOrder.status),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000) // 24 hours
    }
  }

  private getDefaultTokens(chainId: number): TokenInfo[] {
    const tokens = {
      1: [ // Ethereum mainnet
        {
          address: '0x0000000000000000000000000000000000000000' as Address,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          isNative: true,
          logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
        },
        {
          address: '0xa0b86a33e6989c25e0d65b6b59d70e0f8f0f8f0f' as Address,
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          isNative: false,
          logoURI: 'https://tokens.1inch.io/0xa0b86a33e6989c25e0d65b6b59d70e0f8f0f8f0f.png'
        }
      ],
      11155111: [ // Ethereum Sepolia
        {
          address: '0x0000000000000000000000000000000000000000' as Address,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          isNative: true
        }
      ],
      568: [ // DogeChain testnet
        {
          address: '0x0000000000000000000000000000000000000000' as Address,
          symbol: 'DOGE',
          name: 'Dogecoin',
          decimals: 18,
          isNative: true
        }
      ],
      31337: [ // Hardhat
        {
          address: '0x0000000000000000000000000000000000000000' as Address,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          isNative: true
        }
      ]
    }

    return tokens[chainId as keyof typeof tokens] || tokens[1]
  }
}

// Export singleton instance
export const oneInchService = new OneInchService()