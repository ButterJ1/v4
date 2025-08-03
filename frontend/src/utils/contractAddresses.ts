import { Address } from 'viem'

export type ChainId = 1 | 11155111 | 2000 | 568 | 31337

export interface ContractAddresses {
  crossChainHTLC: Address
  fusionPlusAdapter: Address
  dogeChainBridge: Address
  mockResolver: Address
  mockERC20?: Address
  mockWETH?: Address
  mockDOGE?: Address
  mockWDOGE?: Address
}

export const CONTRACT_ADDRESSES: Record<ChainId, ContractAddresses> = {
  // Ethereum Mainnet
  1: {
    crossChainHTLC: '0x0000000000000000000000000000000000000000',
    fusionPlusAdapter: '0x0000000000000000000000000000000000000000',
    dogeChainBridge: '0x0000000000000000000000000000000000000000',
    mockResolver: '0x0000000000000000000000000000000000000000',
  },
  
  // Ethereum Sepolia Testnet
  11155111: {
    crossChainHTLC: '0x0000000000000000000000000000000000000000', // Will be updated after deployment
    fusionPlusAdapter: '0x0000000000000000000000000000000000000000',
    dogeChainBridge: '0x0000000000000000000000000000000000000000',
    mockResolver: '0x0000000000000000000000000000000000000000',
    mockERC20: '0x0000000000000000000000000000000000000000', // Mock USDC
    mockWETH: '0x0000000000000000000000000000000000000000',
  },
  
  // DogeChain Mainnet
  2000: {
    crossChainHTLC: '0x0000000000000000000000000000000000000000',
    fusionPlusAdapter: '0x0000000000000000000000000000000000000000',
    dogeChainBridge: '0x0000000000000000000000000000000000000000',
    mockResolver: '0x0000000000000000000000000000000000000000',
  },
  
  // DogeChain Testnet
  568: {
    crossChainHTLC: '0x0000000000000000000000000000000000000000', // Will be updated after deployment
    fusionPlusAdapter: '0x0000000000000000000000000000000000000000',
    dogeChainBridge: '0x0000000000000000000000000000000000000000',
    mockResolver: '0x0000000000000000000000000000000000000000',
    mockDOGE: '0x0000000000000000000000000000000000000000',
    mockWDOGE: '0x0000000000000000000000000000000000000000',
  },
  
  // Hardhat Local
  31337: {
    crossChainHTLC: '0x0000000000000000000000000000000000000000',
    fusionPlusAdapter: '0x0000000000000000000000000000000000000000',
    dogeChainBridge: '0x0000000000000000000000000000000000000000',
    mockResolver: '0x0000000000000000000000000000000000000000',
    mockERC20: '0x0000000000000000000000000000000000000000',
    mockWETH: '0x0000000000000000000000000000000000000000',
  },
}

/**
 * Get contract addresses for a specific chain
 */
export function getContractAddresses(chainId: ChainId): ContractAddresses {
  return CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[11155111] // Default to Sepolia
}

/**
 * Get contract address by name and chain
 */
export function getContractAddress(
  chainId: ChainId, 
  contractName: keyof ContractAddresses
): Address {
  const addresses = getContractAddresses(chainId)
  const address = addresses[contractName]
  
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    console.warn(`Contract ${contractName} not deployed on chain ${chainId}`)
    return '0x0000000000000000000000000000000000000000'
  }
  
  return address
}

/**
 * Update contract addresses (for development)
 */
export function updateContractAddresses(
  chainId: ChainId, 
  addresses: Partial<ContractAddresses>
): void {
  CONTRACT_ADDRESSES[chainId] = {
    ...CONTRACT_ADDRESSES[chainId],
    ...addresses,
  }
}

/**
 * Load contract addresses from deployment files
 */
export async function loadDeploymentAddresses(): Promise<void> {
  try {
    // Try to load Ethereum Sepolia deployment
    const ethereumResponse = await fetch('/deployments/ethereum-sepolia.json')
    if (ethereumResponse.ok) {
      const ethereumData = await ethereumResponse.json()
      updateContractAddresses(11155111, {
        crossChainHTLC: ethereumData.contracts.CrossChainHTLC.address,
        fusionPlusAdapter: ethereumData.contracts.FusionPlusAdapter.address,
        dogeChainBridge: ethereumData.contracts.DogeChainBridge.address,
        mockResolver: ethereumData.contracts.MockResolver.address,
        mockERC20: ethereumData.contracts.MockUSDC.address,
        mockWETH: ethereumData.contracts.MockWETH.address,
      })
      console.log('✅ Loaded Ethereum Sepolia addresses')
    }
    
    // Try to load DogeChain testnet deployment
    const dogeResponse = await fetch('/deployments/dogechain-testnet.json')
    if (dogeResponse.ok) {
      const dogeData = await dogeResponse.json()
      updateContractAddresses(568, {
        crossChainHTLC: dogeData.contracts.CrossChainHTLC.address,
        fusionPlusAdapter: dogeData.contracts.FusionPlusAdapter.address,
        dogeChainBridge: dogeData.contracts.DogeChainBridge.address,
        mockResolver: dogeData.contracts.MockResolver.address,
        mockDOGE: dogeData.contracts.MockDOGE.address,
        mockWDOGE: dogeData.contracts.MockWDOGE.address,
      })
      console.log('✅ Loaded DogeChain testnet addresses')
    }
  } catch (error) {
    console.warn('⚠️ Could not load deployment addresses:', error)
  }
}

/**
 * Check if contracts are deployed on a chain
 */
export function areContractsDeployed(chainId: ChainId): boolean {
  const addresses = getContractAddresses(chainId)
  return Object.values(addresses).some(
    addr => addr && addr !== '0x0000000000000000000000000000000000000000'
  )
}

/**
 * Get supported chains with deployed contracts
 */
export function getSupportedChains(): ChainId[] {
  return Object.keys(CONTRACT_ADDRESSES)
    .map(Number)
    .filter(chainId => areContractsDeployed(chainId as ChainId)) as ChainId[]
}

/**
 * Chain configuration
 */
export const CHAIN_CONFIG = {
  1: {
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    decimals: 18,
    blockExplorer: 'https://etherscan.io',
    rpcUrl: 'https://eth-mainnet.public.blastapi.io',
    isTestnet: false,
  },
  11155111: {
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    decimals: 18,
    blockExplorer: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    isTestnet: true,
  },
  2000: {
    name: 'DogeChain Mainnet',
    symbol: 'DOGE',
    decimals: 18,
    blockExplorer: 'https://explorer.dogechain.dog',
    rpcUrl: 'https://rpc.dogechain.dog',
    isTestnet: false,
  },
  568: {
    name: 'DogeChain Testnet',
    symbol: 'DOGE',
    decimals: 18,
    blockExplorer: 'https://explorer-testnet.dogechain.dog',
    rpcUrl: 'https://rpc-testnet.dogechain.dog',
    isTestnet: true,
  },
  31337: {
    name: 'Hardhat Local',
    symbol: 'ETH',
    decimals: 18,
    blockExplorer: 'http://localhost:8545',
    rpcUrl: 'http://127.0.0.1:8545',
    isTestnet: true,
  },
} as const

/**
 * Get chain configuration
 */
export function getChainConfig(chainId: ChainId) {
  return CHAIN_CONFIG[chainId]
}

/**
 * Format chain name for display
 */
export function formatChainName(chainId: ChainId): string {
  const config = getChainConfig(chainId)
  return config?.name || `Chain ${chainId}`
}