import React, { useState, useEffect, useCallback } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { Address } from 'viem'
import { oneInchService } from '../services/oneInchService'
import { TokenInfo, ChainInfo, CrossChainQuote, OrderInfo, OrderStatus } from '../types/indexs'

interface QuoteParams {
  fromToken: TokenInfo
  toToken: TokenInfo
  amount: bigint
  fromChain: ChainInfo
  toChain: ChainInfo
  userAddress: Address
}

interface CreateOrderParams {
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: bigint
  toAmount: bigint
  deadline: number
  chainId: number
}

export const use1inchSDK = () => {
  const { address } = useAccount()
  const chainId = useChainId()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportedTokens, setSupportedTokens] = useState<TokenInfo[]>([])
  const [userOrders, setUserOrders] = useState<OrderInfo[]>([])

  // Initialize SDK when chain changes
  useEffect(() => {
    if (chainId) {
      oneInchService.switchChain(chainId)
      loadSupportedTokens()
    }
  }, [chainId])

  // Load user orders when address changes
  useEffect(() => {
    if (address) {
      loadUserOrders()
    } else {
      setUserOrders([])
    }
  }, [address])

  const loadSupportedTokens = useCallback(async () => {
    try {
      const tokens = await oneInchService.getSupportedTokens(chainId)
      setSupportedTokens(tokens)
    } catch (err: any) {
      console.error('Failed to load supported tokens:', err)
      setError(err.message)
    }
  }, [chainId])

  const loadUserOrders = useCallback(async () => {
    if (!address) return

    try {
      const orders = await oneInchService.getUserOrders(address)
      setUserOrders(orders)
    } catch (err: any) {
      console.error('Failed to load user orders:', err)
      setError(err.message)
    }
  }, [address])

  const getCrossChainQuote = useCallback(async (params: QuoteParams): Promise<CrossChainQuote> => {
    setIsLoading(true)
    setError(null)

    try {
      const quote = await oneInchService.getCrossChainQuote(params)
      return quote
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get quote'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createLimitOrder = useCallback(async (params: CreateOrderParams) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const orderData = await oneInchService.createLimitOrder({
        maker: address,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        toAmount: params.toAmount,
        deadline: params.deadline,
        chainId: params.chainId,
      })

      return orderData
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create limit order'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address])

  const submitFusionOrder = useCallback(async (order: any, signature: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const orderHash = await oneInchService.submitFusionOrder({
        order,
        signature,
        chainId,
      })

      // Refresh user orders
      await loadUserOrders()

      return orderHash
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit Fusion order'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [chainId, loadUserOrders])

  const getOrderStatus = useCallback(async (orderHash: string): Promise<OrderStatus> => {
    try {
      return await oneInchService.getOrderStatus(orderHash)
    } catch (err: any) {
      console.error('Failed to get order status:', err)
      return OrderStatus.FAILED
    }
  }, [])

  const getTokenPrice = useCallback(async (tokenAddress: Address): Promise<number> => {
    try {
      return await oneInchService.getTokenPrice(tokenAddress, chainId)
    } catch (err: any) {
      console.error('Failed to get token price:', err)
      return 0
    }
  }, [chainId])

  const estimateGas = useCallback(async (params: {
    fromToken: Address
    toToken: Address
    amount: bigint
    userAddress: Address
  }): Promise<bigint> => {
    try {
      return await oneInchService.estimateGas({
        ...params,
        chainId,
      })
    } catch (err: any) {
      console.error('Failed to estimate gas:', err)
      return 300000n // Fallback gas estimate
    }
  }, [chainId])

  // Token utilities
  const findTokenBySymbol = useCallback((symbol: string): TokenInfo | undefined => {
    return supportedTokens.find(token => 
      token.symbol.toLowerCase() === symbol.toLowerCase()
    )
  }, [supportedTokens])

  const findTokenByAddress = useCallback((address: Address): TokenInfo | undefined => {
    return supportedTokens.find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    )
  }, [supportedTokens])

  const getTokensByChain = useCallback((chainId: number): TokenInfo[] => {
    // In a real implementation, this would filter tokens by chain
    // For now, we'll return all supported tokens
    return supportedTokens
  }, [supportedTokens])

  // Order utilities
  const getOrderById = useCallback((orderId: string): OrderInfo | undefined => {
    return userOrders.find(order => order.id === orderId)
  }, [userOrders])

  const getOrdersByStatus = useCallback((status: OrderStatus): OrderInfo[] => {
    return userOrders.filter(order => order.status === status)
  }, [userOrders])

  const getActiveOrders = useCallback((): OrderInfo[] => {
    return userOrders.filter(order => 
      [OrderStatus.PENDING, OrderStatus.MATCHING, OrderStatus.MATCHED, OrderStatus.EXECUTING].includes(order.status)
    )
  }, [userOrders])

  const getCompletedOrders = useCallback((): OrderInfo[] => {
    return userOrders.filter(order => order.status === OrderStatus.COMPLETED)
  }, [userOrders])

  // Statistics
  const getOrderStats = useCallback(() => {
    const total = userOrders.length
    const active = getActiveOrders().length
    const completed = getCompletedOrders().length
    const cancelled = userOrders.filter(order => 
      [OrderStatus.CANCELLED, OrderStatus.EXPIRED, OrderStatus.FAILED].includes(order.status)
    ).length

    return {
      total,
      active,
      completed,
      cancelled,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }, [userOrders, getActiveOrders, getCompletedOrders])

  const getTotalVolume = useCallback((): { volume: bigint; valueUSD: number } => {
    let volume = 0n
    let valueUSD = 0

    userOrders.forEach(order => {
      if (order.status === OrderStatus.COMPLETED) {
        volume += order.fromAmount
        // Simplified USD calculation - in production, use real price feeds
        const tokenPrice = order.fromToken.symbol === 'ETH' ? 2000 : 
                          order.fromToken.symbol === 'DOGE' ? 0.08 : 1
        valueUSD += Number(order.fromAmount) / (10 ** order.fromToken.decimals) * tokenPrice
      }
    })

    return { volume, valueUSD }
  }, [userOrders])

  return {
    // State
    isLoading,
    error,
    supportedTokens,
    userOrders,

    // Core methods
    getCrossChainQuote,
    createLimitOrder,
    submitFusionOrder,
    getOrderStatus,
    getTokenPrice,
    estimateGas,

    // Token utilities
    findTokenBySymbol,
    findTokenByAddress,
    getTokensByChain,

    // Order utilities
    getOrderById,
    getOrdersByStatus,
    getActiveOrders,
    getCompletedOrders,

    // Statistics
    getOrderStats,
    getTotalVolume,

    // Data refresh
    loadSupportedTokens,
    loadUserOrders,
    clearError: () => setError(null),
  }
}

// Hook for real-time order tracking
export const useOrderTracking = (orderIds: string[]) => {
  const [orderStatuses, setOrderStatuses] = useState<Record<string, OrderStatus>>({})
  const [isTracking, setIsTracking] = useState(false)
  const { getOrderStatus } = use1inchSDK()

  const startTracking = useCallback(() => {
    if (orderIds.length === 0) return

    setIsTracking(true)

    const trackOrders = async () => {
      const statusPromises = orderIds.map(async (orderId) => {
        try {
          const status = await getOrderStatus(orderId)
          return [orderId, status] as const
        } catch (err) {
          return [orderId, OrderStatus.FAILED] as const
        }
      })

      const results = await Promise.all(statusPromises)
      const statusMap = Object.fromEntries(results)
      setOrderStatuses(statusMap)
    }

    // Track immediately
    trackOrders()

    // Set up polling interval
    const interval = setInterval(trackOrders, 30000) // 30 seconds

    return () => {
      clearInterval(interval)
      setIsTracking(false)
    }
  }, [orderIds, getOrderStatus])

  const stopTracking = useCallback(() => {
    setIsTracking(false)
  }, [])

  useEffect(() => {
    const cleanup = startTracking()
    return cleanup
  }, [startTracking])

  return {
    orderStatuses,
    isTracking,
    startTracking,
    stopTracking,
  }
}

// Hook for token price tracking
export const useTokenPrices = (tokenAddresses: Address[]) => {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getTokenPrice } = use1inchSDK()

  const fetchPrices = useCallback(async () => {
    if (tokenAddresses.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const pricePromises = tokenAddresses.map(async (address) => {
        try {
          const price = await getTokenPrice(address)
          return [address, price] as const
        } catch (err) {
          return [address, 0] as const
        }
      })

      const results = await Promise.all(pricePromises)
      const priceMap = Object.fromEntries(results)
      setPrices(priceMap)

    } catch (err: any) {
      setError(err.message || 'Failed to fetch token prices')
    } finally {
      setIsLoading(false)
    }
  }, [tokenAddresses, getTokenPrice])

  useEffect(() => {
    fetchPrices()

    // Set up price refresh interval (5 minutes)
    const interval = setInterval(fetchPrices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  return {
    prices,
    isLoading,
    error,
    refetch: fetchPrices,
  }
}