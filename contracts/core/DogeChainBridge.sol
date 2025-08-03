// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../interfaces/IBridgeValidator.sol";
import "../libraries/CrossChainUtils.sol";

/**
 * @title DogeChainBridge
 * @dev Simplified bridge implementation for Ethereum-DogeChain cross-chain communication
 * Handles message passing and token transfers between chains for atomic swap coordination
 */
contract DogeChainBridge is IBridgeValidator, ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @dev Role definitions
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @dev Bridge configuration
    BridgeConfig public bridgeConfig;
    
    /// @dev Validator information mapping
    mapping(address => ValidatorInfo) public validators;
    address[] public validatorList;
    
    /// @dev Executed messages tracking
    mapping(bytes32 => bool) public executedMessages;
    
    /// @dev Message nonce tracking per chain
    mapping(uint256 => uint256) public chainNonces;
    
    /// @dev Supported chains
    mapping(uint256 => bool) public supportedChains;
    
    /// @dev Token mappings between chains
    mapping(uint256 => mapping(address => address)) public tokenMappings;
    
    /// @dev Pending withdrawals (for security delays)
    mapping(bytes32 => uint256) public pendingWithdrawals;
    
    /// @dev Constants
    uint256 public constant SECURITY_DELAY = 1 hours;
    uint256 public constant MAX_VALIDATORS = 21;
    uint256 public constant MIN_VALIDATORS = 3;

    /// @dev Events
    event BridgeConfigUpdated(
        uint256 requiredSignatures,
        uint256 messageTimeout,
        uint256 minStake,
        uint256 slashAmount
    );
    
    event TokenMappingAdded(
        uint256 indexed sourceChain,
        address indexed sourceToken,
        uint256 indexed targetChain,
        address targetToken
    );

    modifier onlyValidator() {
        require(hasRole(VALIDATOR_ROLE, msg.sender), "Not a validator");
        require(validators[msg.sender].isActive, "Validator not active");
        _;
    }

    modifier validChain(uint256 chainId) {
        require(supportedChains[chainId], "Chain not supported");
        _;
    }

    constructor(
        uint256 _requiredSignatures,
        uint256 _messageTimeout,
        uint256 _minStake,
        uint256 _slashAmount
    ) {
        require(_requiredSignatures >= 1, "Invalid required signatures");
        require(_messageTimeout > 0, "Invalid message timeout");
        require(_minStake > 0, "Invalid minimum stake");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        bridgeConfig = BridgeConfig({
            requiredSignatures: _requiredSignatures,
            messageTimeout: _messageTimeout,
            minStake: _minStake,
            slashAmount: _slashAmount,
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
    ) 
        external 
        whenNotPaused 
        validChain(targetChainId) 
        returns (bytes32 messageHash) 
    {
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
    ) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (bool success, bytes memory returnData) 
    {
        bytes32 messageHash = hashCrossChainMessage(message);
        
        // Check if already executed
        if (executedMessages[messageHash]) {
            revert MessageAlreadyExecuted(messageHash);
        }

        // Check if message has expired
        if (block.timestamp > message.timestamp + bridgeConfig.messageTimeout) {
            revert MessageExpired(messageHash, message.timestamp);
        }

        // Verify signatures
        (bool isValid, uint256 validatorCount) = verifySignatures(messageHash, message.signatures);
        if (!isValid || validatorCount < bridgeConfig.requiredSignatures) {
            revert InsufficientSignatures(validatorCount, bridgeConfig.requiredSignatures);
        }

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
    ) public view returns (bool isValid, uint256 validatorCount) {
        if (signatures.length == 0) {
            return (false, 0);
        }

        // Create the Ethereum signed message hash manually
        bytes32 ethSignedMessageHash = _toEthSignedMessageHash(messageHash);
        address[] memory signers = new address[](signatures.length);
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ethSignedMessageHash.recover(signatures[i]);
            
            // Check if signer is a validator and is active
            if (!hasRole(VALIDATOR_ROLE, signer) || !validators[signer].isActive) {
                continue;
            }
            
            // Check for duplicate signers
            bool isDuplicate = false;
            for (uint256 j = 0; j < validatorCount; j++) {
                if (signers[j] == signer) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                signers[validatorCount] = signer;
                validatorCount++;
            }
        }
        
        isValid = validatorCount >= bridgeConfig.requiredSignatures;
    }

    /**
     * @dev Internal function to create Ethereum signed message hash
     * @param hash Original hash
     * @return Ethereum signed message hash
     */
    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function addValidator(address validator, uint256 stake) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(validator != address(0), "Invalid validator address");
        require(stake >= bridgeConfig.minStake, "Insufficient stake");
        require(validatorList.length < MAX_VALIDATORS, "Too many validators");
        require(!hasRole(VALIDATOR_ROLE, validator), "Already a validator");

        _grantRole(VALIDATOR_ROLE, validator);
        
        validators[validator] = ValidatorInfo({
            validator: validator,
            stake: stake,
            isActive: true,
            joinedAt: block.timestamp,
            lastActivity: block.timestamp,
            slashCount: 0
        });
        
        validatorList.push(validator);

        emit ValidatorAdded(validator, stake);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function removeValidator(address validator) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(hasRole(VALIDATOR_ROLE, validator), "Not a validator");
        require(validatorList.length > MIN_VALIDATORS, "Too few validators");

        _revokeRole(VALIDATOR_ROLE, validator);
        validators[validator].isActive = false;

        // Remove from validator list
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validatorList[i] == validator) {
                validatorList[i] = validatorList[validatorList.length - 1];
                validatorList.pop();
                break;
            }
        }

        uint256 stakedAmount = validators[validator].stake;
        validators[validator].stake = 0;

        emit ValidatorRemoved(validator, stakedAmount);
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
        require(amount <= validators[validator].stake, "Slash amount too high");

        validators[validator].stake -= amount;
        validators[validator].slashCount++;

        // Deactivate if stake falls below minimum
        if (validators[validator].stake < bridgeConfig.minStake) {
            validators[validator].isActive = false;
        }

        emit ValidatorSlashed(validator, amount, reason);
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function getValidator(address validator) 
        external 
        view 
        returns (ValidatorInfo memory info) 
    {
        return validators[validator];
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function getActiveValidators() external view returns (address[] memory activeValidators) {
        uint256 activeCount = 0;
        
        // Count active validators
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Collect active validators
        activeValidators = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeValidators[index] = validatorList[i];
                index++;
            }
        }
    }

    /**
     * @inheritdoc IBridgeValidator
     */
    function getBridgeConfig() external view returns (BridgeConfig memory config) {
        return bridgeConfig;
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
    function hashCrossChainMessage(
        CrossChainMessage calldata message
    ) public pure returns (bytes32 messageHash) {
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
    function updateBridgeConfig(BridgeConfig calldata newConfig) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newConfig.requiredSignatures >= 1, "Invalid required signatures");
        require(newConfig.messageTimeout > 0, "Invalid message timeout");
        require(newConfig.minStake > 0, "Invalid minimum stake");

        bridgeConfig = newConfig;

        emit BridgeConfigUpdated(
            newConfig.requiredSignatures,
            newConfig.messageTimeout,
            newConfig.minStake,
            newConfig.slashAmount
        );
    }

    /**
     * @dev Add token mapping between chains
     */
    function addTokenMapping(
        uint256 sourceChain,
        address sourceToken,
        uint256 targetChain,
        address targetToken
    ) external onlyRole(OPERATOR_ROLE) {
        require(supportedChains[sourceChain], "Source chain not supported");
        require(supportedChains[targetChain], "Target chain not supported");
        require(sourceToken != address(0) || targetToken != address(0), "Invalid token addresses");

        tokenMappings[sourceChain][sourceToken] = targetToken;

        emit TokenMappingAdded(sourceChain, sourceToken, targetChain, targetToken);
    }

    /**
     * @dev Get token mapping
     */
    function getTokenMapping(uint256 sourceChain, address sourceToken) 
        external 
        view 
        returns (address targetToken) 
    {
        return tokenMappings[sourceChain][sourceToken];
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
     * @dev Update validator activity (called by validators periodically)
     */
    function updateActivity() external onlyValidator {
        validators[msg.sender].lastActivity = block.timestamp;
    }

    /**
     * @dev Check if validator is active and responsive
     */
    function isValidatorHealthy(address validator) external view returns (bool healthy) {
        if (!hasRole(VALIDATOR_ROLE, validator) || !validators[validator].isActive) {
            return false;
        }
        
        // Check if validator has been active in the last 24 hours
        return validators[validator].lastActivity + 86400 > block.timestamp;
    }

    /**
     * @dev Get bridge statistics
     */
    function getBridgeStatistics() external view returns (
        uint256 totalValidators,
        uint256 activeValidators,
        uint256 totalMessages,
        uint256 supportedChainCount
    ) {
        totalValidators = validatorList.length;
        
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeValidators++;
            }
        }
        
        // In a real implementation, we'd track message counts
        totalMessages = 0; // Placeholder
        
        // Count supported chains
        uint256[] memory allChains = new uint256[](4);
        allChains[0] = 1;        // Ethereum Mainnet
        allChains[1] = 11155111; // Ethereum Sepolia
        allChains[2] = 2000;     // DogeChain Mainnet
        allChains[3] = 568;      // DogeChain Testnet
        
        for (uint256 i = 0; i < allChains.length; i++) {
            if (supportedChains[allChains[i]]) {
                supportedChainCount++;
            }
        }
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        require(recipient != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}