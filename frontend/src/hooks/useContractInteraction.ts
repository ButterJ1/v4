import React, { useState, useCallback } from 'react'
import { useAccount, useChainId, useWalletClient, usePublicClient } from 'wagmi'
import { Address, Hash, parseEther, formatEther } from 'viem'
import { contractService } from '../services/contractService'
import { HTLCContract, TransactionStatus, TokenInfo } from '../types/indexs'
import { getContractAddress } from '../utils/contractAddresses'

interface CreateHTLCParams {
  recipient: Address
  token: TokenInfo
  amount: bigint
  hashlock: `0x${string}`
  timelock: number
  counterpartId?: `0x${string}`
}

interface TokenBalanceParams {
  tokenAddress: Address
  userAddress?: Address
}

export const useContractInteraction = () => {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastTransaction, setLastTransaction] = useState<Hash | null>(null)

  // Set up contract service when wallet client is available
  React.useEffect(() => {
    if (walletClient && chainId) {
      contractService.setWalletClient(chainId, walletClient)
    }
  }, [walletClient, chainId])

  // HTLC Operations
  const createHTLC = useCallback(async (params: CreateHTLCParams): Promise<{
    hash: Hash
    contractId: `0x${string}`
  }> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const timelock = BigInt(Math.floor(Date.now() / 1000) + params.timelock)
      
      const result = await contractService.createHTLC({
        chainId,
        recipient: params.recipient,
        token: params.token.address,
        amount: params.amount,
        hashlock: params.hashlock,
        timelock,
        counterpartId: params.counterpartId || ('0x' + '0'.repeat(64)) as `0x${string}`,
        userAddress: address,
      })

      setLastTransaction(result.hash)
      return result

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create HTLC'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId])

  const withdrawHTLC = useCallback(async (
    contractId: `0x${string}`,
    preimage: `0x${string}`
  ): Promise<Hash> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const hash = await contractService.withdrawHTLC({
        chainId,
        contractId,
        preimage,
        userAddress: address,
      })

      setLastTransaction(hash)
      return hash

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to withdraw from HTLC'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId])

  const refundHTLC = useCallback(async (contractId: `0x${string}`): Promise<Hash> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const hash = await contractService.refundHTLC({
        chainId,
        contractId,
        userAddress: address,
      })

      setLastTransaction(hash)
      return hash

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to refund HTLC'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId])

  const getHTLC = useCallback(async (contractId: `0x${string}`): Promise<HTLCContract> => {
    try {
      return await contractService.getHTLC({
        chainId,
        contractId,
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get HTLC details'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [chainId])

  // Token Operations
  const getTokenBalance = useCallback(async (params: TokenBalanceParams): Promise<bigint> => {
    const userAddress = params.userAddress || address
    if (!userAddress) {
      throw new Error('No user address provided')
    }

    try {
      return await contractService.getTokenBalance({
        chainId,
        tokenAddress: params.tokenAddress,
        userAddress,
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get token balance'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [address, chainId])

  const approveToken = useCallback(async (
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint
  ): Promise<Hash> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const hash = await contractService.approveToken({
        chainId,
        tokenAddress,
        spenderAddress,
        amount,
        userAddress: address,
      })

      setLastTransaction(hash)
      return hash

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to approve token'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId])

  const getTokenAllowance = useCallback(async (
    tokenAddress: Address,
    spenderAddress: Address,
    ownerAddress?: Address
  ): Promise<bigint> => {
    const owner = ownerAddress || address
    if (!owner) {
      throw new Error('No owner address provided')
    }

    try {
      return await contractService.getTokenAllowance({
        chainId,
        tokenAddress,
        ownerAddress: owner,
        spenderAddress,
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get token allowance'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [address, chainId])

  const useFaucet = useCallback(async (tokenAddress: Address): Promise<Hash> => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const hash = await contractService.useFaucet({
        chainId,
        tokenAddress,
        userAddress: address,
      })

      setLastTransaction(hash)
      return hash

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to use faucet'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, chainId])

  // Transaction utilities
  const waitForTransaction = useCallback(async (
    hash: Hash,
    confirmations: number = 1
  ): Promise<TransactionStatus> => {
    try {
      return await contractService.waitForTransaction({
        chainId,
        hash,
        confirmations,
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to wait for transaction'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [chainId])

  const estimateGas = useCallback(async (
    to: Address,
    data: `0x${string}`,
    value: bigint = 0n
  ): Promise<bigint> => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    try {
      return await contractService.estimateGas({
        chainId,
        to,
        data,
        value,
        userAddress: address,
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to estimate gas'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [address, chainId])

  const getGasPrice = useCallback(async (): Promise<bigint> => {
    try {
      return await contractService.getGasPrice(chainId)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get gas price'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [chainId])

  // Contract address helpers
  const getContractAddresses = useCallback(() => {
    try {
      return {
        htlc: getContractAddress(chainId, 'crossChainHTLC'),
        adapter: getContractAddress(chainId, 'fusionPlusAdapter'),
        bridge: getContractAddress(chainId, 'dogeChainBridge'),
        resolver: getContractAddress(chainId, 'mockResolver'),
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get contract addresses'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [chainId])

  // Utility functions
  const calculateContractId = useCallback(async (
    sender: Address,
    recipient: Address,
    token: Address,
    amount: bigint,
    hashlock: `0x${string}`,
    timelock: bigint
  ): Promise<`0x${string}`> => {
    try {
      // This would normally call the contract's calculateContractId function
      // For now, we'll create a simple hash
      const data = [sender, recipient, token, amount.toString(), hashlock, timelock.toString()].join('')
      const encoder = new TextEncoder()
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return `0x${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to calculate contract ID'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const formatTokenAmount = useCallback((amount: bigint, decimals: number): string => {
    return formatEther(amount * BigInt(10 ** (18 - decimals)))
  }, [])

  const parseTokenAmount = useCallback((amount: string, decimals: number): bigint => {
    return parseEther(amount) / BigInt(10 ** (18 - decimals))
  }, [])

  return {
    // State
    isLoading,
    error,
    lastTransaction,

    // HTLC Operations
    createHTLC,
    withdrawHTLC,
    refundHTLC,
    getHTLC,

    // Token Operations
    getTokenBalance,
    approveToken,
    getTokenAllowance,
    useFaucet,

    // Transaction utilities
    waitForTransaction,
    estimateGas,
    getGasPrice,

    // Contract utilities
    getContractAddresses,
    calculateContractId,

    // Formatting utilities
    formatTokenAmount,
    parseTokenAmount,

    // Error handling
    clearError: () => setError(null),
  }
}

// Hook for batch token balances
export const useTokenBalances = (tokens: TokenInfo[], userAddress?: Address) => {
  const { address } = useAccount()
  const { getTokenBalance } = useContractInteraction()
  const [balances, setBalances] = useState<Record<string, bigint>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetAddress = userAddress || address

  const fetchBalances = useCallback(async () => {
    if (!targetAddress || tokens.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const balancePromises = tokens.map(async (token) => {
        try {
          const balance = await getTokenBalance({
            tokenAddress: token.address,
            userAddress: targetAddress,
          })
          return [token.address, balance] as const
        } catch (err) {
          console.error(`Failed to get balance for ${token.symbol}:`, err)
          return [token.address, 0n] as const
        }
      })

      const results = await Promise.all(balancePromises)
      const balanceMap = Object.fromEntries(results)
      setBalances(balanceMap)

    } catch (err: any) {
      setError(err.message || 'Failed to fetch token balances')
    } finally {
      setIsLoading(false)
    }
  }, [targetAddress, tokens, getTokenBalance])

  React.useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  return {
    balances,
    isLoading,
    error,
    refetch: fetchBalances,
  }
}