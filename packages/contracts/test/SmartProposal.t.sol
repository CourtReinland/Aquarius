// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {GovernanceModule} from "../src/GovernanceModule.sol";

/// @dev A trivial contract we deploy via smart-proposal bytecode.
contract SimpleCounter {
    uint256 public count;
    function increment() external { count++; }
}

contract SmartProposalTest is Test {
    CommunityFactory public factory;
    GovernanceModule public governance;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    address public communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        governance = new GovernanceModule();

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
            "Smart Proposal Community", "", founders, bylaws, "", "", false
        );

        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        vm.stopPrank();

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    function test_CreateSmartProposal() public {
        bytes memory code = type(SimpleCounter).creationCode;

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr,
            "Deploy a counter contract",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            0, 0, "Counter Institution",
            code
        );

        assertEq(proposalId, 0);

        // Bytecode is stored
        bytes memory stored = governance.smartProposalBytecode(proposalId);
        assertEq(stored.length, code.length);
    }

    function test_ExecuteSmartProposal() public {
        bytes memory code = type(SimpleCounter).creationCode;

        // Create
        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr,
            "Deploy counter",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            0, 0, "Counter",
            code
        );

        // Vote yes (3 of 3 = pass)
        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);
        vm.prank(charlie);
        governance.castVote(proposalId, true);

        // Finalize
        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        // Execute — deploys the contract
        address deployed = governance.executeProposal(proposalId);
        assertTrue(deployed != address(0));
        assertEq(governance.deployedContracts(proposalId), deployed);

        // Verify deployed contract works
        SimpleCounter counter = SimpleCounter(deployed);
        counter.increment();
        counter.increment();
        assertEq(counter.count(), 2);
    }

    function test_ExecutionSetsStatusToExecuted() public {
        bytes memory code = type(SimpleCounter).creationCode;

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr, "Deploy", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, 0, 0, "Inst", code
        );

        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);
        governance.executeProposal(proposalId);

        (,,, GovernanceModule.ProposalStatus status,,,,,,,) =
            governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Executed);
    }

    function test_RevertExecuteNotPassed() public {
        bytes memory code = type(SimpleCounter).creationCode;

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr, "Deploy", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, 0, 0, "Inst", code
        );

        // Still active — not finalized
        vm.expectRevert("Proposal not passed");
        governance.executeProposal(proposalId);
    }

    function test_RevertDoubleExecute() public {
        bytes memory code = type(SimpleCounter).creationCode;

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr, "Deploy", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, 0, 0, "Inst", code
        );

        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);
        governance.executeProposal(proposalId);

        // Status is now Executed (not Passed), so this reverts with "Proposal not passed"
        vm.expectRevert("Proposal not passed");
        governance.executeProposal(proposalId);
    }

    function test_RevertExecuteNonSmartProposal() public {
        // Regular proposal (no bytecode)
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr, "Normal", "",
            GovernanceModule.QuorumType.Majority, 51, 0, 1 days,
            GovernanceModule.OutcomeType.SimpleYes, 0, 0, ""
        );

        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        vm.expectRevert("Not a smart proposal");
        governance.executeProposal(proposalId);
    }

    function test_RevertEmptyBytecode() public {
        vm.prank(alice);
        vm.expectRevert("Bytecode required");
        governance.createSmartProposal(
            communityAddr, "Empty", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, 0, 0, "Inst", ""
        );
    }

    function test_SmartProposalWithFunding() public {
        bytes memory code = type(SimpleCounter).creationCode;

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr,
            "Funded deploy",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            0.1 ether, 0.2 ether, "Funded Counter",
            code
        );

        vm.prank(alice);
        governance.castVote{value: 0.1 ether}(proposalId, true);
        vm.prank(bob);
        governance.castVote{value: 0.1 ether}(proposalId, true);
        vm.prank(charlie);
        governance.castVote{value: 0.1 ether}(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        address deployed = governance.executeProposal(proposalId);
        assertTrue(deployed != address(0));
    }

    function test_FailedSmartProposalNotExecutable() public {
        bytes memory code = type(SimpleCounter).creationCode;

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr, "Deploy", "", GovernanceModule.QuorumType.Majority,
            51, 0, 1 days, 0, 0, "Inst", code
        );

        // Vote no
        vm.prank(alice);
        governance.castVote(proposalId, false);
        vm.prank(bob);
        governance.castVote(proposalId, false);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        vm.expectRevert("Proposal not passed");
        governance.executeProposal(proposalId);
    }
}
