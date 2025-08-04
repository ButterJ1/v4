// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../interfaces/IFusionPlusAdapter.sol";
import "../interfaces/ICrossChainHTLC.sol";
import "../libraries/CrossChainUtils.sol";
import "../libraries/HTLCUtils.sol";

/**
 * @title FusionPlusAdapter
 * @dev Adapter contract to integrate 1inch Fusion+ with cross-chain atomic swaps
 * Enables cross-chain limit orders and seamless integration with existing 1inch infrastructure
 */
contract FusionPlusAdapter is IFusionPlusAdapter, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @dev HTLC contract interface
    ICrossChainHTLC public immutable htlcContract;
    
    /// @dev Current chain ID
    uint256 public immutable CHAIN_ID;
    
    /// @dev Domain separator for EIP-712 signatures
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    /// @dev Order type hash for EIP-712
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "CrossChainOrder(address maker,address taker,address srcToken,address dstToken,uint256 srcAmount,uint256 dstAmount,uint256 srcChainId,uint256 dstChainId,bytes32 hashlock,uint256 deadline,uint256 nonce)"
    );

    /// @dev Mapping from order ID to order details
    mapping(bytes32 => CrossChainOrder) public orders;
    
    /// @dev Mapping from maker to their nonces
    mapping(address => uint256) public nonces;
    
    /// @dev Mapping from resolver to their registration status
    mapping(address => mapping(uint256 => bool)) public registeredResolvers;
    
    /// @dev Mapping from resolver to their fee structure
    mapping(address => mapping(uint256 => uint256)) public resolverFees;
    
    /// @dev Supported chains for cross-chain operations
    mapping(uint256 => bool) public supportedChains;
    uint256[] public chainList;
    
    /// @dev Order counters for statistics
    uint256 public totalOrders;
    uint256 public completedOrders;
    uint256 public cancelledOrders;
    
    /// @dev Protocol fee settings
    uint256 public protocolFeeBps = 10; // 0.1%
    address public feeRecipient;
    
    /// @dev Minimum timelock for cross-chain orders
    uint256 public constant MIN_ORDER_TIMELOCK = 2 hours;

    /// @dev Order ID tracking for enumeration
    bytes32[] public orderIds;
    mapping(address => bytes32[]) public makerOrders;

    modifier validChain(uint256 chainId) {
        if (!supportedChains[chainId]) {
            revert OrderInvalidAmount(chainId, 0); // Reusing error for chain validation
        }
        _;
    }

    modifier orderExists(bytes32 orderId) {
        if (orders[orderId].state == OrderState.INVALID) {
            revert OrderNotFound(orderId);
        }
        _;
    }

    modifier inOrderState(bytes32 orderId, OrderState expectedState) {
        OrderState currentState = orders[orderId].state;
        if (currentState != expectedState) {
            revert OrderInvalidState(orderId, expectedState, currentState);
        }
        _;
    }

    constructor(
        address _htlcContract,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_htlcContract != address(0), "Invalid HTLC contract");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        htlcContract = ICrossChainHTLC(_htlcContract);
        CHAIN_ID = block.chainid;
        feeRecipient = _feeRecipient;
        
        // Set up EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("FusionPlusAdapter")),
            keccak256(bytes("1")),
            CHAIN_ID,
            address(this)
        ));
        
        // Add default supported chains
        _addSupportedChain(11155111); // Ethereum Sepolia
        _addSupportedChain(568);      // DogeChain Testnet
    }

    /**
     * @inheritdoc IFusionPlusAdapter
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
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        validChain(dstChainId)
        returns (bytes32 orderId) 
    {
        // Validation
        if (deadline <= block.timestamp + MIN_ORDER_TIMELOCK) {
            revert OrderExpired(bytes32(0), deadline);
        }
        
        if (srcAmount == 0 || dstAmount == 0) {
            revert OrderInvalidAmount(0, 1);
        }
        
        if (dstChainId == CHAIN_ID) {
            revert OrderInvalidAmount(dstChainId, CHAIN_ID);
        }

        if (hashlock == bytes32(0)) {
            revert OrderInvalidSignature(bytes32(0));
        }

        // Generate order ID
        uint256 nonce = nonces[msg.sender]++;
        orderId = calculateOrderId(
            msg.sender,
            srcToken,
            dstToken,
            srcAmount,
            dstAmount,
            dstChainId,
            deadline,
            nonce
        );

        // Check if order already exists
        if (orders[orderId].state != OrderState.INVALID) {
            revert OrderAlreadyExists(orderId);
        }

        // Handle token transfer
        if (srcToken == address(0)) {
            // Native token
            if (msg.value != srcAmount) {
                revert OrderInvalidAmount(msg.value, srcAmount);
            }
        } else {
            // ERC20 token
            if (msg.value != 0) {
                revert OrderInvalidAmount(msg.value, 0);
            }
            
            // Check allowance
            if (IERC20(srcToken).allowance(msg.sender, address(this)) < srcAmount) {
                revert OrderInvalidAmount(IERC20(srcToken).allowance(msg.sender, address(this)), srcAmount);
            }
            
            IERC20(srcToken).safeTransferFrom(msg.sender, address(this), srcAmount);
        }

        // Create order
        orders[orderId] = CrossChainOrder({
            maker: msg.sender,
            taker: taker,
            srcToken: srcToken,
            dstToken: dstToken,
            srcAmount: srcAmount,
            dstAmount: dstAmount,
            srcChainId: CHAIN_ID,
            dstChainId: dstChainId,
            hashlock: hashlock,
            deadline: deadline,
            nonce: nonce,
            makerSignature: "",
            htlcId: bytes32(0),
            state: OrderState.PENDING
        });

        // Track orders
        orderIds.push(orderId);
        makerOrders[msg.sender].push(orderId);
        totalOrders++;

        emit CrossChainOrderCreated(
            orderId,
            msg.sender,
            srcToken,
            dstToken,
            srcAmount,
            dstAmount,
            CHAIN_ID,
            dstChainId,
            deadline
        );
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function takeCrossChainOrder(
        bytes32 orderId,
        ResolverInfo calldata resolverInfo
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused
        orderExists(orderId)
        inOrderState(orderId, OrderState.PENDING)
        returns (bytes32 srcHTLCId, bytes32 dstHTLCId) 
    {
        CrossChainOrder storage order = orders[orderId];
        
        // Check order validity
        if (block.timestamp >= order.deadline) {
            revert OrderExpired(orderId, order.deadline);
        }
        
        if (order.taker != address(0) && order.taker != msg.sender) {
            revert ResolverNotAuthorized(msg.sender);
        }

        // Validate resolver (simplified for demo)
        if (resolverInfo.resolver == address(0)) {
            revert ResolverNotAuthorized(resolverInfo.resolver);
        }

        // Calculate timelocks for both chains
        (uint256 srcTimelock, uint256 dstTimelock) = CrossChainUtils.calculateOptimalTimelocks(
            order.srcChainId,
            order.dstChainId,
            HTLCUtils.DEFAULT_TIMELOCK_DURATION
        );

        // Create HTLC on source chain (this chain)
        if (order.srcToken == address(0)) {
            srcHTLCId = htlcContract.createHTLC{value: order.srcAmount}(
                msg.sender,              // Taker can withdraw source tokens
                order.srcToken,
                order.srcAmount,
                order.hashlock,
                srcTimelock,
                bytes32(uint256(uint160(msg.sender))) // Use taker address as counterpart ID for demo
            );
        } else {
            // For ERC20, need to approve HTLC contract first
            IERC20(order.srcToken).approve(address(htlcContract), order.srcAmount);
            srcHTLCId = htlcContract.createHTLC(
                msg.sender,
                order.srcToken,
                order.srcAmount,
                order.hashlock,
                srcTimelock,
                bytes32(uint256(uint160(msg.sender)))
            );
        }

        // For demo purposes, simulate destination HTLC creation
        // In production, this would be handled by cross-chain messaging
        dstHTLCId = keccak256(abi.encodePacked(
            orderId,
            msg.sender,
            order.dstChainId,
            block.timestamp
        ));

        // Store HTLC reference and update state
        order.htlcId = srcHTLCId;
        order.state = OrderState.MATCHED;

        emit CrossChainOrderMatched(orderId, msg.sender, srcHTLCId, dstHTLCId);
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function completeCrossChainOrder(
        bytes32 orderId,
        bytes32 preimage
    ) 
        external 
        nonReentrant 
        whenNotPaused
        orderExists(orderId)
        inOrderState(orderId, OrderState.MATCHED) 
    {
        CrossChainOrder storage order = orders[orderId];
        
        // Verify preimage
        if (HTLCUtils.generateHashlock(preimage) != order.hashlock) {
            revert OrderInvalidSignature(orderId);
        }

        // Complete HTLC withdrawal - this will revert if conditions aren't met
        htlcContract.withdraw(order.htlcId, preimage);
        
        // Update order state
        order.state = OrderState.COMPLETED;
        completedOrders++;

        emit CrossChainOrderCompleted(orderId, preimage);
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function cancelCrossChainOrder(bytes32 orderId) 
        external 
        nonReentrant 
        whenNotPaused
        orderExists(orderId) 
    {
        CrossChainOrder storage order = orders[orderId];
        
        if (order.maker != msg.sender) {
            revert ResolverNotAuthorized(msg.sender);
        }
        
        if (order.state != OrderState.PENDING) {
            revert OrderInvalidState(orderId, OrderState.PENDING, order.state);
        }

        // Refund tokens to maker
        if (order.srcToken == address(0)) {
            (bool success, ) = order.maker.call{value: order.srcAmount}("");
            require(success, "ETH refund failed");
        } else {
            IERC20(order.srcToken).safeTransfer(order.maker, order.srcAmount);
        }

        order.state = OrderState.CANCELLED;
        cancelledOrders++;

        emit CrossChainOrderCancelled(orderId, order.maker);
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function registerResolver(
        uint256 chainId,
        uint256 fee,
        bytes calldata signature
    ) external validChain(chainId) {
        // For demo purposes, simplified registration
        // In production, this would verify resolver credentials and stake
        registeredResolvers[msg.sender][chainId] = true;
        resolverFees[msg.sender][chainId] = fee;

        emit ResolverRegistered(msg.sender, chainId, fee);
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function getCrossChainOrder(bytes32 orderId) 
        external 
        view 
        orderExists(orderId) 
        returns (CrossChainOrder memory order) 
    {
        return orders[orderId];
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function getOrdersByMaker(
        address maker,
        uint256 limit,
        uint256 offset
    ) external view returns (bytes32[] memory orderIds_) {
        bytes32[] memory allMakerOrders = makerOrders[maker];
        
        if (offset >= allMakerOrders.length) {
            return new bytes32[](0);
        }
        
        uint256 end = offset + limit;
        if (end > allMakerOrders.length) {
            end = allMakerOrders.length;
        }
        
        uint256 length = end - offset;
        orderIds_ = new bytes32[](length);
        
        for (uint256 i = 0; i < length; i++) {
            orderIds_[i] = allMakerOrders[offset + i];
        }
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function canTakeOrder(bytes32 orderId) 
        external 
        view 
        orderExists(orderId) 
        returns (bool canTake, string memory reason) 
    {
        CrossChainOrder memory order = orders[orderId];
        
        if (order.state != OrderState.PENDING) {
            return (false, "Order not in pending state");
        }
        
        if (block.timestamp >= order.deadline) {
            return (false, "Order expired");
        }
        
        if (!supportedChains[order.dstChainId]) {
            return (false, "Destination chain not supported");
        }
        
        return (true, "");
    }

    /**
     * @inheritdoc IFusionPlusAdapter
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
    ) public pure returns (bytes32 orderId) {
        return keccak256(abi.encode(
            maker,
            srcToken,
            dstToken,
            srcAmount,
            dstAmount,
            dstChainId,
            deadline,
            nonce
        ));
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function getSupportedChains() external view returns (uint256[] memory chainIds) {
        uint256 supportedCount = 0;
        for (uint256 i = 0; i < chainList.length; i++) {
            if (supportedChains[chainList[i]]) {
                supportedCount++;
            }
        }
        
        chainIds = new uint256[](supportedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < chainList.length; i++) {
            if (supportedChains[chainList[i]]) {
                chainIds[index] = chainList[i];
                index++;
            }
        }
    }

    /**
     * @inheritdoc IFusionPlusAdapter
     */
    function isChainSupported(uint256 chainId) external view returns (bool supported) {
        return supportedChains[chainId];
    }

    /**
     * @dev Get all orders with pagination
     * @param limit Maximum number of orders to return
     * @param offset Offset for pagination
     * @return orderIds_ Array of order IDs
     * @return totalCount Total number of orders
     */
    function getAllOrders(
        uint256 limit,
        uint256 offset
    ) external view returns (bytes32[] memory orderIds_, uint256 totalCount) {
        totalCount = orderIds.length;
        
        if (offset >= totalCount) {
            return (new bytes32[](0), totalCount);
        }
        
        uint256 end = offset + limit;
        if (end > totalCount) {
            end = totalCount;
        }
        
        uint256 length = end - offset;
        orderIds_ = new bytes32[](length);
        
        for (uint256 i = 0; i < length; i++) {
            orderIds_[i] = orderIds[offset + i];
        }
    }

    /**
     * @dev Add supported chain (only owner)
     */
    function addSupportedChain(uint256 chainId) external onlyOwner {
        _addSupportedChain(chainId);
    }

    /**
     * @dev Remove supported chain (only owner)
     */
    function removeSupportedChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
    }

    /**
     * @dev Internal function to add supported chain
     */
    function _addSupportedChain(uint256 chainId) private {
        if (!supportedChains[chainId]) {
            supportedChains[chainId] = true;
            chainList.push(chainId);
        }
    }

    /**
     * @dev Update protocol fee (only owner)
     */
    function setProtocolFee(uint256 feeBps) external onlyOwner {
        require(feeBps <= 500, "Fee too high"); // Max 5%
        protocolFeeBps = feeBps;
    }

    /**
     * @dev Update fee recipient (only owner)
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
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
     * @dev Get order statistics
     */
    function getOrderStatistics() external view returns (
        uint256 total,
        uint256 completed,
        uint256 cancelled,
        uint256 pending
    ) {
        total = totalOrders;
        completed = completedOrders;
        cancelled = cancelledOrders;
        pending = totalOrders - completedOrders - cancelledOrders;
    }

    /**
     * @dev Handle expired orders (can be called by anyone for cleanup)
     * @param orderId Order to expire
     */
    function expireOrder(bytes32 orderId) external orderExists(orderId) {
        CrossChainOrder storage order = orders[orderId];
        
        require(order.state == OrderState.PENDING, "Order not pending");
        require(block.timestamp >= order.deadline, "Order not expired yet");
        
        // Refund tokens to maker
        if (order.srcToken == address(0)) {
            (bool success, ) = order.maker.call{value: order.srcAmount}("");
            require(success, "ETH refund failed");
        } else {
            IERC20(order.srcToken).safeTransfer(order.maker, order.srcAmount);
        }
        
        order.state = OrderState.EXPIRED;
        
        emit CrossChainOrderCancelled(orderId, order.maker);
    }

    /**
     * @dev Emergency withdrawal function (only owner, when paused)
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyOwner 
        whenPaused 
    {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}