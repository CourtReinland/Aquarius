// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Community} from "./Community.sol";

/**
 * @title CommunityFactory
 * @notice Factory contract that deploys new Community instances.
 * @dev Each community gets its own contract instance for full isolation.
 */
contract CommunityFactory {
    // ─── State ────────────────────────────────────────────────────────

    address[] public communities;
    mapping(address => bool) public isCommunity;
    mapping(address => address[]) public founderCommunities;  // founder => their communities

    // ─── Events ───────────────────────────────────────────────────────

    event CommunityDeployed(
        address indexed communityAddress,
        string name,
        address[] founders,
        uint256 timestamp
    );

    // ─── Core Functions ───────────────────────────────────────────────

    /**
     * @notice Deploy a new community contract and initialize it.
     * @param _name Community name (e.g. "Cincinnati Skateville")
     * @param _charterIpfsHash IPFS CID of the full charter text
     * @param _founders Array of founder wallet addresses
     * @param _bylaws Initial bylaws configuration
     * @param _legalFramework Legal framework to nest within
     * @param _jurisdiction Jurisdiction for enforcement
     * @param _allowCorporateMembers Whether corporations can join
     * @return communityAddress The address of the newly deployed community
     */
    function createCommunity(
        string calldata _name,
        string calldata _charterIpfsHash,
        address[] calldata _founders,
        Community.Bylaws calldata _bylaws,
        string calldata _legalFramework,
        string calldata _jurisdiction,
        bool _allowCorporateMembers
    ) external returns (address communityAddress) {
        // Deploy new community contract
        Community community = new Community();

        // Initialize it
        community.initialize(
            _name,
            _charterIpfsHash,
            _founders,
            _bylaws,
            _legalFramework,
            _jurisdiction,
            _allowCorporateMembers
        );

        communityAddress = address(community);

        // Track it
        communities.push(communityAddress);
        isCommunity[communityAddress] = true;

        // Track per-founder
        for (uint256 i = 0; i < _founders.length; i++) {
            founderCommunities[_founders[i]].push(communityAddress);
        }

        emit CommunityDeployed(communityAddress, _name, _founders, block.timestamp);

        return communityAddress;
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getCommunityCount() external view returns (uint256) {
        return communities.length;
    }

    function getAllCommunities() external view returns (address[] memory) {
        return communities;
    }

    function getFounderCommunities(address _founder) external view returns (address[] memory) {
        return founderCommunities[_founder];
    }
}
