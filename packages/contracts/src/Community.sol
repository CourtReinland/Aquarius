// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Community
 * @notice Core community contract - stores charter, members, founders, and bylaws configuration.
 * @dev Each community is a separate instance deployed by CommunityFactory.
 */
contract Community {
    // ─── Types ────────────────────────────────────────────────────────

    enum MemberAdmission { FoundersOnly, FoundersAndMembers }
    enum VoteThreshold { Majority, Supermajority, MinimumMembers }
    enum ProposalPermission { FoundersOnly, FoundersOrMembers }

    struct Bylaws {
        MemberAdmission admissionRule;
        MemberAdmission exileRule;
        VoteThreshold voteThreshold;
        uint8 votePercentage;          // 51-100
        ProposalPermission whoMayPropose;
        bool requireBuyIn;
    }

    struct CommunityInfo {
        string name;
        string charterIpfsHash;        // IPFS CID of full charter text
        string legalFramework;         // e.g. "US Code", "International Commerce Law"
        string jurisdiction;           // e.g. "State of California"
        bool allowCorporateMembers;    // natural persons only vs. persons or corporations
        uint256 createdAt;
    }

    // ─── State ────────────────────────────────────────────────────────

    CommunityInfo public info;
    Bylaws public bylaws;

    address[] public founders;
    mapping(address => bool) public isFounder;

    address[] public members;
    mapping(address => bool) public isMember;

    bool public initialized;

    // ─── Events ───────────────────────────────────────────────────────

    event CommunityCreated(string name, address[] founders, uint256 timestamp);
    event MemberAdded(address indexed member, uint256 timestamp);
    event MemberRemoved(address indexed member, uint256 timestamp);
    event BylawsUpdated(uint256 timestamp);
    event CharterUpdated(string newIpfsHash, uint256 timestamp);

    // ─── Modifiers ────────────────────────────────────────────────────

    modifier onlyFounder() {
        require(isFounder[msg.sender], "Not a founder");
        _;
    }

    modifier onlyMember() {
        require(isMember[msg.sender], "Not a member");
        _;
    }

    modifier onlyOnce() {
        require(!initialized, "Already initialized");
        _;
    }

    // ─── Initialization ───────────────────────────────────────────────

    /**
     * @notice Initialize the community. Called once by CommunityFactory.
     */
    function initialize(
        string calldata _name,
        string calldata _charterIpfsHash,
        address[] calldata _founders,
        Bylaws calldata _bylaws,
        string calldata _legalFramework,
        string calldata _jurisdiction,
        bool _allowCorporateMembers
    ) external onlyOnce {
        require(_founders.length > 0, "Need at least one founder");
        require(bytes(_name).length > 0, "Name required");

        info = CommunityInfo({
            name: _name,
            charterIpfsHash: _charterIpfsHash,
            legalFramework: _legalFramework,
            jurisdiction: _jurisdiction,
            allowCorporateMembers: _allowCorporateMembers,
            createdAt: block.timestamp
        });

        bylaws = _bylaws;

        for (uint256 i = 0; i < _founders.length; i++) {
            address f = _founders[i];
            require(f != address(0), "Invalid founder address");
            founders.push(f);
            isFounder[f] = true;
            // Founders are also members
            members.push(f);
            isMember[f] = true;
        }

        initialized = true;

        emit CommunityCreated(_name, _founders, block.timestamp);
    }

    // ─── Member Management ────────────────────────────────────────────

    /**
     * @notice Add a new member. Respects admission bylaws.
     */
    function addMember(address _member) external {
        require(_member != address(0), "Invalid address");
        require(!isMember[_member], "Already a member");

        if (bylaws.admissionRule == MemberAdmission.FoundersOnly) {
            require(isFounder[msg.sender], "Only founders can add members");
        } else {
            require(isMember[msg.sender], "Only members can add members");
        }

        members.push(_member);
        isMember[_member] = true;

        emit MemberAdded(_member, block.timestamp);
    }

    /**
     * @notice Remove a member. Respects exile bylaws.
     * @dev In production, this would be triggered by a passed proposal.
     */
    function removeMember(address _member) external {
        require(isMember[_member], "Not a member");
        require(!isFounder[_member], "Cannot remove a founder directly");

        if (bylaws.exileRule == MemberAdmission.FoundersOnly) {
            require(isFounder[msg.sender], "Only founders can remove members");
        } else {
            require(isMember[msg.sender], "Only members can remove members");
        }

        isMember[_member] = false;
        // Note: We don't remove from array to save gas. Use isMember mapping for checks.

        emit MemberRemoved(_member, block.timestamp);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getFounders() external view returns (address[] memory) {
        return founders;
    }

    function getMembers() external view returns (address[] memory) {
        return members;
    }

    function getMemberCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < members.length; i++) {
            if (isMember[members[i]]) count++;
        }
        return count;
    }

    function getFounderCount() external view returns (uint256) {
        return founders.length;
    }
}
