import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, localhost } from 'wagmi/chains'

// Define DogeChain Testnet
const dogeChainTestnet = {
  id: 568,
  name: 'DogeChain Testnet',
  network: 'dogechain-testnet',
  iconUrl: 'https://dogechain.dog/favicon.ico',
  iconBackground: '#fff',
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
    default: { 
      name: 'DogeChain Explorer', 
      url: 'https://explorer-testnet.dogechain.dog',
      apiUrl: 'https://explorer-testnet.dogechain.dog/api'
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 0,
    },
  },
  testnet: true,
} as const

export const wagmiConfig = getDefaultConfig({
  appName: 'Fusion+ Cross-Chain Demo',
  projectId: process.env.VITE_WALLETCONNECT_PROJECT_ID || 'fusion-plus-demo',
  chains: [
    sepolia,
    dogeChainTestnet,
    ...(process.env.NODE_ENV === 'development' ? [localhost] : []),
  ],
  ssr: false, // If your dApp uses server side rendering (SSR)
})

// Export chains for use in components
export const supportedChains = [sepolia, dogeChainTestnet, localhost]

// Chain configuration helpers
export const getChainConfig = (chainId: number) => {
  switch (chainId) {
    case 11155111:
      return {
        name: 'Ethereum Sepolia',
        symbol: 'ETH',
        decimals: 18,
        color: '#627EEA',
        explorer: 'https://sepolia.etherscan.io',
        faucet: 'https://sepoliafaucet.com'
      }
    case 568:
      return {
        name: 'DogeChain Testnet', 
        symbol: 'DOGE',
        decimals: 18,
        color: '#C2A633',
        explorer: 'https://explorer-testnet.dogechain.dog',
        faucet: 'https://faucet.dogechain.dog'
      }
    case 31337:
      return {
        name: 'Hardhat Local',
        symbol: 'ETH', 
        decimals: 18,
        color: '#F7DF1E',
        explorer: 'http://localhost:8545',
        faucet: null
      }
    default:
      return {
        name: 'Unknown Network',
        symbol: 'ETH',
        decimals: 18,
        color: '#000000',
        explorer: '',
        faucet: null
      }
  }
}

// Default tokens for each chain
export const getDefaultTokens = (chainId: number) => {
  switch (chainId) {
    case 11155111: // Ethereum Sepolia
      return [
        {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          isNative: true,
          logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
        },
        {
          address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // Placeholder for mock USDC
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          isNative: false,
          logoURI: 'https://tokens.1inch.io/0xa0b86a33e6989c25e0d65b6b59d70e0f8f0f8f0f.png'
        }
      ]
    case 568: // DogeChain Testnet
      return [
        {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'DOGE',
          name: 'Dogecoin',
          decimals: 18,
          isNative: true,
          logoURI: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png'
        },
        {
          address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // Placeholder for mock WDOGE
          symbol: 'WDOGE',
          name: 'Wrapped Dogecoin',
          decimals: 8,
          isNative: false,
          logoURI: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png'
        }
      ]
    case 31337: // Hardhat Local
      return [
        {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          isNative: true,
          logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
        }
      ]
    default:
      return []
  }
}

// Check if chain is supported
export const isSupportedChain = (chainId: number): boolean => {
  return [11155111, 568, 31337].includes(chainId)
}

// Get chain display name
export const getChainDisplayName = (chainId: number): string => {
  const config = getChainConfig(chainId)
  return config.name
}

// Get native token symbol
export const getNativeTokenSymbol = (chainId: number): string => {
  const config = getChainConfig(chainId)
  return config.symbol
}

// Check if chain is testnet
export const isTestnet = (chainId: number): boolean => {
  return [11155111, 568, 31337].includes(chainId)
}