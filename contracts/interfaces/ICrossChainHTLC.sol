// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ICrossChainHTLC
 * @dev Interface for Cross-Chain Hash Time Locked Contracts
 * Extends 1inch Fusion+ functionality for Ethereum-DogeChain atomic swaps
 */
interface ICrossChainHTLC {
    /**
     * @dev HTLC States
     */
    enum HTLCState {
        INVALID,    // 0 - Default state, contract doesn't exist
        ACTIVE,     // 1 - Contract is active and waiting for withdrawal
        WITHDRAWN,  // 2 - Funds have been withdrawn by recipient
        REFUNDED    // 3 - Funds have been refunded to sender
    }

    /**
     * @dev HTLC Contract Structure
     */
    struct HTLCContract {
        address sender;           // Creator of the HTLC
        address recipient;        // Intended recipient of funds
        address token;            // Token contract address (0x0 for native ETH/DOGE)
        uint256 amount;           // Amount locked in contract
        bytes32 hashlock;         // Hash of the secret (SHA256 or Keccak256)
        uint256 timelock;         // Block timestamp after which refund is possible
        HTLCState state;          // Current state of the contract
        uint256 createdAt;        // Block timestamp when contract was created
        uint256 chainId;          // Chain ID where this contract exists
        bytes32 counterpartId;    // ID of the corresponding contract on other chain
    }

    /**
     * @dev Events
     */
    event HTLCCreated(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        uint256 chainId,
        bytes32 counterpartId
    );

    event HTLCWithdrawn(
        bytes32 indexed contractId,
        address indexed recipient,
        bytes32 preimage,
        uint256 amount
    );

    event HTLCRefunded(
        bytes32 indexed contractId,
        address indexed sender,
        uint256 amount
    );

    event HTLCExpired(
        bytes32 indexed contractId,
        uint256 expiredAt
    );

    /**
     * @dev Errors
     */
    error HTLCAlreadyExists(bytes32 contractId);
    error HTLCNotFound(bytes32 contractId);
    error HTLCInvalidState(bytes32 contractId, HTLCState expected, HTLCState actual);
    error HTLCInvalidHashlock(bytes32 provided, bytes32 expected);
    error HTLCInvalidTimelock(uint256 provided, uint256 minimum);
    error HTLCNotExpired(bytes32 contractId, uint256 currentTime, uint256 timelock);
    error HTLCUnauthorized(address caller, address expected);
    error HTLCInsufficientBalance(uint256 required, uint256 available);
    error HTLCTransferFailed(address token, address to, uint256 amount);

    /**
     * @dev Create a new HTLC contract
     * @param recipient Address that can withdraw the funds
     * @param token Token contract address (0x0 for native currency)
     * @param amount Amount to lock in the contract
     * @param hashlock Hash of the secret required for withdrawal
     * @param timelock Block timestamp after which refund is possible
     * @param counterpartId ID of the corresponding contract on other chain
     * @return contractId Unique identifier for the HTLC contract
     */
    function createHTLC(
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        bytes32 counterpartId
    ) external payable returns (bytes32 contractId);

    /**
     * @dev Withdraw funds from HTLC by providing the preimage
     * @param contractId ID of the HTLC contract
     * @param preimage Secret that hashes to the hashlock
     */
    function withdraw(bytes32 contractId, bytes32 preimage) external;

    /**
     * @dev Refund funds from expired HTLC back to sender
     * @param contractId ID of the HTLC contract
     */
    function refund(bytes32 contractId) external;

    /**
     * @dev Get HTLC contract details
     * @param contractId ID of the HTLC contract
     * @return contract_ The HTLC contract details
     */
    function getHTLC(bytes32 contractId) external view returns (HTLCContract memory contract_);

    /**
     * @dev Check if HTLC contract exists and is active
     * @param contractId ID of the HTLC contract
     * @return exists Whether the contract exists
     * @return isActive Whether the contract is in ACTIVE state
     */
    function contractExists(bytes32 contractId) external view returns (bool exists, bool isActive);

    /**
     * @dev Get the state of an HTLC contract
     * @param contractId ID of the HTLC contract
     * @return state Current state of the contract
     */
    function getContractState(bytes32 contractId) external view returns (HTLCState state);

    /**
     * @dev Check if a timelock has expired
     * @param contractId ID of the HTLC contract
     * @return expired Whether the timelock has expired
     */
    function hasTimelockExpired(bytes32 contractId) external view returns (bool expired);

    /**
     * @dev Calculate contract ID from parameters
     * @param sender Address of the sender
     * @param recipient Address of the recipient
     * @param token Token contract address
     * @param amount Amount to lock
     * @param hashlock Hash of the secret
     * @param timelock Timelock timestamp
     * @return contractId The calculated contract ID
     */
    function calculateContractId(
        address sender,
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    ) external pure returns (bytes32 contractId);
}