// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "openzeppelin-contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/access/Ownable2Step.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-721 NFT registry for AI/Human agent identities in Aquarius DAO.
 * Compatible with ERC-6551 for token-bound accounts enabling autonomous execution.
 * Follows ERC-8004 style for agent identities.
 */
contract IdentityRegistry is ERC721, ERC721URIStorage, Ownable2Step, AccessControl {
    bytes32 public constant REGISTERER_ROLE = keccak256("REGISTERER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    uint256 private _nextTokenId;
    mapping(uint256 => address) public agentToTBA; // For ERC6551 compatibility

    event AgentRegistered(uint256 indexed tokenId, address indexed owner, string agentURI);
    event TBAAssigned(uint256 indexed tokenId, address tba);

    error InvalidURI();
    error NotAuthorized();

    constructor(address initialOwner) 
        ERC721("AquariusAgent", "AQUAAGENT")
        Ownable(initialOwner) Ownable2Step()
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(REGISTERER_ROLE, initialOwner);
        _grantRole(VALIDATOR_ROLE, initialOwner);
    }

    /**
     * @notice Registers a new agent by minting an NFT identity with metadata URI
     * @param agentURI IPFS or Arweave URI for agent metadata (personality, capabilities, etc.)
     * @return tokenId The ID of the newly minted agent NFT
     */
    function registerAgent(string calldata agentURI) external onlyRole(REGISTERER_ROLE) returns (uint256) {
        if (bytes(agentURI).length == 0) revert InvalidURI();
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, agentURI);
        
        // ERC6551 TBA can be created via separate registry call (see IERC6551Registry)
        emit AgentRegistered(tokenId, msg.sender, agentURI);
        return tokenId;
    }

    /**
     * @notice Assigns a Token Bound Account (ERC6551) to an agent NFT
     */
    function assignTBA(uint256 tokenId, address tba) external onlyRole(VALIDATOR_ROLE) {
        require(ownerOf(tokenId) != address(0), "Nonexistent token");
        agentToTBA[tokenId] = tba;
        emit TBAAssigned(tokenId, tba);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Override for Ownable2Step + AccessControl compatibility
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        return super._update(to, tokenId, auth);
    }
}