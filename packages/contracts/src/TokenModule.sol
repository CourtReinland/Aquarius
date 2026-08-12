// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Community} from "./Community.sol";

/**
 * @title TokenModule
 * @notice ERC-20 community currency with configurable banking rules.
 *
 * Implements the banking system from the mind map:
 *   Bank → Banking Style (Austrian/Keynesian), Fractional Reserve,
 *          Starting Tokens, Leverage Ratio
 *
 * And the pitch deck Banking Setup screen (slide 19/mockup 12):
 *   - Starting Token Amount
 *   - Banking Style: Austrian (Strict) / Keynesian (Fractional Reserve)
 *   - Allow Arbitrary Token Creation (Y/N)
 *   - Allow Fractional Lending (Y/N)
 *   - Allowed Banking Leverage Ratio (1/1 → 9/1)
 *
 * Each community deploys its own TokenModule = its own currency.
 */
contract TokenModule {
    // ─── ERC-20 State ─────────────────────────────────────────────────

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ─── Banking Config ───────────────────────────────────────────────

    enum BankingStyle { Austrian, Keynesian }

    struct BankingConfig {
        BankingStyle style;
        bool allowArbitraryCreation;
        bool allowFractionalLending;
        uint8 leverageRatio;        // 1-9 (multiplier)
        uint256 maxSupply;          // 0 = no hard cap (Keynesian), >0 = hard cap (Austrian)
    }

    BankingConfig public bankingConfig;
    address public community;       // The community this token belongs to
    address public bank;            // The bank controller (multi-sig or governance)
    bool public initialized;

    /// @notice Address that deployed this token instance.
    /// @dev Only the deployer may call `initialize` (deploy+init should be atomic).
    address public immutable deployer;

    // ─── ERC-20 Events ────────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ─── Banking Events ───────────────────────────────────────────────

    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount);
    event BankConfigUpdated(BankingStyle style, uint8 leverageRatio);

    // ─── Modifiers ────────────────────────────────────────────────────

    modifier onlyBank() {
        require(msg.sender == bank, "Only bank");
        _;
    }

    modifier onlyCommunityFounder() {
        Community c = Community(community);
        require(c.isFounder(msg.sender), "Not a founder");
        _;
    }

    // ─── Initialization ───────────────────────────────────────────────

    constructor() {
        deployer = msg.sender;
    }

    /**
     * @notice Initialize the community token and mint initial supply.
     * @dev Only callable by the deployer. Prefer deploy+initialize in one tx
     *      so bank/community cannot be frontrun-initialized by a third party.
     * @param _name Token name (e.g. "Skateville Coin")
     * @param _symbol Token symbol (e.g. "SKATE")
     * @param _community The community contract this token belongs to
     * @param _bank The bank controller address
     * @param _initialSupply Starting token amount (in whole tokens, will be * 10^18)
     * @param _config Banking configuration
     */
    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _community,
        address _bank,
        uint256 _initialSupply,
        BankingConfig calldata _config
    ) external {
        require(msg.sender == deployer, "Only deployer");
        require(!initialized, "Already initialized");
        require(bytes(_name).length > 0, "Name required");
        require(_community != address(0), "Invalid community");
        require(_bank != address(0), "Invalid bank");
        require(_config.leverageRatio >= 1 && _config.leverageRatio <= 9, "Leverage 1-9");

        name = _name;
        symbol = _symbol;
        community = _community;
        bank = _bank;
        bankingConfig = _config;
        initialized = true;

        // Mint initial supply to the bank
        uint256 amount = _initialSupply * 10 ** decimals;
        totalSupply = amount;
        balanceOf[_bank] = amount;

        if (_config.style == BankingStyle.Austrian) {
            bankingConfig.maxSupply = amount; // Hard cap at initial supply
        } else {
            // Keynesian: store initial supply as base for leverage calculations
            bankingConfig.maxSupply = amount;
        }

        emit Transfer(address(0), _bank, amount);
        emit TokensMinted(_bank, amount, "Initial supply");
    }

    // ─── ERC-20 Functions ─────────────────────────────────────────────

    function transfer(address _to, uint256 _value) external returns (bool) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        require(_to != address(0), "Invalid recipient");

        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) external returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(
        address _from, address _to, uint256 _value
    ) external returns (bool) {
        require(balanceOf[_from] >= _value, "Insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "Insufficient allowance");
        require(_to != address(0), "Invalid recipient");

        balanceOf[_from] -= _value;
        allowance[_from][msg.sender] -= _value;
        balanceOf[_to] += _value;

        emit Transfer(_from, _to, _value);
        return true;
    }

    // ─── Banking Functions ────────────────────────────────────────────

    /**
     * @notice Mint new tokens. Respects banking style rules.
     * @dev Only the bank can mint. Austrian style blocks minting beyond maxSupply.
     */
    function mint(address _to, uint256 _amount, string calldata _reason) external onlyBank {
        require(_to != address(0), "Invalid recipient");

        if (bankingConfig.style == BankingStyle.Austrian) {
            require(
                bankingConfig.allowArbitraryCreation,
                "Austrian: arbitrary creation disabled"
            );
            require(
                totalSupply + _amount <= bankingConfig.maxSupply,
                "Austrian: exceeds max supply"
            );
        }

        // Keynesian: check leverage ratio
        if (bankingConfig.style == BankingStyle.Keynesian && !bankingConfig.allowArbitraryCreation) {
            // Total supply cannot exceed initialBank * leverageRatio
            // This is a simplified fractional reserve check
            uint256 maxAllowed = bankingConfig.maxSupply * bankingConfig.leverageRatio;
            require(totalSupply + _amount <= maxAllowed, "Exceeds leverage ratio");
        }

        totalSupply += _amount;
        balanceOf[_to] += _amount;

        emit Transfer(address(0), _to, _amount);
        emit TokensMinted(_to, _amount, _reason);
    }

    /**
     * @notice Burn tokens from the caller's balance.
     */
    function burn(uint256 _amount) external {
        require(balanceOf[msg.sender] >= _amount, "Insufficient balance");

        balanceOf[msg.sender] -= _amount;
        totalSupply -= _amount;

        emit Transfer(msg.sender, address(0), _amount);
        emit TokensBurned(msg.sender, _amount);
    }

    /**
     * @notice Distribute tokens from bank to a community member (e.g. salary payment).
     */
    function distributeSalary(
        address _member,
        uint256 _amount,
        string calldata _role
    ) external onlyBank {
        require(balanceOf[bank] >= _amount, "Bank insufficient funds");

        balanceOf[bank] -= _amount;
        balanceOf[_member] += _amount;

        emit Transfer(bank, _member, _amount);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getBankBalance() external view returns (uint256) {
        return balanceOf[bank];
    }

    function getBankingStyle() external view returns (string memory) {
        return bankingConfig.style == BankingStyle.Austrian ? "Austrian (Strict)" : "Keynesian (Fractional Reserve)";
    }

    function getMaxSupply() external view returns (uint256) {
        return bankingConfig.maxSupply;
    }

    function canMint(uint256 _amount) external view returns (bool) {
        if (bankingConfig.style == BankingStyle.Austrian) {
            if (!bankingConfig.allowArbitraryCreation) return false;
            return totalSupply + _amount <= bankingConfig.maxSupply;
        }
        if (!bankingConfig.allowArbitraryCreation) {
            uint256 maxAllowed = bankingConfig.maxSupply * bankingConfig.leverageRatio;
            return totalSupply + _amount <= maxAllowed;
        }
        return true;
    }
}
