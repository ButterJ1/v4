import React, { useEffect } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { Toaster } from 'react-hot-toast'
import { wagmiConfig } from './config/wagmi'
import { SwapInterface } from './components/swap/SwapInterface'
import { WalletConnector } from './components/wallet/WalletConnector'
import { OrderTracker } from './components/swap/OrderTracker'
import { loadDeploymentAddresses } from './utils/contractAddresses'
import './App.css'
import '@rainbow-me/rainbowkit/styles.css'

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    },
  },
})

function App() {
  useEffect(() => {
    // Load contract addresses on app startup
    loadDeploymentAddresses().catch(console.error)
  }, [])

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">1</span>
                      </div>
                      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        Fusion+ Cross-Chain
                      </h1>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Demo
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <nav className="hidden md:flex space-x-6">
                      <a href="#swap" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                        Swap
                      </a>
                      <a href="#orders" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                        Orders
                      </a>
                      <a href="#docs" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                        Docs
                      </a>
                    </nav>
                    <WalletConnector />
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Hero Section */}
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  Cross-Chain Atomic Swaps
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  Experience seamless cross-chain trading between Ethereum and DogeChain 
                  using 1inch Fusion+ technology with atomic swap guarantees.
                </p>
                <div className="mt-6 flex justify-center space-x-4">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Ethereum Sepolia
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      DogeChain Testnet
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Interface */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Swap Interface - Main Column */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Cross-Chain Swap
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Swap tokens across Ethereum and DogeChain with atomic guarantees
                      </p>
                    </div>
                    <div className="p-6">
                      <SwapInterface />
                    </div>
                  </div>
                </div>

                {/* Order Tracker - Side Column */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Active Orders
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Track your cross-chain swap progress
                      </p>
                    </div>
                    <div className="p-6">
                      <OrderTracker />
                    </div>
                  </div>

                  {/* Stats Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Protocol Stats
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Volume</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">$1.2M</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Active Orders</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">42</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
                          <span className="text-sm font-medium text-green-600">99.2%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Avg. Time</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">3.2m</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Features Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-700 overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
                        Key Features
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-blue-800 dark:text-blue-200">Atomic Swaps</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-blue-800 dark:text-blue-200">Fusion+ Integration</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-blue-800 dark:text-blue-200">Gas Optimization</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-blue-800 dark:text-blue-200">MEV Protection</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* How It Works Section */}
              <div className="mt-16">
                <div className="text-center mb-12">
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    How It Works
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Our cross-chain swap protocol uses Hash Time Locked Contracts (HTLCs) 
                    to ensure atomic execution across different blockchains.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</span>
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Create Order
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      Specify your swap parameters and submit a cross-chain order with locked funds
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">2</span>
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Match & Execute
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      Resolvers match your order and create HTLCs on both chains simultaneously
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">3</span>
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Atomic Settlement
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      Reveal secret to claim tokens on both chains with atomic guarantee
                    </p>
                  </div>
                </div>
              </div>
            </main>

            {/* Footer */}
            <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 mt-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    Built with 1inch Fusion+ SDK for cross-chain atomic swaps
                  </p>
                  <div className="mt-4 flex justify-center space-x-6">
                    <a href="#" className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                      GitHub
                    </a>
                    <a href="#" className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                      Documentation
                    </a>
                    <a href="#" className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                      1inch Protocol
                    </a>
                  </div>
                </div>
              </div>
            </footer>

            {/* Toast Notifications */}
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-text)',
                  border: '1px solid var(--toast-border)',
                },
              }}
            />
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App