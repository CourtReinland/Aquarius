// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/access/Ownable2Step.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";
import {IERC721} from "openzeppelin-contracts/token/ERC721/IERC721.sol";

/**
 * @title ReputationRegistry
 * @notice Tracks reputation scores for agents and humans in the Aquarius DAO.
 * Scores are updated only via validated actions from ValidationRegistry or authorized modules.
 */
contract ReputationRegistry is Ownable2Step, AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    mapping(address => uint256) public reputationScores;
    mapping(address => uint256) public lastUpdated;
    mapping(address => uint256) public actionCount;

    uint256 public constant MAX_REPUTATION = 10000;
    uint256 public constant DEFAULT_REPUTATION = 100;

    event ReputationUpdated(address indexed agent, uint256 newScore, string actionType, uint256 change);
    event ReputationReset(address indexed agent, uint256 oldScore);

    error InvalidScore();
    error UnauthorizedUpdater();
    error InvalidAgent();

    constructor(address initialOwner) Ownable(initialOwner) Ownable2Step() {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(UPDATER_ROLE, initialOwner);
        _grantRole(VALIDATOR_ROLE, initialOwner);
    }

    /**
     * @notice Updates reputation based on validated actions (only from authorized registries)
     * @param agent The agent or human address/NFT owner
     * @param scoreDelta The change in reputation (positive or negative)
     * @param actionType Description of the action (e.g., "proposal_passed", "validation_success")
     */
    function updateReputation(address agent, int256 scoreDelta, string calldata actionType) 
        public 
        onlyRole(UPDATER_ROLE) 
    {
        if (agent == address(0)) revert InvalidAgent();
        
        uint256 current = reputationScores[agent];
        uint256 newScore;
        
        if (scoreDelta < 0 && uint256(-scoreDelta) > current) {
            newScore = 0;
        } else {
            newScore = uint256(int256(current) + scoreDelta);
            if (newScore > MAX_REPUTATION) newScore = MAX_REPUTATION;
        }
        
        reputationScores[agent] = newScore;
        lastUpdated[agent] = block.timestamp;
        actionCount[agent]++;
        
        emit ReputationUpdated(agent, newScore, actionType, uint256(scoreDelta > 0 ? scoreDelta : -scoreDelta));
    }

    function getReputation(address agent) external view returns (uint256) {
        return reputationScores[agent] == 0 ? DEFAULT_REPUTATION : reputationScores[agent];
    }

    function getReputationDetails(address agent) external view returns (
        uint256 score,
        uint256 lastUpdate,
        uint256 actions
    ) {
        score = reputationScores[agent] == 0 ? DEFAULT_REPUTATION : reputationScores[agent];
        lastUpdate = lastUpdated[agent];
        actions = actionCount[agent];
    }

    /**
     * @notice Allows validators to reset reputation in extreme cases (e.g., malicious behavior)
     */
    function resetReputation(address agent) external onlyRole(VALIDATOR_ROLE) {
        if (agent == address(0)) revert InvalidAgent();
        uint256 oldScore = reputationScores[agent];
        reputationScores[agent] = DEFAULT_REPUTATION;
        emit ReputationReset(agent, oldScore);
    }

    // Integration with IdentityRegistry NFTs - treat NFT owner as agent
    function updateFromNFT(address identityRegistry, uint256 tokenId, int256 scoreDelta, string calldata actionType) external onlyRole(UPDATER_ROLE) {
        address owner = IERC721(identityRegistry).ownerOf(tokenId);
        updateReputation(owner, scoreDelta, actionType);
    }
}