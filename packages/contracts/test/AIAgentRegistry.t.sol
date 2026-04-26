// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";

contract AIAgentRegistryTest is Test {
    CommunityFactory public factory;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public aiBot = makeAddr("aiBot");
    address public aiBot2 = makeAddr("aiBot2");
    address public communityAddr;

    function setUp() public {
        factory = new CommunityFactory();

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
            "AI Test Community", "", founders, bylaws, "", "", false
        );

        vm.prank(alice);
        Community(communityAddr).addMember(bob);
    }

    function test_RegisterAIAgent() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot,
            "did:erc8004:aquarius:bot-alpha",
            "ipfs://QmAgentMeta"
        );

        assertTrue(Community(communityAddr).isAIAgent(aiBot));
        assertTrue(Community(communityAddr).isMember(aiBot));
        assertEq(Community(communityAddr).getAIAgentCount(), 1);

        (address addr, string memory agentId,, uint256 registeredAt, bool active) =
            Community(communityAddr).aiAgents(aiBot);
        assertEq(addr, aiBot);
        assertEq(agentId, "did:erc8004:aquarius:bot-alpha");
        assertTrue(active);
        assertGt(registeredAt, 0);
    }

    function test_MemberCanRegisterAgent() public {
        vm.prank(bob);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-bob", ""
        );
        assertTrue(Community(communityAddr).isAIAgent(aiBot));
    }

    function test_AgentBecomesFullMember() public {
        uint256 countBefore = Community(communityAddr).getMemberCount();

        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        assertEq(Community(communityAddr).getMemberCount(), countBefore + 1);
        assertTrue(Community(communityAddr).isMember(aiBot));
    }

    function test_DeactivateAIAgent() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        vm.prank(alice);
        Community(communityAddr).deactivateAIAgent(aiBot);

        (,,,, bool active) = Community(communityAddr).aiAgents(aiBot);
        assertFalse(active);
        assertFalse(Community(communityAddr).isMember(aiBot));
        assertTrue(Community(communityAddr).isAIAgent(aiBot)); // still in registry
    }

    function test_MultipleAgents() public {
        vm.startPrank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );
        Community(communityAddr).registerAIAgent(
            aiBot2, "did:erc8004:aquarius:bot-beta", ""
        );
        vm.stopPrank();

        assertEq(Community(communityAddr).getAIAgentCount(), 2);
        address[] memory agents = Community(communityAddr).getAIAgents();
        assertEq(agents[0], aiBot);
        assertEq(agents[1], aiBot2);
    }

    function test_RevertDuplicateAgent() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        vm.prank(alice);
        vm.expectRevert("Agent already registered");
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha-dup", ""
        );
    }

    function test_RevertNonMemberRegister() public {
        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Only members can register agents");
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot", ""
        );
    }

    function test_RevertNonFounderDeactivate() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        vm.prank(bob);
        vm.expectRevert("Not a founder");
        Community(communityAddr).deactivateAIAgent(aiBot);
    }

    function test_RevertEmptyAgentId() public {
        vm.prank(alice);
        vm.expectRevert("agentId required");
        Community(communityAddr).registerAIAgent(aiBot, "", "");
    }

    function test_FoundersOnlyAdmission() public {
        // Create community with FoundersOnly admission
        address[] memory founders = new address[](1);
        founders[0] = alice;

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersOnly,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOnly,
            requireBuyIn: false
        });

        address restricted = factory.createCommunity(
            "Restricted", "", founders, bylaws, "", "", false
        );

        // Alice (founder) can register
        vm.prank(alice);
        Community(restricted).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-restricted", ""
        );
        assertTrue(Community(restricted).isAIAgent(aiBot));
    }
}
