// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ICrossChainHTLC.sol";

/**
 * @title IFusionPlusAdapter
 * @dev Interface for adapting 1inch Fusion+ functionality to cross-chain atomic swaps
 * Enables integration with 1inch limit orders and cross-chain SDK
 */
interface IFusionPlusAdapter {
    /**
     * @dev Cross-chain order structure compatible with Fusion+
     */
    struct CrossChainOrder {
        address maker;              // Order creator
        address taker;              // Order taker (can be zero for any taker)
        address srcToken;           // Source token on source chain
        address dstToken;           // Destination token on destination chain
        uint256 srcAmount;          // Amount of source token
        uint256 dstAmount;          // Amount of destination token
        uint256 srcChainId;         // Source chain ID
        uint256 dstChainId;         // Destination chain ID
        bytes32 hashlock;           // Hash for atomic swap
        uint256 deadline;           // Order expiration timestamp
        uint256 nonce;              // Unique order nonce
        bytes makerSignature;       // Maker's signature
        bytes32 htlcId;             // Associated HTLC contract ID
        OrderState state;           // Current order state
    }

    /**
     * @dev Order states
     */
    enum OrderState {
        INVALID,        // 0 - Default state
        PENDING,        // 1 - Order created, waiting for counterpart
        MATCHED,        // 2 - Order matched, HTLCs created
        COMPLETED,      // 3 - Both sides withdrawn successfully
        CANCELLED,      // 4 - Order cancelled by maker
        EXPIRED,        // 5 - Order expired due to timelock
        DISPUTED        // 6 - Order in dispute state
    }

    /**
     * @dev Resolver information for cross-chain execution
     */
    struct ResolverInfo {
        address resolver;           // Resolver address
        uint256 fee;               // Resolver fee
        bytes resolverData;        // Additional resolver data
        bytes signature;           // Resolver signature
    }

    /**
     * @dev Events
     */
    event CrossChainOrderCreated(
        bytes32 indexed orderId,
        address indexed maker,
        address srcToken,
        address dstToken,
        uint256 srcAmount,
        uint256 dstAmount,
        uint256 srcChainId,
        uint256 dstChainId,
        uint256 deadline
    );

    event CrossChainOrderMatched(
        bytes32 indexed orderId,
        address indexed taker,
        bytes32 srcHTLCId,
        bytes32 dstHTLCId
    );

    event CrossChainOrderCompleted(
        bytes32 indexed orderId,
        bytes32 preimage
    );

    event CrossChainOrderCancelled(
        bytes32 indexed orderId,
        address indexed maker
    );

    event ResolverRegistered(
        address indexed resolver,
        uint256 chainId,
        uint256 fee
    );

    /**
     * @dev Errors
     */
    error OrderAlreadyExists(bytes32 orderId);
    error OrderNotFound(bytes32 orderId);
    error OrderInvalidState(bytes32 orderId, OrderState expected, OrderState actual);
    error OrderExpired(bytes32 orderId, uint256 deadline);
    error OrderInvalidSignature(bytes32 orderId);
    error OrderInvalidAmount(uint256 provided, uint256 expected);
    error ResolverNotAuthorized(address resolver);
    error ResolverInsufficientFee(uint256 provided, uint256 required);

    /**
     * @dev Create a cross-chain order compatible with Fusion+
     * @param srcToken Source token address
     * @param dstToken Destination token address
     * @param srcAmount Source token amount
     * @param dstAmount Destination token amount
     * @param dstChainId Destination chain ID
     * @param hashlock Hash for atomic swap
     * @param deadline Order expiration timestamp
     * @param taker Specific taker address (zero for any)
     * @return orderId Unique order identifier
     */
    function createCrossChainOrder(
        address srcToken,
        address dstToken,
        uint256 srcAmount,
        uint256 dstAmount,
        uint256 dstChainId,
        bytes32 hashlock,
        uint256 deadline,
        address taker
    ) external payable returns (bytes32 orderId);

    /**
     * @dev Take a cross-chain order and create corresponding HTLCs
     * @param orderId Order to take
     * @param resolverInfo Resolver information for execution
     * @return srcHTLCId HTLC ID on source chain
     * @return dstHTLCId HTLC ID on destination chain
     */
    function takeCrossChainOrder(
        bytes32 orderId,
        ResolverInfo calldata resolverInfo
    ) external payable returns (bytes32 srcHTLCId, bytes32 dstHTLCId);

    /**
     * @dev Complete cross-chain order by revealing preimage
     * @param orderId Order to complete
     * @param preimage Secret that unlocks both HTLCs
     */
    function completeCrossChainOrder(
        bytes32 orderId,
        bytes32 preimage
    ) external;

    /**
     * @dev Cancel a cross-chain order (only maker before matching)
     * @param orderId Order to cancel
     */
    function cancelCrossChainOrder(bytes32 orderId) external;

    /**
     * @dev Register as a resolver for cross-chain orders
     * @param chainId Chain ID where resolver operates
     * @param fee Fee charged by resolver
     * @param signature Resolver authorization signature
     */
    function registerResolver(
        uint256 chainId,
        uint256 fee,
        bytes calldata signature
    ) external;

    /**
     * @dev Get cross-chain order details
     * @param orderId Order identifier
     * @return order Order details
     */
    function getCrossChainOrder(bytes32 orderId) external view returns (CrossChainOrder memory order);

    /**
     * @dev Get orders by maker address
     * @param maker Maker address
     * @param limit Maximum number of orders to return
     * @param offset Offset for pagination
     * @return orderIds Array of order IDs
     */
    function getOrdersByMaker(
        address maker,
        uint256 limit,
        uint256 offset
    ) external view returns (bytes32[] memory orderIds);

    /**
     * @dev Check if order can be taken
     * @param orderId Order identifier
     * @return canTake Whether order can be taken
     * @return reason Reason if order cannot be taken
     */
    function canTakeOrder(bytes32 orderId) external view returns (bool canTake, string memory reason);

    /**
     * @dev Calculate order ID from parameters
     * @param maker Order maker
     * @param srcToken Source token
     * @param dstToken Destination token
     * @param srcAmount Source amount
     * @param dstAmount Destination amount
     * @param dstChainId Destination chain ID
     * @param deadline Order deadline
     * @param nonce Order nonce
     * @return orderId Calculated order ID
     */
    function calculateOrderId(
        address maker,
        address srcToken,
        address dstToken,
        uint256 srcAmount,
        uint256 dstAmount,
        uint256 dstChainId,
        uint256 deadline,
        uint256 nonce
    ) external pure returns (bytes32 orderId);

    /**
     * @dev Get supported chains for cross-chain swaps
     * @return chainIds Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory chainIds);

    /**
     * @dev Check if a chain is supported
     * @param chainId Chain ID to check
     * @return supported Whether chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool supported);
}