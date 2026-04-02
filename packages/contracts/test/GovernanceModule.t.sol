// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {GovernanceModule} from "../src/GovernanceModule.sol";

contract GovernanceModuleTest is Test {
    CommunityFactory public factory;
    GovernanceModule public governance;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public dave = makeAddr("dave");

    address public communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        governance = new GovernanceModule();

        // Create a community with alice as founder
        address[] memory founders = new address[](1);
        founders[0] = alice;

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });

        communityAddr = factory.createCommunity(
            "Test Community", "", founders, bylaws, "", "", false
        );

        // Add bob, charlie, dave as members
        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        Community(communityAddr).addMember(dave);
        vm.stopPrank();

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
        vm.deal(dave, 10 ether);
    }

    // ─── Proposal Creation ────────────────────────────────────────────

    function test_CreateProposal() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Buy a pizza making machine",
            "QmDescHash",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            0.05 ether,
            0,
            "Pizza Foundry"
        );

        assertEq(proposalId, 0);

        (
            string memory title, address proposer, string memory communityName,
            GovernanceModule.ProposalStatus status,
            uint256 yesVotes, uint256 noVotes,,,,
            ,
        ) = governance.getProposal(proposalId);

        assertEq(title, "Buy a pizza making machine");
        assertEq(proposer, alice);
        assertEq(communityName, "Test Community");
        assertTrue(status == GovernanceModule.ProposalStatus.Active);
        assertEq(yesVotes, 0);
        assertEq(noVotes, 0);
    }

    function test_MemberCanPropose() public {
        // Bob is a member (not founder) - should be able to propose
        vm.prank(bob);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Add a coffee shop",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            GovernanceModule.OutcomeType.SimpleYes,
            0, 0, ""
        );
        assertEq(proposalId, 0);
    }

    function test_RevertNonMemberCannotPropose() public {
        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not a community member");
        governance.createProposal(
            communityAddr, "Hack proposal", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, GovernanceModule.OutcomeType.SimpleYes, 0, 0, ""
        );
    }

    function test_RevertFoundersOnlyProposal() public {
        // Create community where only founders can propose
        address[] memory founders = new address[](1);
        founders[0] = alice;

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOnly,
            requireBuyIn: false
        });

        address restrictedCommunity = factory.createCommunity(
            "Restricted", "", founders, bylaws, "", "", false
        );

        vm.prank(alice);
        Community(restrictedCommunity).addMember(bob);

        // Bob (member, not founder) tries to propose
        vm.prank(bob);
        vm.expectRevert("Only founders may propose");
        governance.createProposal(
            restrictedCommunity, "Proposal", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, GovernanceModule.OutcomeType.SimpleYes, 0, 0, ""
        );
    }

    // ─── Voting ───────────────────────────────────────────────────────

    function test_CastVote() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        vm.prank(bob);
        governance.castVote(proposalId, true);

        assertTrue(governance.hasVoted(proposalId, bob));
        (bool voted, bool support,) = governance.getVote(proposalId, bob);
        assertTrue(voted);
        assertTrue(support);
    }

    function test_CastVoteWithFunding() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Buy pizza machine",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            0.05 ether,  // Cost per yes vote
            0, "Pizza Foundry"
        );

        // Bob votes yes with funding
        vm.prank(bob);
        governance.castVote{value: 0.05 ether}(proposalId, true);

        (,,,, uint256 yesVotes,, uint256 totalFunded,,,,) =
            governance.getProposal(proposalId);
        assertEq(yesVotes, 1);
        assertEq(totalFunded, 0.05 ether);
    }

    function test_RevertDoubleVote() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        vm.prank(bob);
        governance.castVote(proposalId, true);

        vm.prank(bob);
        vm.expectRevert("Already voted");
        governance.castVote(proposalId, false);
    }

    function test_RevertVoteAfterEnd() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        // Warp past end time
        vm.warp(block.timestamp + 2 days);

        vm.prank(bob);
        vm.expectRevert("Voting ended");
        governance.castVote(proposalId, true);
    }

    function test_RevertNonMemberVote() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not a community member");
        governance.castVote(proposalId, true);
    }

    // ─── Finalization ─────────────────────────────────────────────────

    function test_ProposalPassesMajority() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        // 3 yes, 1 no = 75% → passes with 51% majority
        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);
        vm.prank(charlie);
        governance.castVote(proposalId, true);
        vm.prank(dave);
        governance.castVote(proposalId, false);

        // Warp past end and finalize
        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        (,,, GovernanceModule.ProposalStatus status,
         uint256 yesVotes, uint256 noVotes,,,,,) =
            governance.getProposal(proposalId);

        assertTrue(status == GovernanceModule.ProposalStatus.Passed);
        assertEq(yesVotes, 3);
        assertEq(noVotes, 1);
    }

    function test_ProposalFailsMajority() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        // 1 yes, 3 no = 25% → fails
        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, false);
        vm.prank(charlie);
        governance.castVote(proposalId, false);
        vm.prank(dave);
        governance.castVote(proposalId, false);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        (,,, GovernanceModule.ProposalStatus status,,,,,,, ) =
            governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Failed);
    }

    function test_ProposalPassesWithFundingThreshold() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Buy skatepark",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            1 ether,     // 1 ETH per yes vote
            2 ether,     // Need at least 2 ETH total
            "Skatepark"
        );

        // 3 yes votes with funding = 3 ETH (exceeds threshold)
        vm.prank(alice);
        governance.castVote{value: 1 ether}(proposalId, true);
        vm.prank(bob);
        governance.castVote{value: 1 ether}(proposalId, true);
        vm.prank(charlie);
        governance.castVote{value: 1 ether}(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        (,,, GovernanceModule.ProposalStatus status,,,
         uint256 totalFunded,,,,) = governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Passed);
        assertEq(totalFunded, 3 ether);
    }

    function test_ProposalFailsInsufficientFunding() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Expensive project",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            0.5 ether,
            5 ether,   // Need 5 ETH but only 2 voters
            "BigProject"
        );

        // Only 2 yes = 1 ETH < 5 ETH threshold
        vm.prank(alice);
        governance.castVote{value: 0.5 ether}(proposalId, true);
        vm.prank(bob);
        governance.castVote{value: 0.5 ether}(proposalId, true);
        vm.prank(charlie);
        governance.castVote{value: 0.5 ether}(proposalId, true);

        vm.warp(block.timestamp + 2 days);

        uint256 aliceBalBefore = alice.balance;
        governance.finalizeProposal(proposalId);

        // Should have failed and refunded
        (,,, GovernanceModule.ProposalStatus status,,,,,,, ) =
            governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Failed);

        // Alice should be refunded
        assertEq(alice.balance, aliceBalBefore + 0.5 ether);
    }

    function test_MinimumMembersQuorum() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Needs 3 yes votes",
            "",
            GovernanceModule.QuorumType.MinimumMembers,
            51, 3,    // Need at least 3 yes votes
            1 days,
            GovernanceModule.OutcomeType.SimpleYes,
            0, 0, ""
        );

        // Only 2 yes
        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        (,,, GovernanceModule.ProposalStatus status,,,,,,, ) =
            governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Failed);
    }

    function test_CancelProposal() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        vm.prank(alice);  // Founder can cancel
        governance.cancelProposal(proposalId);

        (,,, GovernanceModule.ProposalStatus status,,,,,,, ) =
            governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Cancelled);
    }

    function test_CancelRefundsFunding() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr, "Cancelable", "",
            GovernanceModule.QuorumType.Majority, 51, 0, 1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            1 ether, 0, "Thing"
        );

        vm.prank(bob);
        governance.castVote{value: 1 ether}(proposalId, true);

        uint256 bobBalBefore = bob.balance;

        vm.prank(alice);
        governance.cancelProposal(proposalId);

        assertEq(bob.balance, bobBalBefore + 1 ether);
    }

    function test_YesVotersTracked() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);
        vm.prank(charlie);
        governance.castVote(proposalId, false);

        address[] memory voters = governance.getYesVoters(proposalId);
        assertEq(voters.length, 2);
        assertEq(voters[0], alice);
        assertEq(voters[1], bob);
    }

    function test_TimeRemaining() public {
        vm.prank(alice);
        uint256 proposalId = _createSimpleProposal();

        uint256 remaining = governance.getTimeRemaining(proposalId);
        assertEq(remaining, 1 days);

        vm.warp(block.timestamp + 12 hours);
        remaining = governance.getTimeRemaining(proposalId);
        assertEq(remaining, 12 hours);

        vm.warp(block.timestamp + 13 hours);
        remaining = governance.getTimeRemaining(proposalId);
        assertEq(remaining, 0);
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    function _createSimpleProposal() internal returns (uint256) {
        return governance.createProposal(
            communityAddr,
            "Simple proposal",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            GovernanceModule.OutcomeType.SimpleYes,
            0, 0, ""
        );
    }
}
