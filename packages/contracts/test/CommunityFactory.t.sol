// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";

contract CommunityFactoryTest is Test {
    CommunityFactory public factory;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    function setUp() public {
        factory = new CommunityFactory();
    }

    function _defaultBylaws() internal pure returns (Community.Bylaws memory) {
        return Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });
    }

    function test_CreateCommunity() public {
        address[] memory founders = new address[](2);
        founders[0] = alice;
        founders[1] = bob;

        vm.prank(alice);
        address communityAddr = factory.createCommunity(
            "Cincinnati Skateville",
            "QmExampleHash123",
            founders,
            _defaultBylaws(),
            "US Code",
            "State of Ohio",
            false
        );

        // Verify factory state
        assertEq(factory.getCommunityCount(), 1);
        assertTrue(factory.isCommunity(communityAddr));

        // Verify community state
        Community community = Community(communityAddr);
        (string memory name,,,,, uint256 createdAt) = community.info();
        assertEq(name, "Cincinnati Skateville");
        assertTrue(createdAt > 0);

        // Verify founders are members
        assertTrue(community.isFounder(alice));
        assertTrue(community.isFounder(bob));
        assertTrue(community.isMember(alice));
        assertTrue(community.isMember(bob));
        assertEq(community.getFounderCount(), 2);
    }

    function test_CreateMultipleCommunities() public {
        address[] memory founders1 = new address[](1);
        founders1[0] = alice;

        address[] memory founders2 = new address[](1);
        founders2[0] = bob;

        factory.createCommunity("Community Alpha", "", founders1, _defaultBylaws(), "", "", false);
        factory.createCommunity("Community Beta", "", founders2, _defaultBylaws(), "", "", false);

        assertEq(factory.getCommunityCount(), 2);

        // Check founder-community mapping
        address[] memory aliceCommunities = factory.getFounderCommunities(alice);
        assertEq(aliceCommunities.length, 1);

        address[] memory bobCommunities = factory.getFounderCommunities(bob);
        assertEq(bobCommunities.length, 1);
    }

    function test_AddMember() public {
        address[] memory founders = new address[](1);
        founders[0] = alice;

        address communityAddr = factory.createCommunity(
            "Test Community", "", founders, _defaultBylaws(), "", "", false
        );

        Community community = Community(communityAddr);

        // Alice (founder/member) adds Charlie
        vm.prank(alice);
        community.addMember(charlie);

        assertTrue(community.isMember(charlie));
        assertFalse(community.isFounder(charlie));
    }

    function test_RemoveMember() public {
        address[] memory founders = new address[](1);
        founders[0] = alice;

        Community.Bylaws memory bylaws = _defaultBylaws();
        bylaws.exileRule = Community.MemberAdmission.FoundersOnly;

        address communityAddr = factory.createCommunity(
            "Test Community", "", founders, bylaws, "", "", false
        );

        Community community = Community(communityAddr);

        // Add then remove charlie
        vm.prank(alice);
        community.addMember(charlie);
        assertTrue(community.isMember(charlie));

        vm.prank(alice);
        community.removeMember(charlie);
        assertFalse(community.isMember(charlie));
    }

    function test_RevertNonFounderCannotRemoveWhenFoundersOnly() public {
        address[] memory founders = new address[](1);
        founders[0] = alice;

        Community.Bylaws memory bylaws = _defaultBylaws();
        bylaws.exileRule = Community.MemberAdmission.FoundersOnly;
        bylaws.admissionRule = Community.MemberAdmission.FoundersAndMembers;

        address communityAddr = factory.createCommunity(
            "Test Community", "", founders, bylaws, "", "", false
        );

        Community community = Community(communityAddr);

        // Alice adds bob and charlie
        vm.prank(alice);
        community.addMember(bob);
        vm.prank(alice);
        community.addMember(charlie);

        // Bob (non-founder) tries to remove charlie - should fail
        vm.prank(bob);
        vm.expectRevert("Only founders can remove members");
        community.removeMember(charlie);
    }

    function test_RevertCannotRemoveFounder() public {
        address[] memory founders = new address[](2);
        founders[0] = alice;
        founders[1] = bob;

        address communityAddr = factory.createCommunity(
            "Test Community", "", founders, _defaultBylaws(), "", "", false
        );

        Community community = Community(communityAddr);

        vm.prank(alice);
        vm.expectRevert("Cannot remove a founder directly");
        community.removeMember(bob);
    }

    function test_RevertDuplicateMember() public {
        address[] memory founders = new address[](1);
        founders[0] = alice;

        address communityAddr = factory.createCommunity(
            "Test Community", "", founders, _defaultBylaws(), "", "", false
        );

        Community community = Community(communityAddr);

        vm.prank(alice);
        community.addMember(charlie);

        vm.prank(alice);
        vm.expectRevert("Already a member");
        community.addMember(charlie);
    }

    function test_FounderCommunitiesTracking() public {
        address[] memory founders = new address[](2);
        founders[0] = alice;
        founders[1] = bob;

        factory.createCommunity("Community 1", "", founders, _defaultBylaws(), "", "", false);
        factory.createCommunity("Community 2", "", founders, _defaultBylaws(), "", "", false);

        address[] memory aliceCommunities = factory.getFounderCommunities(alice);
        assertEq(aliceCommunities.length, 2);
    }
}
