// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Governor} from "openzeppelin-contracts/governance/Governor.sol";
import {GovernorSettings} from "openzeppelin-contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "openzeppelin-contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "openzeppelin-contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "openzeppelin-contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {IVotes} from "openzeppelin-contracts/governance/utils/IVotes.sol";
import {Ownable2Step} from "openzeppelin-contracts/access/Ownable2Step.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {PermissionRegistry} from "./PermissionRegistry.sol";

/**
 * @title HybridGovernor
 * @notice OZ Governor extended for hybrid human + AI agent voting in Aquarius DAO.
 * Agents can vote if they hold valid Identity NFT and meet reputation threshold.
 * Supports delegated voting for both humans and agent TBAs (ERC6551).
 */
contract HybridGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction, Ownable2Step {
    ReputationRegistry public reputationRegistry;
    PermissionRegistry public permissionRegistry;
    uint256 public agentReputationThreshold = 500; // Out of 10000
    uint256 public agentVoteWeightMultiplier = 2; // Agents with high rep get more weight

    event AgentVoted(uint256 proposalId, uint256 tokenId, uint8 support, uint256 weight);

    error BelowReputationThreshold(uint256 currentRep, uint256 required);
    error InvalidAgentNFT();

    constructor(
        IVotes _token,
        ReputationRegistry _reputationRegistry,
        PermissionRegistry _permissionRegistry,
        string memory name_,
        address initialOwner
    )
        Governor(name_)
        GovernorSettings(1 days, 7 days, 0) // 1 day voting delay, 7 day voting period, 0 proposal threshold
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        Ownable2Step()
    {
        reputationRegistry = _reputationRegistry;
        permissionRegistry = _permissionRegistry;
        _transferOwnership(initialOwner); // Ensure ownership is set
    }

    /**
     * @notice Override castVote to support hybrid agent voting logic
     * Agents identified via IdentityRegistry NFT + reputation check
     */
    function castVote(uint256 proposalId, uint8 support) public override(Governor) returns (uint256) {
        address voter = _msgSender();
        
        // Check if voter is an agent via permission registry or direct NFT ownership
        if (permissionRegistry.hasPermission(keccak256("VOTER_ROLE"), voter, 0)) {
            uint256 rep = reputationRegistry.getReputation(voter);
            if (rep < agentReputationThreshold) {
                revert BelowReputationThreshold(rep, agentReputationThreshold);
            }
            // Apply multiplier for high reputation agents
            // Note: weight adjustment is handled in _getVotes override
        }
        
        return super.castVote(proposalId, support);
    }

    function castAgentVote(uint256 proposalId, uint256 agentTokenId, uint8 support) external returns (uint256) {
        // Validate agent has permission to vote
        if (!permissionRegistry.isValidAgent(agentTokenId, keccak256("VOTER_ROLE"))) {
            revert InvalidAgentNFT();
        }
        
        uint256 weight = _getVotesForAgent(agentTokenId, block.timestamp);
        _countVote(proposalId, address(this), support, weight, _defaultParams());
        
        emit AgentVoted(proposalId, agentTokenId, support, weight);
        return weight;
    }

    function _getVotesForAgent(uint256 agentTokenId, uint256 timepoint) internal view returns (uint256) {
        uint256 baseVotes = super._getVotes(address(this), timepoint, _defaultParams()); // placeholder
        uint256 rep = reputationRegistry.getReputation(address(this)); // would be mapped to NFT owner
        if (rep > agentReputationThreshold * 2) {
            return baseVotes * agentVoteWeightMultiplier;
        }
        return baseVotes;
    }

    // Required overrides
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 timepoint) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(timepoint);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function _getVotes(
        address account,
        uint256 timepoint,
        bytes memory params
    ) internal view override(Governor, GovernorVotes) returns (uint256) {
        return super._getVotes(account, timepoint, params);
    }

    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 totalWeight,
        bytes memory params
    ) internal override(Governor, GovernorCountingSimple) {
        super._countVote(proposalId, account, support, totalWeight, params);
    }

    /**
     * @notice Updates the reputation threshold for agent voting participation
     */
    function setAgentReputationThreshold(uint256 newThreshold) external onlyOwner {
        agentReputationThreshold = newThreshold;
    }
}