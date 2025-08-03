// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IBridgeValidator
 * @dev Interface for validating cross-chain transactions and state
 * Handles verification of DogeChain-Ethereum cross-chain messages
 */
interface IBridgeValidator {
    /**
     * @dev Cross-chain message structure
     */
    struct CrossChainMessage {
        uint256 sourceChainId;      // Chain ID where message originated
        uint256 targetChainId;      // Chain ID where message should be executed
        address sender;             // Original sender on source chain
        address target;             // Target contract on destination chain
        bytes payload;              // Message payload
        uint256 nonce;              // Message nonce for replay protection
        uint256 timestamp;          // Message timestamp
        bytes32 messageHash;        // Hash of the message
        bytes[] signatures;         // Validator signatures
    }

    /**
     * @dev Validator information
     */
    struct ValidatorInfo {
        address validator;          // Validator address
        uint256 stake;             // Validator stake amount
        bool isActive;             // Whether validator is active
        uint256 joinedAt;          // Timestamp when validator joined
        uint256 lastActivity;      // Last activity timestamp
        uint256 slashCount;        // Number of times slashed
    }

    /**
     * @dev Bridge configuration
     */
    struct BridgeConfig {
        uint256 requiredSignatures; // Minimum required signatures
        uint256 messageTimeout;     // Message timeout in seconds
        uint256 minStake;           // Minimum stake for validators
        uint256 slashAmount;        // Amount slashed for misbehavior
        bool isPaused;              // Whether bridge is paused
    }

    /**
     * @dev Events
     */
    event MessageSent(
        bytes32 indexed messageHash,
        uint256 indexed sourceChainId,
        uint256 indexed targetChainId,
        address sender,
        address target,
        uint256 nonce
    );

    event MessageExecuted(
        bytes32 indexed messageHash,
        bool success,
        bytes returnData
    );

    event ValidatorAdded(
        address indexed validator,
        uint256 stake
    );

    event ValidatorRemoved(
        address indexed validator,
        uint256 stakedAmount
    );

    event ValidatorSlashed(
        address indexed validator,
        uint256 slashAmount,
        string reason
    );

    event BridgePaused(address indexed admin);
    event BridgeUnpaused(address indexed admin);

    /**
     * @dev Errors
     */
    error BridgeCurrentlyPaused();
    error InvalidChainId(uint256 chainId);
    error InvalidSignature(address validator);
    error InsufficientSignatures(uint256 provided, uint256 required);
    error MessageAlreadyExecuted(bytes32 messageHash);
    error MessageExpired(bytes32 messageHash, uint256 timestamp);
    error ValidatorNotActive(address validator);
    error InsufficientStake(uint256 provided, uint256 required);
    error UnauthorizedValidator(address validator);

    /**
     * @dev Send a cross-chain message
     * @param targetChainId Destination chain ID
     * @param target Target contract address
     * @param payload Message payload
     * @return messageHash Hash of the sent message
     */
    function sendMessage(
        uint256 targetChainId,
        address target,
        bytes calldata payload
    ) external returns (bytes32 messageHash);

    /**
     * @dev Execute a cross-chain message with validator signatures
     * @param message Cross-chain message to execute
     * @return success Whether execution was successful
     * @return returnData Return data from execution
     */
    function executeMessage(
        CrossChainMessage calldata message
    ) external returns (bool success, bytes memory returnData);

    /**
     * @dev Verify validator signatures for a message
     * @param messageHash Hash of the message
     * @param signatures Array of validator signatures
     * @return isValid Whether signatures are valid
     * @return validatorCount Number of valid signatures
     */
    function verifySignatures(
        bytes32 messageHash,
        bytes[] calldata signatures
    ) external view returns (bool isValid, uint256 validatorCount);

    /**
     * @dev Add a new validator
     * @param validator Validator address
     * @param stake Initial stake amount
     */
    function addValidator(address validator, uint256 stake) external;

    /**
     * @dev Remove a validator
     * @param validator Validator address to remove
     */
    function removeValidator(address validator) external;

    /**
     * @dev Slash a validator for misbehavior
     * @param validator Validator to slash
     * @param amount Amount to slash
     * @param reason Reason for slashing
     */
    function slashValidator(
        address validator,
        uint256 amount,
        string calldata reason
    ) external;

    /**
     * @dev Get validator information
     * @param validator Validator address
     * @return info Validator information
     */
    function getValidator(address validator) external view returns (ValidatorInfo memory info);

    /**
     * @dev Get all active validators
     * @return validators Array of active validator addresses
     */
    function getActiveValidators() external view returns (address[] memory validators);

    /**
     * @dev Get bridge configuration
     * @return config Current bridge configuration
     */
    function getBridgeConfig() external view returns (BridgeConfig memory config);

    /**
     * @dev Check if a message has been executed
     * @param messageHash Hash of the message
     * @return executed Whether message has been executed
     */
    function isMessageExecuted(bytes32 messageHash) external view returns (bool executed);

    /**
     * @dev Calculate message hash
     * @param sourceChainId Source chain ID
     * @param targetChainId Target chain ID
     * @param sender Sender address
     * @param target Target address
     * @param payload Message payload
     * @param nonce Message nonce
     * @param timestamp Message timestamp
     * @return messageHash Calculated message hash
     */
    function calculateMessageHash(
        uint256 sourceChainId,
        uint256 targetChainId,
        address sender,
        address target,
        bytes calldata payload,
        uint256 nonce,
        uint256 timestamp
    ) external pure returns (bytes32 messageHash);

    /**
     * @dev Pause the bridge (emergency function)
     */
    function pauseBridge() external;

    /**
     * @dev Unpause the bridge
     */
    function unpauseBridge() external;

    /**
     * @dev Update bridge configuration
     * @param newConfig New bridge configuration
     */
    function updateBridgeConfig(BridgeConfig calldata newConfig) external;
}