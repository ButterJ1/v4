// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IBridgeValidator.sol";

/**
 * @title DogeChainBridge (Simplified for Demo)
 * @dev Simplified bridge implementation for Ethereum-DogeChain cross-chain communication
 * Focuses on core functionality needed for atomic swap coordination
 */
contract DogeChainBridge is IBridgeValidator, ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    /// @dev Role definitions
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @dev Bridge configuration (simplified)
    struct SimpleBridgeConfig {
        uint256 requiredSignatures;
        uint256 messageTimeout;
        bool isPaused;
    }

    /// @dev Simplified validator info
    struct SimpleValidatorInfo {
        address validator;
        bool isActive;
        uint256 joinedAt;
    }

    /// @dev Bridge configuration
    SimpleBridgeConfig public bridgeConfig;
    
    /// @dev Active validators
    address[] public validators;
    mapping(address => SimpleValidatorInfo) public validatorInfo;
    
    /// @dev Executed messages tracking
    mapping(bytes32 => bool) public executedMessages;
    
    /// @dev Message nonce tracking per chain
    mapping(uint256 => uint256) public chainNonces;
    
    /// @dev Supported chains
    mapping(uint256 => bool) public supportedChains;

    /// @dev Events are inherited from IBridgeValidator interface

    modifier onlyActiveValidator() {
        require(hasRole(VALIDATOR_ROLE, msg.sender), "Not a validator");
        require(validatorInfo[msg.sender].isActive, "Validator not active");
        _;
    }

    constructor(uint256 _requiredSignatures, uint256 _messageTimeout) {
        require(_requiredSignatures >= 1, "Invalid required signatures");
        require(_messageTimeout > 0, "Invalid message timeout");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        bridgeConfig = SimpleBridgeConfig({
            requiredSignatures: _requiredSignatures,
            messageTimeout: _messageTimeout,
            isPaused: false
        });

        // Add supported chains
        supportedChains[1] = true;        // Ethereum Mainnet
        supportedChains[11155111] = true; // Ethereum Sepolia
        supportedChains[2000] = true;     // DogeChain Mainnet
        supportedChains[568] = true;      // DogeChain Testnet
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function sendMessage(
        uint256 targetChainId,
        address target,
        bytes calldata payload
    ) external whenNotPaused returns (bytes32 messageHash) {
        require(supportedChains[targetChainId], "Chain not supported");
        require(target != address(0), "Invalid target address");
        require(targetChainId != block.chainid, "Cannot send to same chain");

        uint256 nonce = chainNonces[targetChainId]++;
        
        messageHash = calculateMessageHash(
            block.chainid,
            targetChainId,
            msg.sender,
            target,
            payload,
            nonce,
            block.timestamp
        );

        emit MessageSent(
            messageHash,
            block.chainid,
            targetChainId,
            msg.sender,
            target,
            nonce
        );
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function executeMessage(
        CrossChainMessage calldata message
    ) external whenNotPaused nonReentrant returns (bool success, bytes memory returnData) {
        bytes32 messageHash = _hashMessage(message);
        
        // Check if already executed
        if (executedMessages[messageHash]) {
            revert MessageAlreadyExecuted(messageHash);
        }

        // Check if message has expired
        if (block.timestamp > message.timestamp + bridgeConfig.messageTimeout) {
            revert MessageExpired(messageHash, message.timestamp);
        }

        // Verify signatures (simplified for demo)
        require(_verifySignatures(messageHash, message.signatures), "Invalid signatures");

        // Mark as executed before external call
        executedMessages[messageHash] = true;

        // Execute the message
        (success, returnData) = message.target.call(message.payload);

        emit MessageExecuted(messageHash, success, returnData);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function verifySignatures(
        bytes32 messageHash,
        bytes[] calldata signatures
    ) external view returns (bool isValid, uint256 validatorCount) {
        return _verifySignatures(messageHash, signatures) ? (true, signatures.length) : (false, 0);
    }

    /**
     * @dev Internal signature verification (simplified)
     */
    function _verifySignatures(
        bytes32 messageHash,
        bytes[] calldata signatures
    ) internal view returns (bool) {
        if (signatures.length < bridgeConfig.requiredSignatures) {
            return false;
        }
        
        // For demo purposes, just check we have enough signatures
        // In production, you'd verify each signature against validator addresses
        return signatures.length >= bridgeConfig.requiredSignatures;
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function addValidator(address validator, uint256 stake) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(validator != address(0), "Invalid validator address");
        require(!hasRole(VALIDATOR_ROLE, validator), "Already a validator");

        _grantRole(VALIDATOR_ROLE, validator);
        
        validatorInfo[validator] = SimpleValidatorInfo({
            validator: validator,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        validators.push(validator);

        emit ValidatorAdded(validator, stake);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function removeValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(VALIDATOR_ROLE, validator), "Not a validator");

        _revokeRole(VALIDATOR_ROLE, validator);
        validatorInfo[validator].isActive = false;

        // Remove from validators array
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }

        emit ValidatorRemoved(validator, 0);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function slashValidator(
        address validator,
        uint256 amount,
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(VALIDATOR_ROLE, validator), "Not a validator");
        
        validatorInfo[validator].isActive = false;
        
        emit ValidatorSlashed(validator, amount, reason);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function getValidator(address validator) external view returns (ValidatorInfo memory info) {
        SimpleValidatorInfo memory simpleInfo = validatorInfo[validator];
        return ValidatorInfo({
            validator: simpleInfo.validator,
            stake: 0, // Simplified - no stake tracking
            isActive: simpleInfo.isActive,
            joinedAt: simpleInfo.joinedAt,
            lastActivity: block.timestamp,
            slashCount: 0
        });
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function getActiveValidators() external view returns (address[] memory activeValidators) {
        uint256 activeCount = 0;
        
        // Count active validators
        for (uint256 i = 0; i < validators.length; i++) {
            if (validatorInfo[validators[i]].isActive) {
                activeCount++;
            }
        }
        
        // Collect active validators
        activeValidators = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < validators.length; i++) {
            if (validatorInfo[validators[i]].isActive) {
                activeValidators[index] = validators[i];
                index++;
            }
        }
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function getBridgeConfig() external view returns (BridgeConfig memory config) {
        return BridgeConfig({
            requiredSignatures: bridgeConfig.requiredSignatures,
            messageTimeout: bridgeConfig.messageTimeout,
            minStake: 0,
            slashAmount: 0,
            isPaused: bridgeConfig.isPaused
        });
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function isMessageExecuted(bytes32 messageHash) external view returns (bool executed) {
        return executedMessages[messageHash];
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function calculateMessageHash(
        uint256 sourceChainId,
        uint256 targetChainId,
        address sender,
        address target,
        bytes calldata payload,
        uint256 nonce,
        uint256 timestamp
    ) public pure returns (bytes32 messageHash) {
        return keccak256(abi.encode(
            sourceChainId,
            targetChainId,
            sender,
            target,
            payload,
            nonce,
            timestamp
        ));
    }

    /**
     * @dev Hash cross-chain message
     */
    function _hashMessage(CrossChainMessage calldata message) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            message.sourceChainId,
            message.targetChainId,
            message.sender,
            message.target,
            message.payload,
            message.nonce,
            message.timestamp
        ));
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function pauseBridge() external onlyRole(DEFAULT_ADMIN_ROLE) {
        bridgeConfig.isPaused = true;
        _pause();
        emit BridgePaused(msg.sender);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function unpauseBridge() external onlyRole(DEFAULT_ADMIN_ROLE) {
        bridgeConfig.isPaused = false;
        _unpause();
        emit BridgeUnpaused(msg.sender);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function updateBridgeConfig(BridgeConfig calldata newConfig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newConfig.requiredSignatures >= 1, "Invalid required signatures");
        require(newConfig.messageTimeout > 0, "Invalid message timeout");

        bridgeConfig.requiredSignatures = newConfig.requiredSignatures;
        bridgeConfig.messageTimeout = newConfig.messageTimeout;
        bridgeConfig.isPaused = newConfig.isPaused;
    }

    /**
     * @dev Add supported chain
     */
    function addSupportedChain(uint256 chainId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedChains[chainId] = true;
    }

    /**
     * @dev Remove supported chain
     */
    function removeSupportedChain(uint256 chainId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedChains[chainId] = false;
    }

    /**
     * @dev Get supported chains
     */
    function getSupportedChains() external view returns (uint256[] memory chains) {
        // Return hardcoded supported chains for demo
        chains = new uint256[](4);
        chains[0] = 1;        // Ethereum Mainnet
        chains[1] = 11155111; // Ethereum Sepolia
        chains[2] = 2000;     // DogeChain Mainnet
        chains[3] = 568;      // DogeChain Testnet
    }

    /**
     * @dev Emergency withdrawal (only admin, when paused)
     */
    function emergencyWithdraw(address token, uint256 amount, address recipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        whenPaused 
    {
        require(recipient != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).transfer(recipient, amount);
        }
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}