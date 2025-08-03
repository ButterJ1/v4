/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_1INCH_API_KEY: string
  readonly VITE_INFURA_KEY: string
  readonly VITE_ALCHEMY_KEY: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_DESCRIPTION: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Window type extensions for Web3 providers
declare global {
  interface Window {
    ethereum?: any
    web3?: any
  }
}

// Extend NodeJS global for better typing
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
    }
  }
}

export {}