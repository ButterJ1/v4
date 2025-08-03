import React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { getChainConfig, isSupportedChain } from '../../config/wagmi'

export const WalletConnector: React.FC = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const chainConfig = getChainConfig(chainId)
  const isSupported = isSupportedChain(chainId)

  return (
    <div className="flex items-center space-x-3">
      {/* Chain Status Indicator */}
      {isConnected && (
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            isSupported ? 'bg-green-500' : 'bg-red-500'
          } animate-pulse`}></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {chainConfig.name}
          </span>
          {!isSupported && (
            <button
              onClick={() => switchChain?.({ chainId: 11155111 })} // Switch to Sepolia
              className="text-xs px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-full transition-colors"
            >
              Switch Network
            </button>
          )}
        </div>
      )}

      {/* Custom Connect Button */}
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          // Note: If your app doesn't use authentication, you
          // can remove all 'authenticationStatus' checks
          const ready = mounted && authenticationStatus !== 'loading'
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus ||
              authenticationStatus === 'authenticated')

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                'style': {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Connect Wallet
                    </button>
                  )
                }

                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Wrong Network
                    </button>
                  )
                }

                return (
                  <div className="flex items-center space-x-2">
                    {/* Chain Button */}
                    <button
                      onClick={openChainModal}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        backgroundColor: chain.iconBackground,
                        borderRadius: 8,
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.2s'
                      }}
                      type="button"
                      className="hover:shadow-md"
                    >
                      {chain.hasIcon && (
                        <div
                          style={{
                            background: chain.iconBackground,
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            overflow: 'hidden',
                            marginRight: 8,
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              style={{ width: 20, height: 20 }}
                            />
                          )}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {chain.name}
                      </span>
                      <svg className="w-4 h-4 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Account Button */}
                    <button
                      onClick={openAccountModal}
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                    >
                      <div className="flex items-center space-x-2">
                        {/* Avatar */}
                        <div className="w-5 h-5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-white">
                            {account.displayName?.[0] || '?'}
                          </span>
                        </div>
                        
                        {/* Address */}
                        <span>{account.displayName}</span>
                        
                        {/* Balance */}
                        {account.displayBalance && (
                          <span className="text-gray-500">
                            {account.displayBalance}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                )
              })()}
            </div>
          )
        }}
      </ConnectButton.Custom>
    </div>
  )
}

// Network Switcher Component
export const NetworkSwitcher: React.FC = () => {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const supportedNetworks = [
    { chainId: 11155111, name: 'Ethereum Sepolia', color: '#627EEA' },
    { chainId: 568, name: 'DogeChain Testnet', color: '#C2A633' },
  ]

  return (
    <div className="flex items-center space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Switch Network:
      </span>
      <div className="flex space-x-2">
        {supportedNetworks.map((network) => (
          <button
            key={network.chainId}
            onClick={() => switchChain?.({ chainId: network.chainId })}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              chainId === network.chainId
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center space-x-1">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: network.color }}
              ></div>
              <span>{network.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Balance Display Component
export const BalanceDisplay: React.FC<{
  tokenSymbol: string
  balance: string
  usdValue?: number
}> = ({ tokenSymbol, balance, usdValue }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-white">
            {tokenSymbol[0]}
          </span>
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {tokenSymbol}
        </span>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {balance}
        </div>
        {usdValue && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            ${usdValue.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  )
}

// Connection Status Component
export const ConnectionStatus: React.FC = () => {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const chainConfig = getChainConfig(chainId)

  if (!isConnected) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span>Not Connected</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Connected</span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <div>Address: {address?.slice(0, 6)}...{address?.slice(-4)}</div>
        <div>Network: {chainConfig.name}</div>
      </div>
    </div>
  )
}