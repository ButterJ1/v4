import React, { useState, useCallback } from 'react'
import { useAccount, useChainId, useWalletClient, usePublicClient } from 'wagmi'
import { Address, parseEther, formatEther } from 'viem'
import { TokenInfo, ChainInfo, CrossChainQuote, OrderInfo, OrderStatus } from '../types/indexs'
import { contractService } from '../services/contractService'
import { oneInchService } from '../services/oneInchService'
import { getContractAddress } from '../utils/contractAddresses'

interface SwapParams {
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  fromChain: ChainInfo
  toChain: ChainInfo
  deadline: number
  userAddress: Address
}

interface QuoteParams {
  fromToken: TokenInfo
  toToken: TokenInfo
  amount: bigint
  fromChain: ChainInfo
  toChain: ChainInfo
  userAddress: Address
}

export const useCrossChainSwap = () => {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentOrder, setCurrentOrder] = useState<OrderInfo | null>(null)

  // Set wallet client in contract service when available
  React.useEffect(() => {
    if (walletClient && chainId) {
      contractService.setWalletClient(chainId, walletClient)
    }
  }, [walletClient, chainId])

  const getQuote = useCallback(async (params: QuoteParams): Promise<CrossChainQuote> => {
    try {
      setError(null)

      // For demo purposes, we'll calculate a simple quote
      // In production, this would use 1inch API or other price feeds
      const mockQuote: CrossChainQuote = {
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.amount,
        toAmount: calculateMockExchangeRate(params.fromToken, params.toToken, params.amount),
        route: [], // Simplified for demo
        estimatedTime: 300, // 5 minutes
        fees: {
          protocol: params.amount / 1000n, // 0.1%
          bridge: params.amount / 2000n,   // 0.05%
          gas: parseEther('0.01'),         // ~$20 gas
          total: params.amount / 500n,     // ~0.2% total
        },
        priceImpact: 0.1, // 0.1%
      }

      return mockQuote
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get quote'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const initializeSwap = useCallback(async (params: SwapParams): Promise<{
    orderId: string
    htlcId: string
  }> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Step 1: Check token allowance if needed
      if (!params.fromToken.isNative) {
        const adapterAddress = getContractAddress(chainId, 'fusionPlusAdapter')
        const allowance = await contractService.getTokenAllowance({
          chainId,
          tokenAddress: params.fromToken.address,
          ownerAddress: address,
          spenderAddress: adapterAddress,
        })

        if (allowance < params.fromAmount) {
          // Approve token spending
          const approveTx = await contractService.approveToken({
            chainId,
            tokenAddress: params.fromToken.address,
            spenderAddress: adapterAddress,
            amount: params.fromAmount * 2n, // Approve 2x for future swaps
            userAddress: address,
          })

          // Wait for approval confirmation
          await contractService.waitForTransaction({
            chainId,
            hash: approveTx,
            confirmations: 1,
          })
        }
      }

      // Step 2: Generate hashlock for atomic swap
      const secret = generateSecret()
      const hashlock = generateHashlock(secret)

      // Step 3: Create cross-chain order
      const { hash: orderTx, orderId } = await contractService.createCrossChainOrder({
        chainId,
        srcToken: params.fromToken.address,
        dstToken: params.toToken.address,
        srcAmount: params.fromAmount,
        dstAmount: params.toAmount,
        dstChainId: params.toChain.id,
        hashlock,
        deadline: BigInt(params.deadline),
        taker: '0x0000000000000000000000000000000000000000' as Address, // Any taker
        userAddress: address,
      })

      // Wait for order creation confirmation
      const orderResult = await contractService.waitForTransaction({
        chainId,
        hash: orderTx,
        confirmations: 1,
      })

      if (orderResult.status !== 'confirmed') {
        throw new Error('Order creation failed')
      }

      // Step 4: Create order info for tracking
      const orderInfo: OrderInfo = {
        id: orderId,
        maker: address,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        toAmount: params.toAmount,
        fromChain: params.fromChain,
        toChain: params.toChain,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        expiresAt: new Date(params.deadline * 1000),
        txHash: orderTx,
      }

      setCurrentOrder(orderInfo)

      // Store secret for later use (in production, this would be handled more securely)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`secret_${orderId}`, secret)
      }

      return {
        orderId,
        htlcId: '', // Will be set when HTLC is created
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Swap initialization failed'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId])

  const takeOrder = useCallback(async (orderId: string): Promise<void> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Simulate resolver info (in production, this would come from resolver network)
      const resolverInfo = {
        resolver: address, // Self as resolver for demo
        fee: 25n, // 0.25%
        resolverData: '0x' as `0x${string}`,
        signature: '0x' as `0x${string}`,
      }

      const takeTx = await contractService.takeCrossChainOrder({
        chainId,
        orderId: orderId as `0x${string}`,
        resolverInfo,
        userAddress: address,
      })

      await contractService.waitForTransaction({
        chainId,
        hash: takeTx,
        confirmations: 1,
      })

      // Update order status
      if (currentOrder && currentOrder.id === orderId) {
        setCurrentOrder({
          ...currentOrder,
          status: OrderStatus.MATCHED,
        })
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to take order'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId, currentOrder])

  const completeSwap = useCallback(async (orderId: string): Promise<void> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Retrieve secret from storage (in production, this would be handled more securely)
      const secret = typeof window !== 'undefined' 
        ? sessionStorage.getItem(`secret_${orderId}`)
        : null

      if (!secret) {
        throw new Error('Secret not found')
      }

      const completeTx = await contractService.completeCrossChainOrder({
        chainId,
        orderId: orderId as `0x${string}`,
        preimage: secret as `0x${string}`,
        userAddress: address,
      })

      await contractService.waitForTransaction({
        chainId,
        hash: completeTx,
        confirmations: 1,
      })

      // Update order status
      if (currentOrder && currentOrder.id === orderId) {
        setCurrentOrder({
          ...currentOrder,
          status: OrderStatus.COMPLETED,
        })
      }

      // Clean up secret
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`secret_${orderId}`)
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to complete swap'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId, currentOrder])

  const cancelOrder = useCallback(async (orderId: string): Promise<void> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const cancelTx = await contractService.cancelCrossChainOrder({
        chainId,
        orderId: orderId as `0x${string}`,
        userAddress: address,
      })

      await contractService.waitForTransaction({
        chainId,
        hash: cancelTx,
        confirmations: 1,
      })

      // Update order status
      if (currentOrder && currentOrder.id === orderId) {
        setCurrentOrder({
          ...currentOrder,
          status: OrderStatus.CANCELLED,
        })
      }

      // Clean up secret
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`secret_${orderId}`)
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to cancel order'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId, currentOrder])

  const getOrderStatus = useCallback(async (orderId: string): Promise<OrderStatus> => {
    try {
      const order = await contractService.getCrossChainOrder({
        chainId,
        orderId: orderId as `0x${string}`,
      })

      // Map contract state to OrderStatus
      switch (order.state) {
        case 1: return OrderStatus.PENDING
        case 2: return OrderStatus.MATCHED
        case 3: return OrderStatus.COMPLETED
        case 4: return OrderStatus.CANCELLED
        case 5: return OrderStatus.EXPIRED
        default: return OrderStatus.FAILED
      }
    } catch (err) {
      return OrderStatus.FAILED
    }
  }, [chainId])

  return {
    // State
    isLoading,
    error,
    currentOrder,

    // Methods
    getQuote,
    initializeSwap,
    takeOrder,
    completeSwap,
    cancelOrder,
    getOrderStatus,

    // Utils
    clearError: () => setError(null),
    setCurrentOrder,
  }
}

// Helper functions
function calculateMockExchangeRate(fromToken: TokenInfo, toToken: TokenInfo, amount: bigint): bigint {
  // Mock exchange rates for demo
  const rates: Record<string, Record<string, number>> = {
    'ETH': {
      'DOGE': 2500, // 1 ETH = 2500 DOGE
      'USDC': 2000, // 1 ETH = 2000 USDC
    },
    'DOGE': {
      'ETH': 0.0004, // 1 DOGE = 0.0004 ETH
      'USDC': 0.8, // 1 DOGE = 0.8 USDC
    },
    'USDC': {
      'ETH': 0.0005, // 1 USDC = 0.0005 ETH
      'DOGE': 1.25, // 1 USDC = 1.25 DOGE
    },
  }

  const rate = rates[fromToken.symbol]?.[toToken.symbol] || 1
  const fromDecimals = BigInt(10 ** fromToken.decimals)
  const toDecimals = BigInt(10 ** toToken.decimals)
  
  // Convert amount to target token with proper decimals
  const rateScaled = BigInt(Math.floor(rate * 1000000)) // Scale rate by 1M for precision
  const converted = (amount * rateScaled * toDecimals) / (fromDecimals * 1000000n)
  
  return converted
}

function generateSecret(): `0x${string}` {
  // Generate a random 32-byte secret
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`
}

function generateHashlock(secret: string): `0x${string}` {
  // In a real implementation, this would use a proper crypto library
  // For demo purposes, we'll simulate with a simple hash
  const encoder = new TextEncoder()
  const data = encoder.encode(secret)
  
  return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return `0x${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
  }) as any // Simplified for demo
}