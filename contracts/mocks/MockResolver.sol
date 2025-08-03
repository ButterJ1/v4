// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IFusionPlusAdapter.sol";
import "../interfaces/ICrossChainHTLC.sol";

/**
 * @title MockResolver
 * @dev Mock resolver for testing Fusion+ cross-chain functionality
 * Simulates resolver behavior for demo purposes
 */
contract MockResolver is Ownable, ReentrancyGuard {
    /// @dev Resolver information
    struct ResolverData {
        string name;
        uint256 fee;              // Fee in basis points (1% = 100)
        uint256 minAmount;        // Minimum order amount
        uint256 maxAmount;        // Maximum order amount
        bool isActive;
        uint256 totalVolume;      // Total volume resolved
        uint256 successfulOrders; // Number of successful orders
        uint256 failedOrders;     // Number of failed orders
    }

    /// @dev Order execution result
    struct ExecutionResult {
        bool success;
        uint256 executedAmount;
        uint256 feeCharged;
        uint256 executionTime;
        string failureReason;
    }

    /// @dev Supported chain configuration
    struct ChainSupport {
        uint256 chainId;
        bool isSupported;
        uint256 gasCost;
        uint256 avgExecutionTime;
    }

    /// @dev Resolver data
    ResolverData public resolverInfo;
    
    /// @dev Supported chains
    mapping(uint256 => ChainSupport) public supportedChains;
    uint256[] public chainList;
    
    /// @dev Order execution history
    mapping(bytes32 => ExecutionResult) public executionHistory;
    
    /// @dev Simulated balances for different tokens/chains
    mapping(uint256 => mapping(address => uint256)) public simulatedBalances;
    
    /// @dev Performance metrics
    uint256 public averageExecutionTime = 30; // 30 seconds average
    uint256 public successRate = 9500;        // 95% success rate
    
    /// @dev Events
    event OrderResolved(
        bytes32 indexed orderId,
        address indexed maker,
        address indexed taker,
        uint256 amount,
        uint256 fee,
        bool success
    );
    
    event ChainSupportUpdated(uint256 indexed chainId, bool supported);
    event ResolverConfigUpdated(string name, uint256 fee, bool isActive);
    event BalanceUpdated(uint256 indexed chainId, address indexed token, uint256 amount);

    /// @dev Errors
    error ResolverInactive();
    error OrderTooSmall(uint256 amount, uint256 minimum);
    error OrderTooLarge(uint256 amount, uint256 maximum);
    error ChainNotSupported(uint256 chainId);
    error InsufficientBalance(uint256 required, uint256 available);
    error ExecutionFailed(string reason);

    constructor(
        string memory _name,
        uint256 _fee,
        uint256 _minAmount,
        uint256 _maxAmount
    ) Ownable(msg.sender) {
        resolverInfo = ResolverData({
            name: _name,
            fee: _fee,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            isActive: true,
            totalVolume: 0,
            successfulOrders: 0,
            failedOrders: 0
        });
        
        // Add default chain support (Ethereum Sepolia and DogeChain Testnet)
        _addChainSupport(11155111, true, 0.001 ether, 15); // Ethereum Sepolia
        _addChainSupport(568, true, 0.00001 ether, 5);     // DogeChain Testnet
    }

    /**
     * @dev Simulate resolving a cross-chain order
     * @param orderId Order ID to resolve
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param amount Order amount
     * @param maker Order maker
     * @param taker Order taker
     * @return result Execution result
     */
    function resolveOrder(
        bytes32 orderId,
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 amount,
        address maker,
        address taker
    ) external nonReentrant returns (ExecutionResult memory result) {
        if (!resolverInfo.isActive) {
            revert ResolverInactive();
        }
        
        if (amount < resolverInfo.minAmount) {
            revert OrderTooSmall(amount, resolverInfo.minAmount);
        }
        
        if (amount > resolverInfo.maxAmount) {
            revert OrderTooLarge(amount, resolverInfo.maxAmount);
        }
        
        if (!supportedChains[sourceChain].isSupported) {
            revert ChainNotSupported(sourceChain);
        }
        
        if (!supportedChains[destinationChain].isSupported) {
            revert ChainNotSupported(destinationChain);
        }

        // Simulate execution
        result = _simulateExecution(orderId, amount, sourceChain, destinationChain);
        
        // Update metrics
        resolverInfo.totalVolume += amount;
        if (result.success) {
            resolverInfo.successfulOrders++;
        } else {
            resolverInfo.failedOrders++;
        }
        
        // Store execution result
        executionHistory[orderId] = result;
        
        emit OrderResolved(orderId, maker, taker, amount, result.feeCharged, result.success);
    }

    /**
     * @dev Get quote for resolving an order
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param amount Order amount
     * @return fee Fee amount
     * @return estimatedTime Estimated execution time in seconds
     * @return canExecute Whether resolver can execute this order
     */
    function getQuote(
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 amount
    ) external view returns (
        uint256 fee,
        uint256 estimatedTime,
        bool canExecute
    ) {
        if (!resolverInfo.isActive) {
            return (0, 0, false);
        }
        
        if (amount < resolverInfo.minAmount || amount > resolverInfo.maxAmount) {
            return (0, 0, false);
        }
        
        if (!supportedChains[sourceChain].isSupported || 
            !supportedChains[destinationChain].isSupported) {
            return (0, 0, false);
        }
        
        fee = (amount * resolverInfo.fee) / 10000;
        estimatedTime = averageExecutionTime + 
                       supportedChains[sourceChain].avgExecutionTime +
                       supportedChains[destinationChain].avgExecutionTime;
        canExecute = true;
    }

    /**
     * @dev Check resolver capacity for multiple orders
     * @param amounts Array of order amounts
     * @return canExecuteAll Whether resolver can handle all orders
     * @return totalFee Total fee for all orders
     */
    function checkCapacity(
        uint256[] calldata amounts
    ) external view returns (bool canExecuteAll, uint256 totalFee) {
        if (!resolverInfo.isActive) {
            return (false, 0);
        }
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] < resolverInfo.minAmount || amounts[i] > resolverInfo.maxAmount) {
                return (false, 0);
            }
            totalAmount += amounts[i];
            totalFee += (amounts[i] * resolverInfo.fee) / 10000;
        }
        
        // Check if total amount doesn't exceed daily limit (simplified)
        canExecuteAll = totalAmount <= resolverInfo.maxAmount * 10;
    }

    /**
     * @dev Simulate order execution (internal)
     */
    function _simulateExecution(
        bytes32 orderId,
        uint256 amount,
        uint256 sourceChain,
        uint256 destinationChain
    ) private view returns (ExecutionResult memory result) {
        // Simulate success/failure based on success rate
        uint256 random = uint256(keccak256(abi.encodePacked(
            orderId, block.timestamp, block.prevrandao
        ))) % 10000;
        
        result.success = random < successRate;
        result.executionTime = block.timestamp;
        result.feeCharged = (amount * resolverInfo.fee) / 10000;
        
        if (result.success) {
            result.executedAmount = amount - result.feeCharged;
            result.failureReason = "";
        } else {
            result.executedAmount = 0;
            // Simulate different failure reasons
            if (random % 4 == 0) {
                result.failureReason = "Insufficient liquidity";
            } else if (random % 4 == 1) {
                result.failureReason = "Network congestion";
            } else if (random % 4 == 2) {
                result.failureReason = "Slippage too high";
            } else {
                result.failureReason = "Timeout";
            }
        }
    }

    /**
     * @dev Update resolver configuration (only owner)
     */
    function updateResolverConfig(
        string calldata _name,
        uint256 _fee,
        uint256 _minAmount,
        uint256 _maxAmount,
        bool _isActive
    ) external onlyOwner {
        resolverInfo.name = _name;
        resolverInfo.fee = _fee;
        resolverInfo.minAmount = _minAmount;
        resolverInfo.maxAmount = _maxAmount;
        resolverInfo.isActive = _isActive;
        
        emit ResolverConfigUpdated(_name, _fee, _isActive);
    }

    /**
     * @dev Add or update chain support
     */
    function updateChainSupport(
        uint256 chainId,
        bool supported,
        uint256 gasCost,
        uint256 avgExecutionTime
    ) external onlyOwner {
        _addChainSupport(chainId, supported, gasCost, avgExecutionTime);
        emit ChainSupportUpdated(chainId, supported);
    }

    /**
     * @dev Internal function to add chain support
     */
    function _addChainSupport(
        uint256 chainId,
        bool supported,
        uint256 gasCost,
        uint256 avgExecutionTime
    ) private {
        if (!supportedChains[chainId].isSupported && supported) {
            chainList.push(chainId);
        }
        
        supportedChains[chainId] = ChainSupport({
            chainId: chainId,
            isSupported: supported,
            gasCost: gasCost,
            avgExecutionTime: avgExecutionTime
        });
    }

    /**
     * @dev Set simulated balance for testing
     */
    function setSimulatedBalance(
        uint256 chainId,
        address token,
        uint256 amount
    ) external onlyOwner {
        simulatedBalances[chainId][token] = amount;
        emit BalanceUpdated(chainId, token, amount);
    }

    /**
     * @dev Update performance metrics
     */
    function updatePerformanceMetrics(
        uint256 _averageExecutionTime,
        uint256 _successRate
    ) external onlyOwner {
        require(_successRate <= 10000, "Success rate cannot exceed 100%");
        averageExecutionTime = _averageExecutionTime;
        successRate = _successRate;
    }

    /**
     * @dev Get supported chains
     */
    function getSupportedChains() external view returns (uint256[] memory chains) {
        uint256 supportedCount = 0;
        for (uint256 i = 0; i < chainList.length; i++) {
            if (supportedChains[chainList[i]].isSupported) {
                supportedCount++;
            }
        }
        
        chains = new uint256[](supportedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < chainList.length; i++) {
            if (supportedChains[chainList[i]].isSupported) {
                chains[index] = chainList[i];
                index++;
            }
        }
    }

    /**
     * @dev Get resolver statistics
     */
    function getStatistics() external view returns (
        uint256 totalVolume,
        uint256 successfulOrders,
        uint256 failedOrders,
        uint256 currentSuccessRate,
        uint256 avgExecutionTime
    ) {
        totalVolume = resolverInfo.totalVolume;
        successfulOrders = resolverInfo.successfulOrders;
        failedOrders = resolverInfo.failedOrders;
        
        if (successfulOrders + failedOrders > 0) {
            currentSuccessRate = (successfulOrders * 10000) / (successfulOrders + failedOrders);
        } else {
            currentSuccessRate = successRate;
        }
        
        avgExecutionTime = averageExecutionTime;
    }

    /**
     * @dev Emergency pause/unpause resolver
     */
    function setActive(bool _isActive) external onlyOwner {
        resolverInfo.isActive = _isActive;
        emit ResolverConfigUpdated(resolverInfo.name, resolverInfo.fee, _isActive);
    }

    /**
     * @dev Get execution result for an order
     */
    function getExecutionResult(bytes32 orderId) external view returns (ExecutionResult memory) {
        return executionHistory[orderId];
    }
}