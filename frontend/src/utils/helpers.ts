import { Address, formatEther, parseEther, formatUnits, parseUnits } from 'viem'
import { TokenInfo, ChainInfo, OrderStatus, SwapErrorType } from '../types/indexs'

// Format utilities
export const formatTokenAmount = (amount: bigint, decimals: number, displayDecimals: number = 4): string => {
  const formatted = formatUnits(amount, decimals)
  const num = parseFloat(formatted)
  
  if (num === 0) return '0'
  if (num < 0.0001) return '< 0.0001'
  if (num < 1) return num.toFixed(displayDecimals)
  if (num < 1000) return num.toFixed(Math.min(displayDecimals, 2))
  if (num < 1000000) return (num / 1000).toFixed(1) + 'K'
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M'
  return (num / 1000000000).toFixed(1) + 'B'
}

export const parseTokenAmount = (amount: string, decimals: number): bigint => {
  try {
    return parseUnits(amount, decimals)
  } catch (error) {
    return 0n
  }
}

export const formatUSD = (amount: number): string => {
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return '< $0.01'
  if (amount < 1000) return `$${amount.toFixed(2)}`
  if (amount < 1000000) return `$${(amount / 1000).toFixed(1)}K`
  if (amount < 1000000000) return `$${(amount / 1000000).toFixed(1)}M`
  return `$${(amount / 1000000000).toFixed(1)}B`
}

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`
}

export const formatAddress = (address: Address, chars: number = 4): string => {
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`
}

export const formatTxHash = (hash: string, chars: number = 6): string => {
  return `${hash.slice(0, 2 + chars)}...${hash.slice(-chars)}`
}

// Time utilities
export const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

export const formatTimeRemaining = (expiresAt: Date): string => {
  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  
  if (diffMs <= 0) return 'Expired'
  
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h remaining`
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m remaining`
  if (diffMins > 0) return `${diffMins}m remaining`
  return '< 1m remaining'
}

// Validation utilities
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export const isValidAmount = (amount: string): boolean => {
  if (!amount || amount === '') return false
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0 && isFinite(num)
}

export const isValidSlippage = (slippage: number): boolean => {
  return slippage >= 0.1 && slippage <= 50
}

export const validateSwapAmount = (
  amount: string,
  balance: bigint,
  token: TokenInfo
): { isValid: boolean; error?: string } => {
  if (!isValidAmount(amount)) {
    return { isValid: false, error: 'Invalid amount' }
  }

  const amountBigInt = parseTokenAmount(amount, token.decimals)
  
  if (amountBigInt <= 0n) {
    return { isValid: false, error: 'Amount must be greater than 0' }
  }

  if (amountBigInt > balance) {
    return { isValid: false, error: 'Insufficient balance' }
  }

  return { isValid: true }
}

// Price calculation utilities
export const calculatePriceImpact = (
  inputAmount: bigint,
  outputAmount: bigint,
  inputPrice: number,
  outputPrice: number,
  inputDecimals: number,
  outputDecimals: number
): number => {
  const inputValue = Number(formatUnits(inputAmount, inputDecimals)) * inputPrice
  const outputValue = Number(formatUnits(outputAmount, outputDecimals)) * outputPrice
  
  if (inputValue === 0) return 0
  
  const impact = ((inputValue - outputValue) / inputValue) * 100
  return Math.max(0, impact)
}

export const calculateExchangeRate = (
  fromAmount: bigint,
  toAmount: bigint,
  fromDecimals: number,
  toDecimals: number
): number => {
  if (fromAmount === 0n) return 0
  
  const from = Number(formatUnits(fromAmount, fromDecimals))
  const to = Number(formatUnits(toAmount, toDecimals))
  
  return to / from
}

export const calculateMinimumReceived = (
  amount: bigint,
  slippageTolerance: number,
  decimals: number
): bigint => {
  const slippageMultiplier = (100 - slippageTolerance) / 100
  const amountNumber = Number(formatUnits(amount, decimals))
  const minimumAmount = amountNumber * slippageMultiplier
  return parseUnits(minimumAmount.toString(), decimals)
}

// Gas utilities
export const formatGasPrice = (gasPrice: bigint): string => {
  const gwei = Number(formatUnits(gasPrice, 9))
  return `${gwei.toFixed(1)} Gwei`
}

export const calculateGasCost = (gasUsed: bigint, gasPrice: bigint): bigint => {
  return gasUsed * gasPrice
}

export const formatGasCost = (gasCost: bigint): string => {
  const eth = formatEther(gasCost)
  const num = parseFloat(eth)
  
  if (num < 0.001) return `${(num * 1000).toFixed(2)} mETH`
  return `${num.toFixed(4)} ETH`
}

// Token utilities
export const getTokenDisplayName = (token: TokenInfo): string => {
  return token.name || token.symbol
}

export const getTokenLogoUrl = (token: TokenInfo): string => {
  if (token.logoURI) return token.logoURI
  
  // Fallback logos for common tokens
  const fallbackLogos: Record<string, string> = {
    'ETH': 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
    'WETH': 'https://tokens.1inch.io/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png',
    'USDC': 'https://tokens.1inch.io/0xa0b86a33e6989c25e0d65b6b59d70e0f8f0f8f0f.png',
    'USDT': 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png',
    'DOGE': 'https://cryptologos.cc/logos/dogecoin-doge-logo.png',
  }
  
  return fallbackLogos[token.symbol] || ''
}

export const sortTokensByBalance = (tokens: TokenInfo[]): TokenInfo[] => {
  return [...tokens].sort((a, b) => {
    // Native tokens first
    if (a.isNative && !b.isNative) return -1
    if (!a.isNative && b.isNative) return 1
    
    // Then by balance (if available)
    if (a.balance && b.balance) {
      if (a.balance > b.balance) return -1
      if (a.balance < b.balance) return 1
    }
    
    // Finally by symbol
    return a.symbol.localeCompare(b.symbol)
  })
}

// Chain utilities
export const getChainDisplayName = (chain: ChainInfo): string => {
  return chain.name
}

export const getChainLogoUrl = (chainId: number): string => {
  const logos: Record<number, string> = {
    1: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    11155111: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    2000: 'https://dogechain.dog/favicon.ico',
    568: 'https://dogechain.dog/favicon.ico',
  }
  
  return logos[chainId] || ''
}

export const getExplorerUrl = (chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string => {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    2000: 'https://explorer.dogechain.dog',
    568: 'https://explorer-testnet.dogechain.dog',
  }
  
  const baseUrl = explorers[chainId]
  if (!baseUrl) return ''
  
  return `${baseUrl}/${type}/${hash}`
}

// Order utilities
export const getOrderStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case OrderStatus.PENDING:
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case OrderStatus.MATCHING:
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case OrderStatus.MATCHED:
      return 'text-purple-600 bg-purple-50 border-purple-200'
    case OrderStatus.EXECUTING:
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case OrderStatus.COMPLETED:
      return 'text-green-600 bg-green-50 border-green-200'
    case OrderStatus.CANCELLED:
      return 'text-gray-600 bg-gray-50 border-gray-200'
    case OrderStatus.EXPIRED:
      return 'text-red-600 bg-red-50 border-red-200'
    case OrderStatus.FAILED:
      return 'text-red-700 bg-red-50 border-red-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export const getOrderProgressPercentage = (status: OrderStatus): number => {
  switch (status) {
    case OrderStatus.PENDING:
      return 20
    case OrderStatus.MATCHING:
      return 40
    case OrderStatus.MATCHED:
      return 60
    case OrderStatus.EXECUTING:
      return 80
    case OrderStatus.COMPLETED:
      return 100
    default:
      return 0
  }
}

// Error utilities
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.reason) return error.reason
  if (error?.shortMessage) return error.shortMessage
  return 'An unknown error occurred'
}

export const getSwapErrorType = (error: any): SwapErrorType => {
  const message = getErrorMessage(error).toLowerCase()
  
  if (message.includes('insufficient balance')) return SwapErrorType.INSUFFICIENT_BALANCE
  if (message.includes('insufficient allowance')) return SwapErrorType.INSUFFICIENT_ALLOWANCE
  if (message.includes('slippage')) return SwapErrorType.SLIPPAGE_TOO_HIGH
  if (message.includes('deadline')) return SwapErrorType.DEADLINE_EXCEEDED
  if (message.includes('user rejected') || message.includes('user denied')) return SwapErrorType.USER_REJECTED
  if (message.includes('network') || message.includes('connection')) return SwapErrorType.NETWORK_ERROR
  if (message.includes('timeout')) return SwapErrorType.TIMEOUT
  
  return SwapErrorType.UNKNOWN
}

// Storage utilities
export const saveToLocalStorage = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('Failed to save to localStorage:', error)
  }
}

export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.warn('Failed to load from localStorage:', error)
    return defaultValue
  }
}

export const removeFromLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error)
  }
}

// URL utilities
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error)
    return false
  }
}

export const openInNewTab = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Debug utilities
export const debugLog = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data)
  }
}

export const debugError = (message: string, error?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[DEBUG ERROR] ${message}`, error)
  }
}

// Math utilities
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export const roundToDecimals = (value: number, decimals: number): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export const calculateAPY = (principal: number, earned: number, days: number): number => {
  if (principal === 0 || days === 0) return 0
  const dailyRate = earned / principal / days
  return (Math.pow(1 + dailyRate, 365) - 1) * 100
}

// Network utilities
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const retry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      await delay(delayMs)
      return retry(fn, retries - 1, delayMs * 2) // Exponential backoff
    }
    throw error
  }
}

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void => {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void => {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}