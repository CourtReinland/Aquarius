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

        (
            address addr,
            string memory agentId,
            ,
            uint256 registeredAt,
            bool active,
            Community.AgentPermissionClass permissionClass
        ) = Community(communityAddr).aiAgents(aiBot);
        assertEq(addr, aiBot);
        assertEq(agentId, "did:erc8004:aquarius:bot-alpha");
        assertTrue(active);
        assertGt(registeredAt, 0);
        assertEq(uint8(permissionClass), uint8(Community.AgentPermissionClass.Worker));
    }

    function test_RegisterAIAgentWithPermissionClass() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgentWithClass(
            aiBot,
            "did:erc8004:aquarius:bot-alpha",
            "ipfs://QmAgentMeta",
            Community.AgentPermissionClass.Delegate
        );

        assertTrue(Community(communityAddr).isAIAgent(aiBot));
        assertTrue(Community(communityAddr).isMember(aiBot));

        (,,,,, Community.AgentPermissionClass permissionClass) =
            Community(communityAddr).aiAgents(aiBot);
        assertEq(uint8(permissionClass), uint8(Community.AgentPermissionClass.Delegate));
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

        (,,,, bool active,) = Community(communityAddr).aiAgents(aiBot);
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

    function test_RevertMemberRegisterWhenFoundersOnly() public {
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

        vm.prank(alice);
        Community(restricted).addMember(bob);

        vm.prank(bob);
        vm.expectRevert("Only founders can register agents");
        Community(restricted).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-member", ""
        );
    }

    function test_ReactivateAIAgent() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", "ipfs://QmAgentMeta"
        );

        vm.prank(alice);
        Community(communityAddr).deactivateAIAgent(aiBot);

        uint256 membersAfterDeactivate = Community(communityAddr).getMemberCount();

        vm.prank(alice);
        Community(communityAddr).reactivateAIAgent(aiBot);

        (,,,, bool active,) = Community(communityAddr).aiAgents(aiBot);
        assertTrue(active);
        assertTrue(Community(communityAddr).isMember(aiBot));
        assertTrue(Community(communityAddr).isAIAgent(aiBot));
        assertEq(Community(communityAddr).getAIAgentCount(), 1);
        assertEq(Community(communityAddr).getActiveAIAgentCount(), 1);
        assertEq(Community(communityAddr).getMemberCount(), membersAfterDeactivate + 1);
    }

    function test_ReregisterInactiveAgent_NoListDuplicate() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", "ipfs://old"
        );

        (,,, uint256 originalRegisteredAt,,) = Community(communityAddr).aiAgents(aiBot);

        vm.prank(alice);
        Community(communityAddr).deactivateAIAgent(aiBot);

        // Members (not only founders) may re-register under FoundersAndMembers.
        vm.prank(bob);
        Community(communityAddr).registerAIAgentWithClass(
            aiBot,
            "did:erc8004:aquarius:bot-alpha-v2",
            "ipfs://new",
            Community.AgentPermissionClass.Delegate
        );

        assertEq(Community(communityAddr).getAIAgentCount(), 1);
        address[] memory agents = Community(communityAddr).getAIAgents();
        assertEq(agents.length, 1);
        assertEq(agents[0], aiBot);

        (
            address addr,
            string memory agentId,
            string memory metadataURI,
            uint256 registeredAt,
            bool active,
            Community.AgentPermissionClass permissionClass
        ) = Community(communityAddr).aiAgents(aiBot);
        assertEq(addr, aiBot);
        assertEq(agentId, "did:erc8004:aquarius:bot-alpha-v2");
        assertEq(metadataURI, "ipfs://new");
        assertEq(registeredAt, originalRegisteredAt);
        assertTrue(active);
        assertEq(uint8(permissionClass), uint8(Community.AgentPermissionClass.Delegate));
        assertTrue(Community(communityAddr).isMember(aiBot));
        assertEq(Community(communityAddr).getActiveAIAgentCount(), 1);
    }

    function test_RevertReregisterActiveAgent() public {
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

    function test_DeactivatePreservesFounderMembership() public {
        uint256 membersBefore = Community(communityAddr).getMemberCount();

        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            alice, "did:erc8004:aquarius:founder-bot", ""
        );

        assertEq(Community(communityAddr).getMemberCount(), membersBefore);
        assertTrue(Community(communityAddr).isFounder(alice));
        assertTrue(Community(communityAddr).isMember(alice));

        vm.prank(alice);
        Community(communityAddr).deactivateAIAgent(alice);

        (,,,, bool active,) = Community(communityAddr).aiAgents(alice);
        assertFalse(active);
        assertTrue(Community(communityAddr).isFounder(alice));
        assertTrue(Community(communityAddr).isMember(alice));
        assertTrue(Community(communityAddr).isAIAgent(alice));
        assertEq(Community(communityAddr).getMemberCount(), membersBefore);
        assertEq(Community(communityAddr).getActiveAIAgentCount(), 0);

        // Founder still passes onlyMember admission paths after deactivate.
        address carol = makeAddr("carol");
        vm.prank(alice);
        Community(communityAddr).addMember(carol);
        assertTrue(Community(communityAddr).isMember(carol));
    }

    function test_GetActiveAIAgents_FiltersInactive() public {
        vm.startPrank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );
        Community(communityAddr).registerAIAgent(
            aiBot2, "did:erc8004:aquarius:bot-beta", ""
        );
        Community(communityAddr).deactivateAIAgent(aiBot);
        vm.stopPrank();

        address[] memory allAgents = Community(communityAddr).getAIAgents();
        assertEq(allAgents.length, 2);
        assertEq(allAgents[0], aiBot);
        assertEq(allAgents[1], aiBot2);
        assertEq(Community(communityAddr).getAIAgentCount(), 2);

        address[] memory activeAgents = Community(communityAddr).getActiveAIAgents();
        assertEq(activeAgents.length, 1);
        assertEq(activeAgents[0], aiBot2);
        assertEq(Community(communityAddr).getActiveAIAgentCount(), 1);

        vm.prank(alice);
        Community(communityAddr).reactivateAIAgent(aiBot);

        activeAgents = Community(communityAddr).getActiveAIAgents();
        assertEq(activeAgents.length, 2);
        assertEq(activeAgents[0], aiBot);
        assertEq(activeAgents[1], aiBot2);
        assertEq(Community(communityAddr).getActiveAIAgentCount(), 2);
    }

    function test_RevertDoubleDeactivate() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        vm.prank(alice);
        Community(communityAddr).deactivateAIAgent(aiBot);

        vm.prank(alice);
        vm.expectRevert("Already inactive");
        Community(communityAddr).deactivateAIAgent(aiBot);
    }

    function test_RevertOutsiderDeactivate() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not a founder");
        Community(communityAddr).deactivateAIAgent(aiBot);
    }

    function test_RevertDeactivateUnregistered() public {
        vm.prank(alice);
        vm.expectRevert("Not a registered agent");
        Community(communityAddr).deactivateAIAgent(aiBot);
    }

    function test_RevertNonFounderReactivate() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );
        vm.prank(alice);
        Community(communityAddr).deactivateAIAgent(aiBot);

        vm.prank(bob);
        vm.expectRevert("Not a founder");
        Community(communityAddr).reactivateAIAgent(aiBot);

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not a founder");
        Community(communityAddr).reactivateAIAgent(aiBot);
    }

    function test_RevertReactivateAlreadyActive() public {
        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );

        vm.prank(alice);
        vm.expectRevert("Already active");
        Community(communityAddr).reactivateAIAgent(aiBot);
    }

    function test_RevertReactivateUnregistered() public {
        vm.prank(alice);
        vm.expectRevert("Not a registered agent");
        Community(communityAddr).reactivateAIAgent(aiBot);
    }

    function test_LifecycleCycle_DeactivateReactivateReregister() public {
        vm.startPrank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha", ""
        );
        Community(communityAddr).deactivateAIAgent(aiBot);
        Community(communityAddr).reactivateAIAgent(aiBot);
        Community(communityAddr).deactivateAIAgent(aiBot);
        vm.stopPrank();

        vm.prank(alice);
        Community(communityAddr).registerAIAgent(
            aiBot, "did:erc8004:aquarius:bot-alpha-reonboard", ""
        );

        assertEq(Community(communityAddr).getAIAgentCount(), 1);
        assertEq(Community(communityAddr).getActiveAIAgentCount(), 1);
        assertTrue(Community(communityAddr).isMember(aiBot));
        (,,,, bool active,) = Community(communityAddr).aiAgents(aiBot);
        assertTrue(active);
    }
}
