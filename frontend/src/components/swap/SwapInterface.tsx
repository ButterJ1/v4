import React, { useState, useEffect, useMemo } from 'react'
import { useAccount, useChainId, useSwitchChain, useBalance } from 'wagmi'
import { parseEther, formatEther, Address } from 'viem'
import { toast } from 'react-hot-toast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { getChainConfig, getDefaultTokens, isSupportedChain } from '../../config/wagmi'
import { TokenInfo, SwapFormData, OrderStatus } from '../../types/indexs'
import { useCrossChainSwap } from '../../hooks/useCrossChainSwap'

export const SwapInterface: React.FC = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { initializeSwap, getQuote, isLoading, error } = useCrossChainSwap()

  // Form state
  const [formData, setFormData] = useState<SwapFormData>({
    fromToken: getDefaultTokens(chainId)[0] || {} as TokenInfo,
    toToken: {} as TokenInfo,
    fromAmount: '',
    toAmount: '',
    fromChain: { id: chainId } as any,
    toChain: {} as any,
    slippage: 0.5,
    deadline: 20, // 20 minutes
  })

  // UI state
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapStep, setSwapStep] = useState(0)
  const [estimatedGas, setEstimatedGas] = useState<bigint>(0n)

  // Get user balance for selected token
  const { data: balance } = useBalance({
    address,
    token: formData.fromToken.isNative ? undefined : formData.fromToken.address,
  })

  // Available tokens for current chain
  const availableTokens = useMemo(() => {
    return getDefaultTokens(chainId)
  }, [chainId])

  // Available destination chains
  const availableChains = useMemo(() => {
    const chains = [
      { id: 11155111, name: 'Ethereum Sepolia', symbol: 'ETH' },
      { id: 568, name: 'DogeChain Testnet', symbol: 'DOGE' },
    ]
    return chains.filter(chain => chain.id !== chainId)
  }, [chainId])

  // Update form when chain changes
  useEffect(() => {
    const defaultToken = getDefaultTokens(chainId)[0]
    if (defaultToken) {
      setFormData(prev => ({
        ...prev,
        fromToken: defaultToken,
        fromChain: { id: chainId, name: getChainConfig(chainId).name } as any
      }))
    }
  }, [chainId])

  // Get quote when amounts change
  useEffect(() => {
    if (formData.fromAmount && formData.toToken.address && formData.toChain.id) {
      const debounceTimer = setTimeout(async () => {
        try {
          const quote = await getQuote({
            fromToken: formData.fromToken,
            toToken: formData.toToken,
            amount: parseEther(formData.fromAmount),
            fromChain: formData.fromChain,
            toChain: formData.toChain,
            userAddress: address!,
          })
          
          setFormData(prev => ({
            ...prev,
            toAmount: formatEther(quote.toAmount)
          }))
          
          setEstimatedGas(quote.fees.gas)
        } catch (error) {
          console.error('Failed to get quote:', error)
        }
      }, 500)

      return () => clearTimeout(debounceTimer)
    }
  }, [formData.fromAmount, formData.toToken, formData.toChain, address, getQuote])

  const handleTokenSelect = (token: TokenInfo, type: 'from' | 'to') => {
    setFormData(prev => ({
      ...prev,
      [type === 'from' ? 'fromToken' : 'toToken']: token
    }))
    setShowTokenSelector(null)
  }

  const handleChainSelect = (chain: any) => {
    const defaultToken = getDefaultTokens(chain.id)[0]
    setFormData(prev => ({
      ...prev,
      toChain: chain,
      toToken: defaultToken || {} as TokenInfo
    }))
  }

  const handleAmountChange = (value: string, type: 'from' | 'to') => {
    setFormData(prev => ({
      ...prev,
      [type === 'from' ? 'fromAmount' : 'toAmount']: value
    }))
  }

  const handleSwapTokens = () => {
    if (!formData.toChain.id) return
    
    setFormData(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      fromChain: prev.toChain,
      toChain: prev.fromChain,
      fromAmount: prev.toAmount,
      toAmount: prev.fromAmount,
    }))
  }

  const handleSwap = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    if (!isSupportedChain(chainId)) {
      toast.error('Please switch to a supported network')
      return
    }

    if (!formData.fromAmount || !formData.toAmount) {
      toast.error('Please enter swap amounts')
      return
    }

    if (balance && parseEther(formData.fromAmount) > (balance.value || 0n)) {
      toast.error('Insufficient balance')
      return
    }

    setIsSwapping(true)
    setSwapStep(1)

    try {
      // Step 1: Create cross-chain order
      toast.loading('Creating cross-chain order...', { id: 'swap' })
      
      const result = await initializeSwap({
        fromToken: formData.fromToken,
        toToken: formData.toToken,
        fromAmount: parseEther(formData.fromAmount),
        toAmount: parseEther(formData.toAmount),
        fromChain: formData.fromChain,
        toChain: formData.toChain,
        deadline: Math.floor(Date.now() / 1000) + (formData.deadline * 60),
        userAddress: address!,
      })

      setSwapStep(2)
      toast.loading('Waiting for order matching...', { id: 'swap' })

      // In a real implementation, we would listen for order matching events
      // For now, we'll simulate the process
      setTimeout(() => {
        setSwapStep(3)
        toast.loading('Executing cross-chain swap...', { id: 'swap' })
        
        setTimeout(() => {
          setSwapStep(4)
          toast.success('Cross-chain swap completed!', { id: 'swap' })
          
          // Reset form
          setFormData(prev => ({
            ...prev,
            fromAmount: '',
            toAmount: '',
          }))
          
          setIsSwapping(false)
          setSwapStep(0)
        }, 3000)
      }, 2000)

    } catch (error: any) {
      console.error('Swap failed:', error)
      toast.error(error.message || 'Swap failed', { id: 'swap' })
      setIsSwapping(false)
      setSwapStep(0)
    }
  }

  const isFormValid = () => {
    return (
      isConnected &&
      formData.fromAmount &&
      formData.toAmount &&
      formData.fromToken.address &&
      formData.toToken.address &&
      formData.toChain.id &&
      !isLoading &&
      !isSwapping
    )
  }

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Connect Wallet to Start Swapping
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your wallet to begin cross-chain atomic swaps
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Swap Progress */}
      {isSwapping && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Swap Progress
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-300">
              Step {swapStep} of 4
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${(swapStep / 4) * 100}%` }}
            />
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-300 mt-2">
            {swapStep === 1 && 'Creating order...'}
            {swapStep === 2 && 'Waiting for matching...'}
            {swapStep === 3 && 'Executing swap...'}
            {swapStep === 4 && 'Completed!'}
          </div>
        </div>
      )}

      {/* From Token Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            From
          </label>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Balance: {balance ? `${Number(formatEther(balance.value)).toFixed(4)} ${formData.fromToken.symbol}` : '0.0000'}
          </div>
        </div>
        
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={formData.fromAmount}
            onChange={(e) => handleAmountChange(e.target.value, 'from')}
            className="pr-32 text-lg font-medium"
            disabled={isSwapping}
          />
          
          <button
            onClick={() => setShowTokenSelector('from')}
            className="absolute right-2 top-2 flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={isSwapping}
          >
            <span className="text-sm font-medium">{formData.fromToken.symbol || 'Select'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Network: {getChainConfig(chainId).name}
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSwapTokens}
          className="p-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          disabled={isSwapping || !formData.toChain.id}
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* To Token Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          To
        </label>
        
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={formData.toAmount}
            onChange={(e) => handleAmountChange(e.target.value, 'to')}
            className="pr-32 text-lg font-medium"
            disabled={true} // Always disabled for estimated output
          />
          
          <button
            onClick={() => setShowTokenSelector('to')}
            className="absolute right-2 top-2 flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={isSwapping}
          >
            <span className="text-sm font-medium">{formData.toToken.symbol || 'Select'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Destination Chain Selector */}
        <div className="flex flex-wrap gap-2">
          {availableChains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => handleChainSelect(chain)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                formData.toChain.id === chain.id
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              disabled={isSwapping}
            >
              {chain.name}
            </button>
          ))}
        </div>
      </div>

      {/* Swap Details */}
      {formData.fromAmount && formData.toAmount && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
            <span className="font-medium">
              1 {formData.fromToken.symbol} ≈ {
                formData.toAmount && formData.fromAmount 
                  ? (Number(formData.toAmount) / Number(formData.fromAmount)).toFixed(4)
                  : '0.0000'
              } {formData.toToken.symbol}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Estimated Gas</span>
            <span className="font-medium">
              {formatEther(estimatedGas)} ETH
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Slippage Tolerance</span>
            <span className="font-medium">{formData.slippage}%</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Deadline</span>
            <span className="font-medium">{formData.deadline} minutes</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!isFormValid()}
        className="w-full btn-gradient text-lg font-semibold py-4"
        isLoading={isSwapping || isLoading}
      >
        {isSwapping ? 'Swapping...' : 'Swap'}
      </Button>

      {/* Token Selector Modal */}
      <Modal
        isOpen={showTokenSelector !== null}
        onClose={() => setShowTokenSelector(null)}
        title={`Select ${showTokenSelector === 'from' ? 'Source' : 'Destination'} Token`}
      >
        <div className="space-y-2">
          {availableTokens.map((token) => (
            <button
              key={token.address}
              onClick={() => handleTokenSelect(token, showTokenSelector!)}
              className="w-full flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {token.symbol[0]}
                </span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">{token.symbol}</div>
                <div className="text-sm text-gray-500">{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}