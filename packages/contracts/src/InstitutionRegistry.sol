// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Community} from "./Community.sol";
import {TokenModule} from "./TokenModule.sol";

/**
 * @title InstitutionRegistry
 * @notice Manages institutions (goods & services providers) within a community.
 *
 * From the mind map:
 *   Institutions → Members, Shares, Property, Votes, Shareholders,
 *                  Positions (Tasks, Members, Rewards)
 *
 * From the pitch deck (slides 20-21, 42):
 *   - Pizza Foundry, Kindergarten, Coffee Shop, etc.
 *   - Each institution tracks: dividends, profitability, revenue, shareholders
 *   - Positions with responsibilities and token compensation
 *   - Role election via community vote (Accept/Decline)
 *
 * Institutions are created via passed governance proposals.
 */
contract InstitutionRegistry {
    // ─── Types ────────────────────────────────────────────────────────

    struct Institution {
        uint256 id;
        string name;
        address community;
        uint256 totalShares;
        bool paysDividends;
        bool active;
        uint256 yearlyRevenue;      // Tracked off-chain, updated periodically
        uint256 createdAt;
    }

    struct Position {
        uint256 id;
        uint256 institutionId;
        string title;               // e.g. "Baker", "Kindergarten Headmaster"
        string responsibilities;    // e.g. "Bake 60 Cupcakes/day"
        uint256 tokenRewardPerDay;  // Compensation in community tokens
        uint256 shareGrant;         // Shares in the institution granted with role
        address holder;             // Current position holder (address(0) = vacant)
        bool active;
    }

    struct Shareholder {
        address member;
        uint256 shares;
    }

    // ─── State ────────────────────────────────────────────────────────

    uint256 public nextInstitutionId;
    uint256 public nextPositionId;

    mapping(uint256 => Institution) public institutions;
    mapping(uint256 => Position) public positions;

    // Institution shareholders: institutionId => member => shares
    mapping(uint256 => mapping(address => uint256)) public shareholdings;
    mapping(uint256 => address[]) public institutionShareholders;

    // Position assignments awaiting acceptance
    mapping(uint256 => address) public pendingAssignments;

    // Community => institution IDs
    mapping(address => uint256[]) public communityInstitutions;

    // ─── Events ───────────────────────────────────────────────────────

    event InstitutionCreated(
        uint256 indexed institutionId,
        address indexed community,
        string name,
        uint256 totalShares
    );

    event SharesAllocated(
        uint256 indexed institutionId,
        address indexed member,
        uint256 shares
    );

    event PositionCreated(
        uint256 indexed positionId,
        uint256 indexed institutionId,
        string title,
        uint256 tokenRewardPerDay
    );

    event PositionOffered(
        uint256 indexed positionId,
        address indexed candidate
    );

    event PositionAccepted(
        uint256 indexed positionId,
        address indexed holder
    );

    event PositionDeclined(
        uint256 indexed positionId,
        address indexed candidate
    );

    event PositionVacated(
        uint256 indexed positionId,
        address indexed previousHolder
    );

    event DividendDistributed(
        uint256 indexed institutionId,
        uint256 totalAmount,
        uint256 shareholderCount
    );

    // ─── Institution Management ───────────────────────────────────────

    /**
     * @notice Create a new institution within a community.
     * @dev Typically called after a governance proposal passes.
     */
    function createInstitution(
        address _community,
        string calldata _name,
        uint256 _totalShares,
        bool _paysDividends
    ) external returns (uint256 institutionId) {
        Community community = Community(_community);
        require(community.initialized(), "Invalid community");
        require(
            community.isFounder(msg.sender) || community.isMember(msg.sender),
            "Not a community member"
        );
        require(bytes(_name).length > 0, "Name required");
        require(_totalShares > 0, "Shares must be > 0");

        institutionId = nextInstitutionId++;

        institutions[institutionId] = Institution({
            id: institutionId,
            name: _name,
            community: _community,
            totalShares: _totalShares,
            paysDividends: _paysDividends,
            active: true,
            yearlyRevenue: 0,
            createdAt: block.timestamp
        });

        communityInstitutions[_community].push(institutionId);

        emit InstitutionCreated(institutionId, _community, _name, _totalShares);
    }

    /**
     * @notice Allocate shares of an institution to a community member.
     * @dev Called during proposal execution to distribute shares to yes-voters.
     */
    function allocateShares(
        uint256 _institutionId,
        address _member,
        uint256 _shares
    ) external {
        Institution storage inst = institutions[_institutionId];
        require(inst.active, "Institution not active");

        Community community = Community(inst.community);
        require(community.isFounder(msg.sender), "Only founders can allocate shares");
        require(community.isMember(_member), "Recipient must be member");

        // Track new shareholder
        if (shareholdings[_institutionId][_member] == 0) {
            institutionShareholders[_institutionId].push(_member);
        }

        shareholdings[_institutionId][_member] += _shares;

        emit SharesAllocated(_institutionId, _member, _shares);
    }

    // ─── Position Management ──────────────────────────────────────────

    /**
     * @notice Create a position within an institution.
     */
    function createPosition(
        uint256 _institutionId,
        string calldata _title,
        string calldata _responsibilities,
        uint256 _tokenRewardPerDay,
        uint256 _shareGrant
    ) external returns (uint256 positionId) {
        Institution storage inst = institutions[_institutionId];
        require(inst.active, "Institution not active");

        Community community = Community(inst.community);
        require(community.isFounder(msg.sender), "Only founders can create positions");

        positionId = nextPositionId++;

        positions[positionId] = Position({
            id: positionId,
            institutionId: _institutionId,
            title: _title,
            responsibilities: _responsibilities,
            tokenRewardPerDay: _tokenRewardPerDay,
            shareGrant: _shareGrant,
            holder: address(0),
            active: true
        });

        emit PositionCreated(positionId, _institutionId, _title, _tokenRewardPerDay);
    }

    /**
     * @notice Offer a position to a community member (via election or appointment).
     */
    function offerPosition(uint256 _positionId, address _candidate) external {
        Position storage pos = positions[_positionId];
        require(pos.active, "Position not active");
        require(pos.holder == address(0), "Position already filled");

        Institution storage inst = institutions[pos.institutionId];
        Community community = Community(inst.community);
        require(community.isFounder(msg.sender), "Only founders can offer positions");
        require(community.isMember(_candidate), "Candidate must be member");

        pendingAssignments[_positionId] = _candidate;

        emit PositionOffered(_positionId, _candidate);
    }

    /**
     * @notice Accept a position offer. Only the offered candidate can accept.
     */
    function acceptPosition(uint256 _positionId) external {
        require(pendingAssignments[_positionId] == msg.sender, "Not offered to you");

        Position storage pos = positions[_positionId];
        pos.holder = msg.sender;
        delete pendingAssignments[_positionId];

        // Grant institutional shares if configured
        if (pos.shareGrant > 0) {
            uint256 instId = pos.institutionId;
            if (shareholdings[instId][msg.sender] == 0) {
                institutionShareholders[instId].push(msg.sender);
            }
            shareholdings[instId][msg.sender] += pos.shareGrant;
            emit SharesAllocated(instId, msg.sender, pos.shareGrant);
        }

        emit PositionAccepted(_positionId, msg.sender);
    }

    /**
     * @notice Decline a position offer.
     */
    function declinePosition(uint256 _positionId) external {
        require(pendingAssignments[_positionId] == msg.sender, "Not offered to you");

        delete pendingAssignments[_positionId];

        emit PositionDeclined(_positionId, msg.sender);
    }

    /**
     * @notice Vacate a position (resign). Only the current holder can vacate.
     */
    function vacatePosition(uint256 _positionId) external {
        Position storage pos = positions[_positionId];
        require(pos.holder == msg.sender, "Not the position holder");

        address prev = pos.holder;
        pos.holder = address(0);

        emit PositionVacated(_positionId, prev);
    }

    // ─── Dividend Distribution ────────────────────────────────────────

    /**
     * @notice Distribute dividends to all shareholders of an institution.
     * @dev The bank calls this with token amounts. Requires token approval.
     */
    function distributeDividends(
        uint256 _institutionId,
        address _tokenAddress,
        uint256 _totalAmount
    ) external {
        Institution storage inst = institutions[_institutionId];
        require(inst.active && inst.paysDividends, "No dividends");

        TokenModule token = TokenModule(_tokenAddress);
        address[] memory holders = institutionShareholders[_institutionId];
        require(holders.length > 0, "No shareholders");

        uint256 totalShares = 0;
        for (uint256 i = 0; i < holders.length; i++) {
            totalShares += shareholdings[_institutionId][holders[i]];
        }
        require(totalShares > 0, "No shares allocated");

        for (uint256 i = 0; i < holders.length; i++) {
            uint256 memberShares = shareholdings[_institutionId][holders[i]];
            if (memberShares > 0) {
                uint256 payout = (_totalAmount * memberShares) / totalShares;
                if (payout > 0) {
                    token.transferFrom(msg.sender, holders[i], payout);
                }
            }
        }

        emit DividendDistributed(_institutionId, _totalAmount, holders.length);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getInstitution(uint256 _id) external view returns (
        string memory name, address community, uint256 totalShares,
        bool paysDividends, bool active, uint256 yearlyRevenue, uint256 createdAt
    ) {
        Institution storage i = institutions[_id];
        return (i.name, i.community, i.totalShares, i.paysDividends, i.active, i.yearlyRevenue, i.createdAt);
    }

    function getPosition(uint256 _id) external view returns (
        uint256 institutionId, string memory title, string memory responsibilities,
        uint256 tokenRewardPerDay, uint256 shareGrant, address holder, bool active
    ) {
        Position storage p = positions[_id];
        return (p.institutionId, p.title, p.responsibilities, p.tokenRewardPerDay, p.shareGrant, p.holder, p.active);
    }

    function getCommunityInstitutions(address _community) external view returns (uint256[] memory) {
        return communityInstitutions[_community];
    }

    function getShareholderCount(uint256 _institutionId) external view returns (uint256) {
        return institutionShareholders[_institutionId].length;
    }

    function getMemberShares(uint256 _institutionId, address _member) external view returns (uint256) {
        return shareholdings[_institutionId][_member];
    }

    function isPositionVacant(uint256 _positionId) external view returns (bool) {
        return positions[_positionId].holder == address(0);
    }

    function getPendingAssignment(uint256 _positionId) external view returns (address) {
        return pendingAssignments[_positionId];
    }
}
