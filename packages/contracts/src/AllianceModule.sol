// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Community} from "./Community.sol";

/**
 * @title AllianceModule
 * @notice Manages inter-community alliances.
 *
 * From the pitch deck (slide 50, mockup 11):
 *   - Communities can form alliances
 *   - Members inherit rights/benefits from allied communities
 *   - Alliances can be broken via vote
 *
 * Alliance flow:
 *   1. Community A proposes alliance with Community B
 *   2. Community B reviews and accepts/declines
 *   3. On accept: members of both communities gain specified benefits
 *   4. Either community can propose to dissolve the alliance
 */
contract AllianceModule {
    // ─── Types ────────────────────────────────────────────────────────

    enum AllianceStatus { Proposed, Active, Dissolved }

    struct Alliance {
        uint256 id;
        address communityA;
        address communityB;
        string terms;              // IPFS hash of full terms
        uint256 tokenGrantPerMember; // Tokens each member inherits
        bool freeTravel;           // Can members travel freely
        bool votingRights;         // Voting rights on certain proposals
        AllianceStatus status;
        uint256 createdAt;
    }

    // ─── State ────────────────────────────────────────────────────────

    uint256 public nextAllianceId;
    mapping(uint256 => Alliance) public alliances;
    mapping(address => uint256[]) public communityAlliances;

    // ─── Events ───────────────────────────────────────────────────────

    event AllianceProposed(uint256 indexed id, address indexed from, address indexed to);
    event AllianceAccepted(uint256 indexed id);
    event AllianceDeclined(uint256 indexed id);
    event AllianceDissolved(uint256 indexed id, address indexed dissolver);

    // ─── Core Functions ───────────────────────────────────────────────

    function proposeAlliance(
        address _communityA,
        address _communityB,
        string calldata _terms,
        uint256 _tokenGrantPerMember,
        bool _freeTravel,
        bool _votingRights
    ) external returns (uint256 allianceId) {
        Community a = Community(_communityA);
        require(a.isFounder(msg.sender), "Only founders can propose alliances");
        require(_communityA != _communityB, "Cannot ally with self");

        allianceId = nextAllianceId++;

        alliances[allianceId] = Alliance({
            id: allianceId,
            communityA: _communityA,
            communityB: _communityB,
            terms: _terms,
            tokenGrantPerMember: _tokenGrantPerMember,
            freeTravel: _freeTravel,
            votingRights: _votingRights,
            status: AllianceStatus.Proposed,
            createdAt: block.timestamp
        });

        emit AllianceProposed(allianceId, _communityA, _communityB);
    }

    function acceptAlliance(uint256 _allianceId) external {
        Alliance storage a = alliances[_allianceId];
        require(a.status == AllianceStatus.Proposed, "Not proposed");

        Community b = Community(a.communityB);
        require(b.isFounder(msg.sender), "Only target founders can accept");

        a.status = AllianceStatus.Active;
        communityAlliances[a.communityA].push(_allianceId);
        communityAlliances[a.communityB].push(_allianceId);

        emit AllianceAccepted(_allianceId);
    }

    function declineAlliance(uint256 _allianceId) external {
        Alliance storage a = alliances[_allianceId];
        require(a.status == AllianceStatus.Proposed, "Not proposed");

        Community b = Community(a.communityB);
        require(b.isFounder(msg.sender), "Only target founders can decline");

        a.status = AllianceStatus.Dissolved;
        emit AllianceDeclined(_allianceId);
    }

    function dissolveAlliance(uint256 _allianceId) external {
        Alliance storage a = alliances[_allianceId];
        require(a.status == AllianceStatus.Active, "Not active");

        Community commA = Community(a.communityA);
        Community commB = Community(a.communityB);
        require(
            commA.isFounder(msg.sender) || commB.isFounder(msg.sender),
            "Only founders can dissolve"
        );

        a.status = AllianceStatus.Dissolved;
        emit AllianceDissolved(_allianceId, msg.sender);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getAlliance(uint256 _id) external view returns (
        address communityA, address communityB, AllianceStatus status,
        uint256 tokenGrantPerMember, bool freeTravel, bool votingRights
    ) {
        Alliance storage a = alliances[_id];
        return (a.communityA, a.communityB, a.status, a.tokenGrantPerMember, a.freeTravel, a.votingRights);
    }

    function getCommunityAlliances(address _community) external view returns (uint256[] memory) {
        return communityAlliances[_community];
    }

    function isAllied(address _a, address _b) external view returns (bool) {
        uint256[] memory aAlliances = communityAlliances[_a];
        for (uint256 i = 0; i < aAlliances.length; i++) {
            Alliance storage al = alliances[aAlliances[i]];
            if (al.status == AllianceStatus.Active) {
                if ((al.communityA == _a && al.communityB == _b) ||
                    (al.communityA == _b && al.communityB == _a)) {
                    return true;
                }
            }
        }
        return false;
    }
}
