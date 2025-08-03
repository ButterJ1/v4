// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title CrossChainUtils
 * @dev Utility library for cross-chain operations and validations
 * Handles chain-specific logic for Ethereum-DogeChain integration
 */
library CrossChainUtils {
    /**
     * @dev Supported chain IDs
     */
    uint256 public constant ETHEREUM_MAINNET = 1;
    uint256 public constant ETHEREUM_SEPOLIA = 11155111;
    uint256 public constant DOGECHAIN_MAINNET = 2000;
    uint256 public constant DOGECHAIN_TESTNET = 568;
    
    /**
     * @dev Chain configuration structure
     */
    struct ChainConfig {
        uint256 chainId;
        string name;
        string rpcUrl;
        uint256 blockTime;          // Average block time in seconds
        uint256 confirmations;      // Required confirmations for finality
        bool isTestnet;
        bool isSupported;
    }

    /**
     * @dev Cross-chain message structure
     */
    struct CrossChainMessage {
        uint256 sourceChain;
        uint256 destinationChain;
        address sender;
        address recipient;
        bytes32 messageHash;
        uint256 timestamp;
        uint256 nonce;
        bytes payload;
    }

    /**
     * @dev Token mapping for cross-chain swaps
     */
    struct TokenMapping {
        address sourceToken;        // Token address on source chain
        address destinationToken;   // Corresponding token on destination chain
        uint256 sourceChainId;
        uint256 destinationChainId;
        uint256 exchangeRate;       // Exchange rate (if different)
        bool isActive;
    }

    /**
     * @dev Get chain configuration
     * @param chainId Chain ID to get config for
     * @return config Chain configuration
     */
    function getChainConfig(uint256 chainId) internal pure returns (ChainConfig memory config) {
        if (chainId == ETHEREUM_MAINNET) {
            return ChainConfig({
                chainId: ETHEREUM_MAINNET,
                name: "Ethereum Mainnet",
                rpcUrl: "https://eth-mainnet.public.blastapi.io",
                blockTime: 12,
                confirmations: 6,
                isTestnet: false,
                isSupported: true
            });
        } else if (chainId == ETHEREUM_SEPOLIA) {
            return ChainConfig({
                chainId: ETHEREUM_SEPOLIA,
                name: "Ethereum Sepolia",
                rpcUrl: "https://sepolia.infura.io/v3/",
                blockTime: 12,
                confirmations: 3,
                isTestnet: true,
                isSupported: true
            });
        } else if (chainId == DOGECHAIN_MAINNET) {
            return ChainConfig({
                chainId: DOGECHAIN_MAINNET,
                name: "DogeChain Mainnet",
                rpcUrl: "https://rpc.dogechain.dog",
                blockTime: 2,
                confirmations: 10,
                isTestnet: false,
                isSupported: true
            });
        } else if (chainId == DOGECHAIN_TESTNET) {
            return ChainConfig({
                chainId: DOGECHAIN_TESTNET,
                name: "DogeChain Testnet",
                rpcUrl: "https://rpc-testnet.dogechain.dog",
                blockTime: 2,
                confirmations: 5,
                isTestnet: true,
                isSupported: true
            });
        } else {
            return ChainConfig({
                chainId: chainId,
                name: "Unknown Chain",
                rpcUrl: "",
                blockTime: 15,
                confirmations: 12,
                isTestnet: false,
                isSupported: false
            });
        }
    }

    /**
     * @dev Check if a chain is supported
     * @param chainId Chain ID to check
     * @return supported Whether the chain is supported
     */
    function isChainSupported(uint256 chainId) internal pure returns (bool supported) {
        return chainId == ETHEREUM_MAINNET ||
               chainId == ETHEREUM_SEPOLIA ||
               chainId == DOGECHAIN_MAINNET ||
               chainId == DOGECHAIN_TESTNET;
    }

    /**
     * @dev Check if chains are compatible for cross-chain swaps
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @return compatible Whether chains are compatible
     * @return reason Reason if not compatible
     */
    function areChainsCompatible(
        uint256 sourceChain, 
        uint256 destinationChain
    ) internal pure returns (bool compatible, string memory reason) {
        if (!isChainSupported(sourceChain)) {
            return (false, "Source chain not supported");
        }
        
        if (!isChainSupported(destinationChain)) {
            return (false, "Destination chain not supported");
        }
        
        if (sourceChain == destinationChain) {
            return (false, "Cannot swap on same chain");
        }
        
        ChainConfig memory sourceConfig = getChainConfig(sourceChain);
        ChainConfig memory destConfig = getChainConfig(destinationChain);
        
        // Check testnet compatibility
        if (sourceConfig.isTestnet != destConfig.isTestnet) {
            return (false, "Cannot swap between mainnet and testnet");
        }
        
        return (true, "");
    }

    /**
     * @dev Calculate optimal timelock for cross-chain operation
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param baseTimelock Base timelock in seconds
     * @return sourceTimelock Timelock for source chain
     * @return destinationTimelock Timelock for destination chain
     */
    function calculateOptimalTimelocks(
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 baseTimelock
    ) internal view returns (uint256 sourceTimelock, uint256 destinationTimelock) {
        ChainConfig memory sourceConfig = getChainConfig(sourceChain);
        ChainConfig memory destConfig = getChainConfig(destinationChain);
        
        // Source timelock should be longer to give recipient time to act
        uint256 sourceBuffer = sourceConfig.blockTime * sourceConfig.confirmations * 2;
        uint256 destBuffer = destConfig.blockTime * destConfig.confirmations * 2;
        
        // Destination timelock (for counterparty contract)
        destinationTimelock = block.timestamp + baseTimelock + destBuffer;
        
        // Source timelock should be at least 1 hour longer
        sourceTimelock = destinationTimelock + 3600 + sourceBuffer;
    }

    /**
     * @dev Generate cross-chain message hash
     * @param message Cross-chain message
     * @return messageHash Hash of the message
     */
    function hashCrossChainMessage(
        CrossChainMessage memory message
    ) internal pure returns (bytes32 messageHash) {
        return keccak256(abi.encode(
            message.sourceChain,
            message.destinationChain,
            message.sender,
            message.recipient,
            message.timestamp,
            message.nonce,
            message.payload
        ));
    }

    /**
     * @dev Validate cross-chain message format
     * @param message Message to validate
     * @return isValid Whether message is valid
     * @return reason Reason if invalid
     */
    function validateCrossChainMessage(
        CrossChainMessage memory message
    ) internal view returns (bool isValid, string memory reason) {
        if (!isChainSupported(message.sourceChain)) {
            return (false, "Invalid source chain");
        }
        
        if (!isChainSupported(message.destinationChain)) {
            return (false, "Invalid destination chain");
        }
        
        if (message.sender == address(0)) {
            return (false, "Invalid sender address");
        }
        
        if (message.recipient == address(0)) {
            return (false, "Invalid recipient address");
        }
        
        if (message.timestamp > block.timestamp + 300) { // 5 minutes future tolerance
            return (false, "Message timestamp too far in future");
        }
        
        if (message.timestamp + 86400 < block.timestamp) { // 24 hours past tolerance
            return (false, "Message timestamp too old");
        }
        
        return (true, "");
    }

    /**
     * @dev Get standard token mappings for cross-chain swaps
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @return mappings Array of supported token mappings
     */
    function getStandardTokenMappings(
        uint256 sourceChain,
        uint256 destinationChain
    ) internal pure returns (TokenMapping[] memory mappings) {
        // This would typically be loaded from storage or config
        // For now, return basic ETH/DOGE mappings
        
        if ((sourceChain == ETHEREUM_SEPOLIA && destinationChain == DOGECHAIN_TESTNET) ||
            (sourceChain == DOGECHAIN_TESTNET && destinationChain == ETHEREUM_SEPOLIA)) {
            
            mappings = new TokenMapping[](2);
            
            // Native token mapping (ETH <-> DOGE)
            mappings[0] = TokenMapping({
                sourceToken: address(0),      // Native ETH
                destinationToken: address(0), // Native DOGE
                sourceChainId: sourceChain,
                destinationChainId: destinationChain,
                exchangeRate: 1e18,          // 1:1 for demo
                isActive: true
            });
            
            // Would add ERC20 token mappings here
            mappings[1] = TokenMapping({
                sourceToken: address(0x1234), // Placeholder for ERC20
                destinationToken: address(0x5678), // Placeholder for corresponding token
                sourceChainId: sourceChain,
                destinationChainId: destinationChain,
                exchangeRate: 1e18,
                isActive: false              // Disabled for now
            });
        } else {
            mappings = new TokenMapping[](0);
        }
    }

    /**
     * @dev Calculate cross-chain fees
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param amount Transfer amount
     * @return protocolFee Protocol fee amount
     * @return bridgeFee Bridge operation fee
     * @return gasFee Estimated gas fee for destination
     */
    function calculateCrossChainFees(
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 amount
    ) internal pure returns (
        uint256 protocolFee,
        uint256 bridgeFee,
        uint256 gasFee
    ) {
        // Protocol fee: 0.1% of amount
        protocolFee = amount / 1000;
        
        // Bridge fee based on chains
        ChainConfig memory sourceConfig = getChainConfig(sourceChain);
        ChainConfig memory destConfig = getChainConfig(destinationChain);
        
        if (sourceConfig.isTestnet && destConfig.isTestnet) {
            bridgeFee = amount / 10000; // 0.01% for testnets
        } else {
            bridgeFee = amount / 2000;  // 0.05% for mainnet
        }
        
        // Estimate gas fee (simplified)
        if (destinationChain == ETHEREUM_MAINNET || destinationChain == ETHEREUM_SEPOLIA) {
            gasFee = 0.001 ether; // ~$2-5 typical gas fee
        } else {
            gasFee = 0.00001 ether; // Low gas fee for DogeChain
        }
    }

    /**
     * @dev Encode cross-chain swap parameters
     * @param sourceToken Source token address
     * @param destinationToken Destination token address
     * @param amount Amount to swap
     * @param recipient Recipient address
     * @param deadline Swap deadline
     * @return encoded Encoded parameters
     */
    function encodeCrossChainSwapParams(
        address sourceToken,
        address destinationToken,
        uint256 amount,
        address recipient,
        uint256 deadline
    ) internal pure returns (bytes memory encoded) {
        return abi.encode(
            sourceToken,
            destinationToken,
            amount,
            recipient,
            deadline
        );
    }

    /**
     * @dev Decode cross-chain swap parameters
     * @param encoded Encoded parameters
     * @return sourceToken Source token address
     * @return destinationToken Destination token address
     * @return amount Amount to swap
     * @return recipient Recipient address
     * @return deadline Swap deadline
     */
    function decodeCrossChainSwapParams(
        bytes memory encoded
    ) internal pure returns (
        address sourceToken,
        address destinationToken,
        uint256 amount,
        address recipient,
        uint256 deadline
    ) {
        return abi.decode(encoded, (address, address, uint256, address, uint256));
    }

    /**
     * @dev Get network name for display
     * @param chainId Chain ID
     * @return name Human readable network name
     */
    function getNetworkName(uint256 chainId) internal pure returns (string memory name) {
        ChainConfig memory config = getChainConfig(chainId);
        return config.name;
    }

    /**
     * @dev Check if chain is testnet
     * @param chainId Chain ID to check
     * @return Whether chain is testnet
     */
    function isTestnet(uint256 chainId) internal pure returns (bool) {
        ChainConfig memory config = getChainConfig(chainId);
        return config.isTestnet;
    }
}