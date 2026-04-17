// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/access/Ownable2Step.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";
import {IERC721} from "openzeppelin-contracts/token/ERC721/IERC721.sol";

/**
 * @title PermissionRegistry
 * @notice Advanced RBAC system supporting both EOAs, agent NFTs (from IdentityRegistry), 
 * and nested SubDAOs/modules. Central permission hub for Aquarius hybrid DAO.
 */
contract PermissionRegistry is Ownable2Step, AccessControl {
    bytes32 public constant MODULE_ADMIN_ROLE = keccak256("MODULE_ADMIN_ROLE");
    bytes32 public constant SUBDAO_ROLE = keccak256("SUBDAO_ROLE");
    
    // Role to contract permissions mapping for fine-grained control
    mapping(bytes32 => mapping(address => bool)) public rolePermissions;
    
    // Support for NFT-based permissions (agent identities)
    mapping(uint256 => mapping(bytes32 => bool)) public nftPermissions;
    address public identityRegistry;
    
    // Nested modules and SubDAOs
    mapping(address => bool) public authorizedModules;
    mapping(address => address) public parentDAO; // For nested hierarchy

    event PermissionGranted(bytes32 indexed role, address indexed account, bool isNFT);
    event PermissionRevoked(bytes32 indexed role, address indexed account, bool isNFT);
    event ModuleAdded(address indexed module, address indexed parent);
    event SubDAORegistered(address indexed subDAO, address indexed parentDAO);

    error InvalidRegistry();
    error Unauthorized();
    error InvalidNFT();

    constructor(address initialOwner) Ownable(initialOwner) Ownable2Step() {
        _transferOwnership(initialOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MODULE_ADMIN_ROLE, initialOwner);
    }

    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        if (_identityRegistry == address(0)) revert InvalidRegistry();
        identityRegistry = _identityRegistry;
    }

    /**
     * @notice Grants a role to an address or an agent NFT ID (encoded as address for compatibility)
     */
    function grantPermission(bytes32 role, address account, bool isNFT) external onlyRole(MODULE_ADMIN_ROLE) {
        if (isNFT) {
            if (identityRegistry == address(0)) revert InvalidRegistry();
            // Verify NFT exists
            try IERC721(identityRegistry).ownerOf(uint256(uint160(account))) {} catch {
                revert InvalidNFT();
            }
            nftPermissions[uint256(uint160(account))][role] = true;
        } else {
            _grantRole(role, account);
            rolePermissions[role][account] = true;
        }
        emit PermissionGranted(role, account, isNFT);
    }

    function revokePermission(bytes32 role, address account, bool isNFT) external onlyRole(MODULE_ADMIN_ROLE) {
        if (isNFT) {
            nftPermissions[uint256(uint160(account))][role] = false;
        } else {
            _revokeRole(role, account);
            rolePermissions[role][account] = false;
        }
        emit PermissionRevoked(role, account, isNFT);
    }

    function hasPermission(bytes32 role, address account, uint256 agentNFTId) public view returns (bool) {
        // Check direct role
        if (hasRole(role, account)) return true;
        
        // Check NFT permission
        if (agentNFTId != 0 && nftPermissions[agentNFTId][role]) {
            return true;
        }
        
        // Check module hierarchy
        if (authorizedModules[account]) return true;
        
        return false;
    }

    function addModule(address module, address parent) external onlyRole(MODULE_ADMIN_ROLE) {
        authorizedModules[module] = true;
        if (parent != address(0)) {
            parentDAO[module] = parent;
        }
        emit ModuleAdded(module, parent);
    }

    function registerSubDAO(address subDAO, address parent) external onlyRole(MODULE_ADMIN_ROLE) {
        _grantRole(SUBDAO_ROLE, subDAO);
        parentDAO[subDAO] = parent;
        emit SubDAORegistered(subDAO, parent);
    }

    // Check if caller is valid agent via NFT ownership + permission
    function isValidAgent(uint256 tokenId, bytes32 requiredRole) external view returns (bool) {
        if (identityRegistry == address(0)) return false;
        address nftOwner = IERC721(identityRegistry).ownerOf(tokenId);
        return hasPermission(requiredRole, nftOwner, tokenId);
    }
}