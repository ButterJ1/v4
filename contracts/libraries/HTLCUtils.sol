// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HTLCUtils
 * @dev Utility library for Hash Time Locked Contract operations
 * Provides helper functions for HTLC creation, validation, and management
 */
library HTLCUtils {
    /**
     * @dev Default timelock durations for different use cases
     */
    uint256 public constant DEFAULT_TIMELOCK_DURATION = 4 hours;
    uint256 public constant QUICK_TIMELOCK_DURATION = 1 hours;
    uint256 public constant EXTENDED_TIMELOCK_DURATION = 24 hours;
    
    /**
     * @dev Minimum and maximum timelock bounds
     */
    uint256 public constant MIN_TIMELOCK_DURATION = 30 minutes;
    uint256 public constant MAX_TIMELOCK_DURATION = 30 days;

    /**
     * @dev Generate a secure hashlock from a secret
     * @param secret The secret value
     * @return hashlock The keccak256 hash of the secret
     */
    function generateHashlock(bytes32 secret) internal pure returns (bytes32 hashlock) {
        return keccak256(abi.encodePacked(secret));
    }

    /**
     * @dev Generate a secure hashlock with additional entropy
     * @param secret The secret value
     * @param salt Additional salt for security
     * @return hashlock The keccak256 hash of secret + salt
     */
    function generateHashlockWithSalt(
        bytes32 secret, 
        bytes32 salt
    ) internal pure returns (bytes32 hashlock) {
        return keccak256(abi.encodePacked(secret, salt));
    }

    /**
     * @dev Verify that a preimage matches a hashlock
     * @param preimage The claimed secret
     * @param hashlock The expected hash
     * @return isValid Whether the preimage is valid
     */
    function verifyPreimage(
        bytes32 preimage, 
        bytes32 hashlock
    ) internal pure returns (bool isValid) {
        return generateHashlock(preimage) == hashlock;
    }

    /**
     * @dev Verify preimage with salt
     * @param preimage The claimed secret
     * @param salt The salt used in generation
     * @param hashlock The expected hash
     * @return isValid Whether the preimage is valid
     */
    function verifyPreimageWithSalt(
        bytes32 preimage,
        bytes32 salt,
        bytes32 hashlock
    ) internal pure returns (bool isValid) {
        return generateHashlockWithSalt(preimage, salt) == hashlock;
    }

    /**
     * @dev Calculate appropriate timelock for cross-chain swaps
     * @param sourceChainId Source chain ID
     * @param targetChainId Target chain ID
     * @param baseTimelock Base timelock duration
     * @return timelock Adjusted timelock timestamp
     */
    function calculateCrossChainTimelock(
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 baseTimelock
    ) internal view returns (uint256 timelock) {
        // Add extra time for cross-chain coordination
        uint256 crossChainBuffer = 2 hours;
        
        // Add extra buffer for high-latency chains
        if (_isHighLatencyChain(sourceChainId) || _isHighLatencyChain(targetChainId)) {
            crossChainBuffer += 1 hours;
        }
        
        return block.timestamp + baseTimelock + crossChainBuffer;
    }

    /**
     * @dev Validate timelock parameters
     * @param timelock The timelock timestamp to validate
     * @return isValid Whether the timelock is valid
     * @return reason Reason for validation failure (if any)
     */
    function validateTimelock(uint256 timelock) 
        internal 
        view 
        returns (bool isValid, string memory reason) 
    {
        if (timelock <= block.timestamp) {
            return (false, "Timelock is in the past");
        }
        
        if (timelock <= block.timestamp + MIN_TIMELOCK_DURATION) {
            return (false, "Timelock too short");
        }
        
        if (timelock > block.timestamp + MAX_TIMELOCK_DURATION) {
            return (false, "Timelock too long");
        }
        
        return (true, "");
    }

    /**
     * @dev Generate a unique contract ID for HTLC
     * @param sender Address of the sender
     * @param recipient Address of the recipient
     * @param token Token contract address
     * @param amount Token amount
     * @param hashlock Hash of the secret
     * @param timelock Timelock timestamp
     * @param chainId Chain ID where contract exists
     * @return contractId Unique contract identifier
     */
    function generateContractId(
        address sender,
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        uint256 chainId
    ) internal pure returns (bytes32 contractId) {
        return keccak256(abi.encodePacked(
            sender,
            recipient,
            token,
            amount,
            hashlock,
            timelock,
            chainId
        ));
    }

    /**
     * @dev Generate cross-chain pair contract IDs
     * @param sender Address of the sender
     * @param recipient Address of the recipient
     * @param srcToken Source token address
     * @param dstToken Destination token address
     * @param srcAmount Source amount
     * @param dstAmount Destination amount
     * @param hashlock Shared hashlock
     * @param srcTimelock Source chain timelock
     * @param dstTimelock Destination chain timelock
     * @param srcChainId Source chain ID
     * @param dstChainId Destination chain ID
     * @return srcContractId Source chain contract ID
     * @return dstContractId Destination chain contract ID
     */
    function generateCrossChainPairIds(
        address sender,
        address recipient,
        address srcToken,
        address dstToken,
        uint256 srcAmount,
        uint256 dstAmount,
        bytes32 hashlock,
        uint256 srcTimelock,
        uint256 dstTimelock,
        uint256 srcChainId,
        uint256 dstChainId
    ) internal pure returns (bytes32 srcContractId, bytes32 dstContractId) {
        srcContractId = generateContractId(
            sender, recipient, srcToken, srcAmount, hashlock, srcTimelock, srcChainId
        );
        
        dstContractId = generateContractId(
            recipient, sender, dstToken, dstAmount, hashlock, dstTimelock, dstChainId
        );
    }

    /**
     * @dev Calculate required collateral for HTLC based on risk factors
     * @param amount Base amount
     * @param timelock Timelock duration
     * @param chainId Chain ID
     * @return collateral Required collateral amount
     */
    function calculateRequiredCollateral(
        uint256 amount,
        uint256 timelock,
        uint256 chainId
    ) internal view returns (uint256 collateral) {
        uint256 baseCollateral = amount;
        
        // Add time-based premium (longer timelock = higher risk)
        uint256 timePremium = (amount * (timelock - block.timestamp)) / (30 days * 100);
        
        // Add chain-specific risk premium
        uint256 chainPremium = _getChainRiskPremium(amount, chainId);
        
        return baseCollateral + timePremium + chainPremium;
    }

    /**
     * @dev Generate a secure random secret (using block data)
     * NOTE: This is not cryptographically secure and should only be used for testing
     * @param entropy Additional entropy source
     * @return secret Generated secret
     */
    function generateSecret(bytes32 entropy) internal view returns (bytes32 secret) {
        return keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            entropy,
            msg.sender
        ));
    }

    /**
     * @dev Encode HTLC parameters for signature verification
     * @param sender Sender address
     * @param recipient Recipient address
     * @param token Token address
     * @param amount Token amount
     * @param hashlock Hashlock
     * @param timelock Timelock
     * @param chainId Chain ID
     * @return encoded Encoded parameters
     */
    function encodeHTLCParams(
        address sender,
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        uint256 chainId
    ) internal pure returns (bytes memory encoded) {
        return abi.encode(
            sender,
            recipient,
            token,
            amount,
            hashlock,
            timelock,
            chainId
        );
    }

    /**
     * @dev Check if a chain is considered high-latency
     * @param chainId Chain ID to check
     * @return isHighLatency Whether the chain has high latency
     */
    function _isHighLatencyChain(uint256 chainId) private pure returns (bool isHighLatency) {
        // Define high-latency chains (can be extended)
        return chainId == 1 || // Ethereum mainnet
               chainId == 56 || // BSC
               chainId == 137; // Polygon
    }

    /**
     * @dev Get chain-specific risk premium
     * @param amount Base amount
     * @param chainId Chain ID
     * @return premium Risk premium amount
     */
    function _getChainRiskPremium(
        uint256 amount, 
        uint256 chainId
    ) private pure returns (uint256 premium) {
        // Base premium is 0.1% of amount
        uint256 basePremium = amount / 1000;
        
        // Adjust based on chain risk profile
        if (chainId == 1) {
            // Ethereum mainnet - low risk
            return basePremium / 2;
        } else if (chainId == 11155111 || chainId == 568) {
            // Testnets - medium risk
            return basePremium;
        } else {
            // Unknown chains - higher risk
            return basePremium * 2;
        }
    }
}