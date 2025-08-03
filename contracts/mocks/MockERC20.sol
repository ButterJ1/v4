// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 token for testing cross-chain swap functionality
 * Includes minting capabilities and faucet functionality for testnet use
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18; // 1000 tokens per request
    uint256 public constant FAUCET_COOLDOWN = 24 hours;    // 24 hour cooldown
    
    /// @dev Mapping to track last faucet request per user
    mapping(address => uint256) public lastFaucetRequest;
    
    /// @dev Maximum supply cap (optional)
    uint256 public maxSupply;
    
    /// @dev Whether faucet is enabled
    bool public faucetEnabled = true;

    event FaucetRequest(address indexed user, uint256 amount);
    event FaucetEnabled(bool enabled);
    event MaxSupplyUpdated(uint256 newMaxSupply);

    error FaucetDisabled();
    error FaucetCooldownActive(uint256 remainingTime);
    error MaxSupplyExceeded(uint256 requested, uint256 available);
    error InvalidDecimals(uint8 decimals);

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply,
        uint256 maxSupply_
    ) ERC20(name, symbol) Ownable(msg.sender) {
        if (decimals_ > 18) {
            revert InvalidDecimals(decimals_);
        }
        
        _decimals = decimals_;
        maxSupply = maxSupply_;
        
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens to a specific address (only owner)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (maxSupply > 0 && totalSupply() + amount > maxSupply) {
            revert MaxSupplyExceeded(amount, maxSupply - totalSupply());
        }
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from a specific address (only owner)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    /**
     * @dev Faucet function for testnet - allows users to request tokens
     */
    function faucet() external {
        if (!faucetEnabled) {
            revert FaucetDisabled();
        }
        
        uint256 lastRequest = lastFaucetRequest[msg.sender];
        if (lastRequest + FAUCET_COOLDOWN > block.timestamp) {
            uint256 remainingTime = (lastRequest + FAUCET_COOLDOWN) - block.timestamp;
            revert FaucetCooldownActive(remainingTime);
        }
        
        if (maxSupply > 0 && totalSupply() + FAUCET_AMOUNT > maxSupply) {
            revert MaxSupplyExceeded(FAUCET_AMOUNT, maxSupply - totalSupply());
        }
        
        lastFaucetRequest[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        
        emit FaucetRequest(msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @dev Bulk faucet for multiple addresses (only owner)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts for each recipient
     */
    function bulkFaucet(
        address[] calldata recipients, 
        uint256[] calldata amounts
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        if (maxSupply > 0 && totalSupply() + totalAmount > maxSupply) {
            revert MaxSupplyExceeded(totalAmount, maxSupply - totalSupply());
        }
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit FaucetRequest(recipients[i], amounts[i]);
        }
    }

    /**
     * @dev Enable/disable faucet functionality (only owner)
     * @param enabled Whether faucet should be enabled
     */
    function setFaucetEnabled(bool enabled) external onlyOwner {
        faucetEnabled = enabled;
        emit FaucetEnabled(enabled);
    }

    /**
     * @dev Update maximum supply (only owner)
     * @param newMaxSupply New maximum supply (0 for unlimited)
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply == 0 || newMaxSupply >= totalSupply(), "Max supply below current supply");
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    /**
     * @dev Get remaining cooldown time for faucet
     * @param user User address to check
     * @return remainingTime Remaining cooldown time in seconds
     */
    function getFaucetCooldown(address user) external view returns (uint256 remainingTime) {
        uint256 lastRequest = lastFaucetRequest[user];
        if (lastRequest + FAUCET_COOLDOWN <= block.timestamp) {
            return 0;
        }
        return (lastRequest + FAUCET_COOLDOWN) - block.timestamp;
    }

    /**
     * @dev Check if user can request from faucet
     * @param user User address to check
     * @return canRequest Whether user can request tokens
     */
    function canRequestFaucet(address user) external view returns (bool canRequest) {
        if (!faucetEnabled) return false;
        
        uint256 lastRequest = lastFaucetRequest[user];
        if (lastRequest + FAUCET_COOLDOWN > block.timestamp) return false;
        
        if (maxSupply > 0 && totalSupply() + FAUCET_AMOUNT > maxSupply) return false;
        
        return true;
    }

    /**
     * @dev Get remaining supply that can be minted
     * @return remaining Remaining supply (0 if unlimited)
     */
    function getRemainingSupply() external view returns (uint256 remaining) {
        if (maxSupply == 0) return type(uint256).max;
        return maxSupply - totalSupply();
    }

    /**
     * @dev Emergency drain function (only owner)
     * Allows owner to drain contract balance in case of emergencies
     */
    function emergencyDrain() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner().call{value: balance}("");
            require(success, "ETH transfer failed");
        }
    }

    /**
     * @dev Recover any ERC20 tokens sent to this contract (only owner)
     * @param token Token contract address
     * @param amount Amount to recover
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}

/**
 * @title MockWETH
 * @dev Mock WETH token for testing wrapped token functionality
 */
contract MockWETH is MockERC20 {
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    constructor() MockERC20("Wrapped Ether", "WETH", 18, 0, 0) {}

    /**
     * @dev Wrap ETH into WETH
     */
    function deposit() external payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Unwrap WETH into ETH
     * @param amount Amount of WETH to unwrap
     */
    function withdraw(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient WETH balance");
        
        _burn(msg.sender, amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawal(msg.sender, amount);
    }
}

/**
 * @title MockDOGE
 * @dev Mock DOGE token for testing DogeChain functionality
 */
contract MockDOGE is MockERC20 {
    constructor() MockERC20(
        "Dogecoin", 
        "DOGE", 
        8,                    // DOGE has 8 decimals
        100000000 * 10**8,    // 100M initial supply
        0                     // No max supply (unlimited like real DOGE)
    ) {}
}