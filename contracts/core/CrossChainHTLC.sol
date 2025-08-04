// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/ICrossChainHTLC.sol";

/**
 * @title CrossChainHTLC
 * @dev Hash Time Locked Contract implementation for cross-chain atomic swaps
 * Supports both native tokens (ETH/DOGE) and ERC20 tokens
 * Optimized for Ethereum-DogeChain integration with 1inch Fusion+
 */
contract CrossChainHTLC is ICrossChainHTLC, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    /// @dev Mapping from contract ID to HTLC details
    mapping(bytes32 => HTLCContract) private contracts;
    
    /// @dev Mapping to track which secrets have been revealed
    mapping(bytes32 => bytes32) public revealedSecrets;
    
    /// @dev Mapping from user to their contract IDs
    mapping(address => bytes32[]) private userContracts;
    
    /// @dev Minimum timelock duration (1 hour)
    uint256 public constant MIN_TIMELOCK = 3600;
    
    /// @dev Maximum timelock duration (30 days)
    uint256 public constant MAX_TIMELOCK = 30 days;
    
    /// @dev Current chain ID
    uint256 public immutable CHAIN_ID;
    
    /// @dev Protocol fee in basis points (1% = 100)
    uint256 public protocolFee = 10; // 0.1%
    
    /// @dev Protocol fee recipient
    address public feeRecipient;
    
    /// @dev Total number of contracts created
    uint256 public totalContracts;

    modifier validTimelock(uint256 timelock) {
        if (timelock <= block.timestamp + MIN_TIMELOCK) {
            revert HTLCInvalidTimelock(timelock, block.timestamp + MIN_TIMELOCK);
        }
        if (timelock > block.timestamp + MAX_TIMELOCK) {
            revert HTLCInvalidTimelock(timelock, block.timestamp + MAX_TIMELOCK);
        }
        _;
    }

    modifier contractMustExist(bytes32 contractId) {
        if (contracts[contractId].state == HTLCState.INVALID) {
            revert HTLCNotFound(contractId);
        }
        _;
    }

    modifier inState(bytes32 contractId, HTLCState expectedState) {
        HTLCState currentState = contracts[contractId].state;
        if (currentState != expectedState) {
            revert HTLCInvalidState(contractId, expectedState, currentState);
        }
        _;
    }

    constructor(address _feeRecipient) Ownable(msg.sender) {
        CHAIN_ID = block.chainid;
        feeRecipient = _feeRecipient;
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function createHTLC(
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        bytes32 counterpartId
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        validTimelock(timelock)
        returns (bytes32 contractId) 
    {
        if (recipient == address(0)) {
            revert HTLCUnauthorized(recipient, msg.sender);
        }
        
        if (amount == 0) {
            revert HTLCInsufficientBalance(1, 0);
        }

        if (hashlock == bytes32(0)) {
            revert HTLCInvalidHashlock(hashlock, bytes32(uint256(1)));
        }

        // Calculate contract ID
        contractId = calculateContractId(
            msg.sender,
            recipient,
            token,
            amount,
            hashlock,
            timelock
        );

        // Check if contract already exists
        if (contracts[contractId].state != HTLCState.INVALID) {
            revert HTLCAlreadyExists(contractId);
        }

        // Calculate protocol fee
        uint256 fee = (amount * protocolFee) / 10000;
        uint256 netAmount = amount - fee;

        // Handle token transfer
        if (token == address(0)) {
            // Native token (ETH/DOGE)
            if (msg.value != amount) {
                revert HTLCInsufficientBalance(amount, msg.value);
            }
            
            // Send fee to recipient
            if (fee > 0 && feeRecipient != address(0)) {
                (bool success, ) = feeRecipient.call{value: fee}("");
                if (!success) {
                    revert HTLCTransferFailed(address(0), feeRecipient, fee);
                }
            }
        } else {
            // ERC20 token
            if (msg.value != 0) {
                revert HTLCInsufficientBalance(0, msg.value);
            }
            
            // Check allowance first
            if (IERC20(token).allowance(msg.sender, address(this)) < amount) {
                revert HTLCInsufficientBalance(amount, IERC20(token).allowance(msg.sender, address(this)));
            }
            
            // Transfer tokens from sender
            IERC20(token).safeTransferFrom(msg.sender, address(this), netAmount);
            
            // Transfer fee
            if (fee > 0 && feeRecipient != address(0)) {
                IERC20(token).safeTransferFrom(msg.sender, feeRecipient, fee);
            }
        }

        // Create contract
        contracts[contractId] = HTLCContract({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: netAmount,
            hashlock: hashlock,
            timelock: timelock,
            state: HTLCState.ACTIVE,
            createdAt: block.timestamp,
            chainId: CHAIN_ID,
            counterpartId: counterpartId
        });

        // Track user contracts
        userContracts[msg.sender].push(contractId);
        userContracts[recipient].push(contractId);
        
        totalContracts++;

        emit HTLCCreated(
            contractId,
            msg.sender,
            recipient,
            token,
            netAmount,
            hashlock,
            timelock,
            CHAIN_ID,
            counterpartId
        );
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function withdraw(bytes32 contractId, bytes32 preimage) 
        external 
        nonReentrant 
        whenNotPaused
        contractMustExist(contractId) 
        inState(contractId, HTLCState.ACTIVE) 
    {
        HTLCContract storage htlc = contracts[contractId];
        
        // Verify caller is the recipient
        if (msg.sender != htlc.recipient) {
            revert HTLCUnauthorized(msg.sender, htlc.recipient);
        }
        
        // Verify preimage produces the hashlock
        bytes32 hashedPreimage = keccak256(abi.encodePacked(preimage));
        if (hashedPreimage != htlc.hashlock) {
            revert HTLCInvalidHashlock(hashedPreimage, htlc.hashlock);
        }
        
        // Check timelock hasn't expired
        if (block.timestamp >= htlc.timelock) {
            revert HTLCNotExpired(contractId, block.timestamp, htlc.timelock);
        }

        // Update state
        htlc.state = HTLCState.WITHDRAWN;
        revealedSecrets[contractId] = preimage;

        // Transfer funds
        _transferFunds(htlc.token, htlc.recipient, htlc.amount);

        emit HTLCWithdrawn(contractId, htlc.recipient, preimage, htlc.amount);
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function refund(bytes32 contractId) 
        external 
        nonReentrant 
        whenNotPaused
        contractMustExist(contractId) 
        inState(contractId, HTLCState.ACTIVE) 
    {
        HTLCContract storage htlc = contracts[contractId];
        
        // Verify caller is the sender
        if (msg.sender != htlc.sender) {
            revert HTLCUnauthorized(msg.sender, htlc.sender);
        }
        
        // Check timelock has expired
        if (block.timestamp < htlc.timelock) {
            revert HTLCNotExpired(contractId, block.timestamp, htlc.timelock);
        }

        // Update state
        htlc.state = HTLCState.REFUNDED;

        // Transfer funds back to sender
        _transferFunds(htlc.token, htlc.sender, htlc.amount);

        emit HTLCRefunded(contractId, htlc.sender, htlc.amount);
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function getHTLC(bytes32 contractId) 
        external 
        view 
        contractMustExist(contractId) 
        returns (HTLCContract memory contract_) 
    {
        return contracts[contractId];
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function contractExists(bytes32 contractId) 
        external 
        view 
        returns (bool exists, bool isActive) 
    {
        exists = contracts[contractId].state != HTLCState.INVALID;
        isActive = contracts[contractId].state == HTLCState.ACTIVE;
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function getContractState(bytes32 contractId) 
        external 
        view 
        returns (HTLCState state) 
    {
        return contracts[contractId].state;
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function hasTimelockExpired(bytes32 contractId) 
        external 
        view 
        contractMustExist(contractId) 
        returns (bool expired) 
    {
        return block.timestamp >= contracts[contractId].timelock;
    }

    /**
     * @inheritdoc ICrossChainHTLC
     */
    function calculateContractId(
        address sender,
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    ) public pure returns (bytes32 contractId) {
        return keccak256(abi.encodePacked(
            sender,
            recipient,
            token,
            amount,
            hashlock,
            timelock
        ));
    }

    /**
     * @dev Get contracts created by or for a user
     * @param user User address
     * @return contractIds Array of contract IDs
     */
    function getUserContracts(address user) external view returns (bytes32[] memory contractIds) {
        return userContracts[user];
    }

    /**
     * @dev Get revealed secret for a contract
     * @param contractId Contract ID
     * @return secret Revealed secret (zero if not revealed)
     */
    function getRevealedSecret(bytes32 contractId) external view returns (bytes32 secret) {
        return revealedSecrets[contractId];
    }

    /**
     * @dev Get contract balance
     * @param token Token address (0x0 for native)
     * @return balance Contract balance
     */
    function getContractBalance(address token) external view returns (uint256 balance) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @dev Internal function to transfer funds
     * @param token Token address (0x0 for native)
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function _transferFunds(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            // Native token transfer
            (bool success, ) = to.call{value: amount}("");
            if (!success) {
                revert HTLCTransferFailed(token, to, amount);
            }
        } else {
            // ERC20 token transfer
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @dev Update protocol fee (only owner)
     * @param newFee New fee in basis points
     */
    function setProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high"); // Max 5%
        protocolFee = newFee;
    }

    /**
     * @dev Update fee recipient (only owner)
     * @param newRecipient New fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    /**
     * @dev Pause contract (emergency function)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal function (only owner, when paused)
     * @param contractId Contract to emergency withdraw from
     */
    function emergencyWithdraw(bytes32 contractId) 
        external 
        onlyOwner 
        whenPaused 
        contractMustExist(contractId) 
    {
        HTLCContract storage htlc = contracts[contractId];
        require(htlc.state == HTLCState.ACTIVE, "Contract not active");
        
        htlc.state = HTLCState.REFUNDED;
        _transferFunds(htlc.token, htlc.sender, htlc.amount);
        
        emit HTLCRefunded(contractId, htlc.sender, htlc.amount);
    }

    /**
     * @dev Get contract statistics
     * @return totalContracts_ Total contracts created
     * @return activeContracts Total active contracts
     * @return totalVolume Total volume processed
     */
    function getStatistics() external view returns (
        uint256 totalContracts_,
        uint256 activeContracts,
        uint256 totalVolume
    ) {
        totalContracts_ = totalContracts;
        
        // This is simplified - in production you'd maintain counters
        activeContracts = 0;
        totalVolume = 0;
        
        // In production, these would be maintained as state variables
        // for gas efficiency rather than calculated on-demand
    }

    /**
     * @dev Batch create multiple HTLCs (gas efficient)
     * @param recipients Array of recipient addresses
     * @param tokens Array of token addresses
     * @param amounts Array of amounts
     * @param hashlocks Array of hashlocks
     * @param timelocks Array of timelocks
     * @param counterpartIds Array of counterpart IDs
     * @return contractIds Array of created contract IDs
     */
    function batchCreateHTLC(
        address[] calldata recipients,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata hashlocks,
        uint256[] calldata timelocks,
        bytes32[] calldata counterpartIds
    ) external payable nonReentrant whenNotPaused returns (bytes32[] memory contractIds) {
        require(recipients.length == tokens.length, "Array length mismatch");
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length == hashlocks.length, "Array length mismatch");
        require(recipients.length == timelocks.length, "Array length mismatch");
        require(recipients.length == counterpartIds.length, "Array length mismatch");
        
        contractIds = new bytes32[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            // Note: This is a simplified implementation
            // In production, you'd handle native token transfers more carefully
            contractIds[i] = this.createHTLC{value: tokens[i] == address(0) ? amounts[i] : 0}(
                recipients[i],
                tokens[i],
                amounts[i],
                hashlocks[i],
                timelocks[i],
                counterpartIds[i]
            );
        }
    }
}