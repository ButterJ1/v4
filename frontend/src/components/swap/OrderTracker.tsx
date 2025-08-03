import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatEther, Address } from 'viem'
import { OrderInfo, OrderStatus } from '../../types/indexs'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

// Mock data for demonstration
const mockOrders: OrderInfo[] = [
  {
    id: '0x1234567890abcdef',
    maker: '0x742d35cc6ccf949b1d2d4d6e4f5e7c7e6f8e9f1a' as Address,
    fromToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      isNative: true,
    },
    toToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      symbol: 'DOGE',
      name: 'Dogecoin',
      decimals: 8,
      isNative: true,
    },
    fromAmount: BigInt('1000000000000000000'), // 1 ETH
    toAmount: BigInt('250000000000'), // 2500 DOGE
    fromChain: { id: 11155111, name: 'Ethereum Sepolia' } as any,
    toChain: { id: 568, name: 'DogeChain Testnet' } as any,
    status: OrderStatus.EXECUTING,
    createdAt: new Date(Date.now() - 300000), // 5 minutes ago
    expiresAt: new Date(Date.now() + 3300000), // 55 minutes from now
    txHash: '0xabcdef1234567890',
    htlcIds: {
      source: '0xsource123',
      destination: '0xdest456',
    }
  },
  {
    id: '0xfedcba0987654321',
    maker: '0x742d35cc6ccf949b1d2d4d6e4f5e7c7e6f8e9f1a' as Address,
    fromToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      symbol: 'DOGE',
      name: 'Dogecoin',
      decimals: 8,
      isNative: true,
    },
    toToken: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      isNative: true,
    },
    fromAmount: BigInt('500000000000'), // 5000 DOGE
    toAmount: BigInt('2000000000000000000'), // 2 ETH
    fromChain: { id: 568, name: 'DogeChain Testnet' } as any,
    toChain: { id: 11155111, name: 'Ethereum Sepolia' } as any,
    status: OrderStatus.COMPLETED,
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    expiresAt: new Date(Date.now() - 1800000), // Expired 30 minutes ago
    txHash: '0x987654321abcdef0',
  }
]

export const OrderTracker: React.FC = () => {
  const { address, isConnected } = useAccount()
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')

  // Load orders on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      loadUserOrders()
    } else {
      setOrders([])
    }
  }, [isConnected, address])

  const loadUserOrders = async () => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Filter mock orders for the current user
      const userOrders = mockOrders.filter(order => 
        order.maker.toLowerCase() === address?.toLowerCase()
      )
      
      setOrders(userOrders)
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
      case OrderStatus.MATCHING:
        return <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
      case OrderStatus.MATCHED:
        return <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
      case OrderStatus.EXECUTING:
        return <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
      case OrderStatus.COMPLETED:
        return <div className="w-3 h-3 bg-green-500 rounded-full" />
      case OrderStatus.CANCELLED:
        return <div className="w-3 h-3 bg-gray-500 rounded-full" />
      case OrderStatus.EXPIRED:
        return <div className="w-3 h-3 bg-red-500 rounded-full" />
      case OrderStatus.FAILED:
        return <div className="w-3 h-3 bg-red-600 rounded-full" />
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />
    }
  }

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return 'Pending'
      case OrderStatus.MATCHING:
        return 'Matching'
      case OrderStatus.MATCHED:
        return 'Matched'
      case OrderStatus.EXECUTING:
        return 'Executing'
      case OrderStatus.COMPLETED:
        return 'Completed'
      case OrderStatus.CANCELLED:
        return 'Cancelled'
      case OrderStatus.EXPIRED:
        return 'Expired'
      case OrderStatus.FAILED:
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: OrderStatus) => {
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

  const getProgressPercentage = (status: OrderStatus) => {
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

  const filteredOrders = orders.filter(order => {
    switch (filter) {
      case 'active':
        return [OrderStatus.PENDING, OrderStatus.MATCHING, OrderStatus.MATCHED, OrderStatus.EXECUTING].includes(order.status)
      case 'completed':
        return order.status === OrderStatus.COMPLETED
      case 'cancelled':
        return [OrderStatus.CANCELLED, OrderStatus.EXPIRED, OrderStatus.FAILED].includes(order.status)
      default:
        return true
    }
  })

  const formatTimeAgo = (date: Date) => {
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

  const handleCancelOrder = async (orderId: string) => {
    try {
      // Simulate cancel order API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: OrderStatus.CANCELLED }
          : order
      ))
      
      setSelectedOrder(null)
    } catch (error) {
      console.error('Failed to cancel order:', error)
    }
  }

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect your wallet to view orders
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Your Orders
        </h3>
        <Button
          size="sm"
          onClick={loadUserOrders}
          isLoading={isLoading}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab.key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'No orders found' : `No ${filter} orders`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              {/* Order header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(order.status)}
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeAgo(order.createdAt)}
                  </span>
                </div>
                
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Order details */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Number(formatEther(order.fromAmount)).toFixed(4)} {order.fromToken.symbol}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Number(formatEther(order.toAmount)).toFixed(4)} {order.toToken.symbol}
                  </span>
                </div>
              </div>

              {/* Networks */}
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span>{order.fromChain.name}</span>
                <svg className="w-3 h-3 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span>{order.toChain.name}</span>
              </div>

              {/* Progress bar */}
              {[OrderStatus.PENDING, OrderStatus.MATCHING, OrderStatus.MATCHED, OrderStatus.EXECUTING].includes(order.status) && (
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{getProgressPercentage(order.status)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${getProgressPercentage(order.status)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Order ID */}
              <div className="text-xs text-gray-400 font-mono">
                ID: {order.id.slice(0, 10)}...{order.id.slice(-8)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order details modal */}
      <Modal
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        title="Order Details"
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(selectedOrder.status)}
                <span className={`text-sm font-medium px-3 py-1 rounded-full border ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusText(selectedOrder.status)}
                </span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Created {formatTimeAgo(selectedOrder.createdAt)}
              </span>
            </div>

            {/* Swap details */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {Number(formatEther(selectedOrder.fromAmount)).toFixed(4)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedOrder.fromToken.symbol}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedOrder.fromChain.name}
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {Number(formatEther(selectedOrder.toAmount)).toFixed(4)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedOrder.toToken.symbol}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedOrder.toChain.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Technical details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Order ID
                </label>
                <div className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                  {selectedOrder.id}
                </div>
              </div>

              {selectedOrder.txHash && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Hash
                  </label>
                  <div className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                    {selectedOrder.txHash}
                  </div>
                </div>
              )}

              {selectedOrder.htlcIds?.source && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Source HTLC ID
                  </label>
                  <div className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                    {selectedOrder.htlcIds.source}
                  </div>
                </div>
              )}

              {selectedOrder.htlcIds?.destination && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Destination HTLC ID
                  </label>
                  <div className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                    {selectedOrder.htlcIds.destination}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              {[OrderStatus.PENDING, OrderStatus.MATCHING].includes(selectedOrder.status) && (
                <Button
                  variant="danger"
                  onClick={() => handleCancelOrder(selectedOrder.id)}
                >
                  Cancel Order
                </Button>
              )}
              
              <Button
                variant="secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}