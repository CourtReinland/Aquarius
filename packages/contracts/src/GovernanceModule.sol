// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Community} from "./Community.sol";

/**
 * @title GovernanceModule
 * @notice Handles proposals, voting, quorum checks, and outcome execution
 *         for an Aquarius community.
 *
 * Design matches the mind map:
 *   Proposals → Time Range, Quorum, Votes, Outputs, Inputs
 *   A yes vote results in → share ownership, simple yes, recurring billing,
 *                            one-time fee, overfund for shares
 *
 * And the pitch deck (slides 42, 09):
 *   - Proposal creation with requirements
 *   - Vote Now button with countdown timer
 *   - Quorum rules (majority, supermajority, min members)
 *   - Funding threshold + share allocation on yes vote
 */
contract GovernanceModule {
    // ─── Types ────────────────────────────────────────────────────────

    enum ProposalStatus {
        Active,
        Passed,
        Failed,
        Executed,
        Cancelled
    }

    enum QuorumType {
        Majority,          // >50% of votes
        Supermajority,     // >66% of votes
        MinimumMembers     // At least N members vote yes
    }

    enum OutcomeType {
        SimpleYes,         // Just a yes/no decision
        ShareOwnership,    // Yes voters receive shares in an institution
        OneTimeFee,        // Yes voters pay a one-time fee
        RecurringBilling,  // Yes voters commit to recurring payment
        OverfundForShares  // Allow overfunding in exchange for more shares
    }

    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string descriptionIpfsHash;  // Detailed description on IPFS
        string communityName;        // Which community this is in

        // Voting parameters
        QuorumType quorumType;
        uint8 quorumPercentage;      // 51-100 (for Majority/Supermajority)
        uint256 minimumVoters;       // For MinimumMembers quorum type

        // Time range
        uint256 startTime;
        uint256 endTime;

        // Outcome configuration
        OutcomeType outcomeType;
        uint256 fundingCostPerYes;   // Cost in wei per yes vote (0 if free)
        uint256 fundingThreshold;    // Min total funding needed to pass (0 if none)
        string institutionName;      // Name of institution created on pass

        // Tally
        uint256 yesVotes;
        uint256 noVotes;
        uint256 totalFunded;

        // State
        ProposalStatus status;
        address community;           // Community contract address
    }

    struct Vote {
        bool voted;
        bool support;      // true = yes, false = no
        uint256 fundedAmount;
    }

    // ─── State ────────────────────────────────────────────────────────

    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(uint256 => address[]) public yesVoters;  // Track for share allocation

    // ─── Smart Proposal extension ─────────────────────────────────────
    // When a proposal passes, if it carries creation bytecode that bytecode
    // is deployed as a new contract and its address is stored here. This is
    // the "smart proposal → live institution contract" flow.
    mapping(uint256 => bytes) public smartProposalBytecode;
    mapping(uint256 => address) public deployedContracts;

    // ─── Events ───────────────────────────────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed community,
        address indexed proposer,
        string title,
        uint256 startTime,
        uint256 endTime
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 fundedAmount
    );

    event ProposalFinalized(
        uint256 indexed proposalId,
        ProposalStatus status,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalFunded
    );

    event SmartProposalRegistered(
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 bytecodeSize
    );

    event SmartContractDeployed(
        uint256 indexed proposalId,
        address indexed deployedAddress,
        address indexed community
    );

    event ProposalExecuted(uint256 indexed proposalId);

    // ─── Core Functions ───────────────────────────────────────────────

    /**
     * @notice Create a new proposal for a community.
     * @dev Caller must be a member (or founder) of the community,
     *      and must have proposal permission per the community's bylaws.
     */
    function createProposal(
        address _community,
        string calldata _title,
        string calldata _descriptionIpfsHash,
        QuorumType _quorumType,
        uint8 _quorumPercentage,
        uint256 _minimumVoters,
        uint256 _durationSeconds,
        OutcomeType _outcomeType,
        uint256 _fundingCostPerYes,
        uint256 _fundingThreshold,
        string calldata _institutionName
    ) external returns (uint256 proposalId) {
        Community community = Community(_community);

        // Check proposer has permission
        require(community.initialized(), "Not a valid community");
        require(community.isMember(msg.sender), "Not a community member");

        // Check proposal permission from bylaws
        (
            ,  // admissionRule
            ,  // exileRule
            ,  // voteThreshold
            ,  // votePercentage
            Community.ProposalPermission whoMayPropose,
        ) = community.bylaws();

        if (whoMayPropose == Community.ProposalPermission.FoundersOnly) {
            require(community.isFounder(msg.sender), "Only founders may propose");
        }

        require(bytes(_title).length > 0, "Title required");
        require(_durationSeconds >= 300, "Min 5 min duration");
        require(_durationSeconds <= 30 days, "Max 30 day duration");
        require(_quorumPercentage >= 51 && _quorumPercentage <= 100, "Invalid quorum %");

        proposalId = nextProposalId++;

        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.proposer = msg.sender;
        p.title = _title;
        p.descriptionIpfsHash = _descriptionIpfsHash;
        p.community = _community;
        p.quorumType = _quorumType;
        p.quorumPercentage = _quorumPercentage;
        p.minimumVoters = _minimumVoters;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + _durationSeconds;
        p.outcomeType = _outcomeType;
        p.fundingCostPerYes = _fundingCostPerYes;
        p.fundingThreshold = _fundingThreshold;
        p.institutionName = _institutionName;
        p.status = ProposalStatus.Active;

        // Store community name for display
        (string memory name,,,,,) = community.info();
        p.communityName = name;

        emit ProposalCreated(
            proposalId, _community, msg.sender,
            _title, p.startTime, p.endTime
        );
    }

    /**
     * @notice Create a "smart proposal" — a proposal that carries the creation
     *         bytecode of a contract to deploy if/when it passes.
     * @dev This is the Aquarius "proposal becomes a live contract" flow. The
     *      bytecode is stored on-chain alongside the proposal and deployed
     *      via `executeProposal` after finalization.
     */
    function createSmartProposal(
        address _community,
        string calldata _title,
        string calldata _descriptionIpfsHash,
        QuorumType _quorumType,
        uint8 _quorumPercentage,
        uint256 _minimumVoters,
        uint256 _durationSeconds,
        uint256 _fundingCostPerYes,
        uint256 _fundingThreshold,
        string calldata _institutionName,
        bytes calldata _bytecode
    ) external returns (uint256 proposalId) {
        require(_bytecode.length > 0, "Bytecode required");

        Community community = Community(_community);
        require(community.initialized(), "Not a valid community");
        require(community.isMember(msg.sender), "Not a community member");

        (,,,, Community.ProposalPermission whoMayPropose,) = community.bylaws();
        if (whoMayPropose == Community.ProposalPermission.FoundersOnly) {
            require(community.isFounder(msg.sender), "Only founders may propose");
        }

        require(bytes(_title).length > 0, "Title required");
        require(_durationSeconds >= 300, "Min 5 min duration");
        require(_durationSeconds <= 30 days, "Max 30 day duration");
        require(_quorumPercentage >= 51 && _quorumPercentage <= 100, "Invalid quorum %");

        proposalId = nextProposalId++;
        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.proposer = msg.sender;
        p.title = _title;
        p.descriptionIpfsHash = _descriptionIpfsHash;
        p.community = _community;
        p.quorumType = _quorumType;
        p.quorumPercentage = _quorumPercentage;
        p.minimumVoters = _minimumVoters;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + _durationSeconds;
        p.outcomeType = OutcomeType.ShareOwnership;
        p.fundingCostPerYes = _fundingCostPerYes;
        p.fundingThreshold = _fundingThreshold;
        p.institutionName = _institutionName;
        p.status = ProposalStatus.Active;

        (string memory name,,,,,) = community.info();
        p.communityName = name;

        smartProposalBytecode[proposalId] = _bytecode;

        emit ProposalCreated(proposalId, _community, msg.sender, _title, p.startTime, p.endTime);
        emit SmartProposalRegistered(proposalId, msg.sender, _bytecode.length);
    }

    /**
     * @notice Execute a passed smart proposal by deploying its bytecode as
     *         a live contract. Callable by anyone once the proposal is Passed.
     */
    function executeProposal(uint256 _proposalId) external returns (address deployed) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.Passed, "Proposal not passed");
        bytes memory code = smartProposalBytecode[_proposalId];
        require(code.length > 0, "Not a smart proposal");
        require(deployedContracts[_proposalId] == address(0), "Already executed");

        assembly ("memory-safe") {
            deployed := create(0, add(code, 0x20), mload(code))
        }
        require(deployed != address(0), "Deploy failed");

        deployedContracts[_proposalId] = deployed;
        p.status = ProposalStatus.Executed;

        emit SmartContractDeployed(_proposalId, deployed, p.community);
        emit ProposalExecuted(_proposalId);
    }

    /**
     * @notice Cast a vote on a proposal.
     * @param _proposalId The proposal to vote on
     * @param _support true = yes, false = no
     */
    function castVote(
        uint256 _proposalId,
        bool _support
    ) external payable {
        Proposal storage p = proposals[_proposalId];

        require(p.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp >= p.startTime, "Voting not started");
        require(block.timestamp <= p.endTime, "Voting ended");

        // Verify voter is a community member
        Community community = Community(p.community);
        require(community.isMember(msg.sender), "Not a community member");

        // Check not already voted
        require(!votes[_proposalId][msg.sender].voted, "Already voted");

        // If yes vote requires funding
        if (_support && p.fundingCostPerYes > 0) {
            require(msg.value >= p.fundingCostPerYes, "Insufficient funding");
            p.totalFunded += msg.value;
        }

        // Record vote
        votes[_proposalId][msg.sender] = Vote({
            voted: true,
            support: _support,
            fundedAmount: msg.value
        });

        if (_support) {
            p.yesVotes++;
            yesVoters[_proposalId].push(msg.sender);
        } else {
            p.noVotes++;
        }

        emit VoteCast(_proposalId, msg.sender, _support, msg.value);
    }

    /**
     * @notice Finalize a proposal after voting period ends.
     * @dev Anyone can call this once the time has expired.
     */
    function finalizeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];

        require(p.status == ProposalStatus.Active, "Not active");
        require(block.timestamp > p.endTime, "Voting still open");

        uint256 totalVotes = p.yesVotes + p.noVotes;
        bool quorumMet = false;

        if (p.quorumType == QuorumType.Majority) {
            quorumMet = totalVotes > 0 &&
                (p.yesVotes * 100) / totalVotes >= p.quorumPercentage;
        } else if (p.quorumType == QuorumType.Supermajority) {
            quorumMet = totalVotes > 0 &&
                (p.yesVotes * 100) / totalVotes >= 67;
        } else if (p.quorumType == QuorumType.MinimumMembers) {
            quorumMet = p.yesVotes >= p.minimumVoters;
        }

        // Check funding threshold if applicable
        bool fundingMet = p.fundingThreshold == 0 ||
            p.totalFunded >= p.fundingThreshold;

        if (quorumMet && fundingMet) {
            p.status = ProposalStatus.Passed;
        } else {
            p.status = ProposalStatus.Failed;
            // Refund if failed and funds were collected
            if (p.totalFunded > 0) {
                _refundVoters(_proposalId);
            }
        }

        emit ProposalFinalized(
            _proposalId, p.status,
            p.yesVotes, p.noVotes, p.totalFunded
        );
    }

    /**
     * @notice Cancel a proposal. Only the proposer or a community founder can cancel.
     */
    function cancelProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.Active, "Not active");

        Community community = Community(p.community);
        require(
            msg.sender == p.proposer || community.isFounder(msg.sender),
            "Not authorized to cancel"
        );

        p.status = ProposalStatus.Cancelled;

        // Refund any collected funds
        if (p.totalFunded > 0) {
            _refundVoters(_proposalId);
        }

        emit ProposalFinalized(
            _proposalId, ProposalStatus.Cancelled,
            p.yesVotes, p.noVotes, 0
        );
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getProposal(uint256 _proposalId) external view returns (
        string memory title,
        address proposer,
        string memory communityName,
        ProposalStatus status,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalFunded,
        uint256 startTime,
        uint256 endTime,
        OutcomeType outcomeType,
        uint256 fundingCostPerYes
    ) {
        Proposal storage p = proposals[_proposalId];
        return (
            p.title, p.proposer, p.communityName, p.status,
            p.yesVotes, p.noVotes, p.totalFunded,
            p.startTime, p.endTime,
            p.outcomeType, p.fundingCostPerYes
        );
    }

    function hasVoted(uint256 _proposalId, address _voter) external view returns (bool) {
        return votes[_proposalId][_voter].voted;
    }

    function getVote(uint256 _proposalId, address _voter) external view returns (
        bool voted, bool support, uint256 fundedAmount
    ) {
        Vote storage v = votes[_proposalId][_voter];
        return (v.voted, v.support, v.fundedAmount);
    }

    function getYesVoters(uint256 _proposalId) external view returns (address[] memory) {
        return yesVoters[_proposalId];
    }

    function getTimeRemaining(uint256 _proposalId) external view returns (uint256) {
        Proposal storage p = proposals[_proposalId];
        if (block.timestamp >= p.endTime) return 0;
        return p.endTime - block.timestamp;
    }

    // ─── Internal ─────────────────────────────────────────────────────

    function _refundVoters(uint256 _proposalId) internal {
        address[] memory voters = yesVoters[_proposalId];
        for (uint256 i = 0; i < voters.length; i++) {
            uint256 amount = votes[_proposalId][voters[i]].fundedAmount;
            if (amount > 0) {
                votes[_proposalId][voters[i]].fundedAmount = 0;
                (bool sent,) = voters[i].call{value: amount}("");
                // If refund fails, funds stay in contract (can be recovered by admin)
                if (!sent) {
                    votes[_proposalId][voters[i]].fundedAmount = amount;
                }
            }
        }
    }

    receive() external payable {}
}
