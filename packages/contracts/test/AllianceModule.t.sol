// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {AllianceModule} from "../src/AllianceModule.sol";

contract AllianceModuleTest is Test {
    CommunityFactory public factory;
    AllianceModule public alliance;

    address public alice = makeAddr("alice");  // founder of community A
    address public bob = makeAddr("bob");      // founder of community B

    address public commA;
    address public commB;

    function setUp() public {
        factory = new CommunityFactory();
        alliance = new AllianceModule();

        address[] memory foundersA = new address[](1);
        foundersA[0] = alice;
        address[] memory foundersB = new address[](1);
        foundersB[0] = bob;

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });

        commA = factory.createCommunity("Cincinnati Skateland", "", foundersA, bylaws, "", "", false);
        commB = factory.createCommunity("Alpha Centauri", "", foundersB, bylaws, "", "", false);
    }

    function test_ProposeAlliance() public {
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(
            commA, commB, "QmTermsHash", 500, true, true
        );

        (address a, address b, AllianceModule.AllianceStatus status,
         uint256 tokenGrant, bool freeTravel, bool votingRights) = alliance.getAlliance(id);

        assertEq(a, commA);
        assertEq(b, commB);
        assertTrue(status == AllianceModule.AllianceStatus.Proposed);
        assertEq(tokenGrant, 500);
        assertTrue(freeTravel);
        assertTrue(votingRights);
    }

    function test_AcceptAlliance() public {
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(commA, commB, "", 500, true, true);

        vm.prank(bob);
        alliance.acceptAlliance(id);

        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        assertTrue(status == AllianceModule.AllianceStatus.Active);
        assertTrue(alliance.isAllied(commA, commB));
        assertTrue(alliance.isAllied(commB, commA)); // Symmetrical
    }

    function test_DeclineAlliance() public {
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(commA, commB, "", 0, false, false);

        vm.prank(bob);
        alliance.declineAlliance(id);

        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        assertTrue(status == AllianceModule.AllianceStatus.Dissolved);
        assertFalse(alliance.isAllied(commA, commB));
    }

    function test_DissolveAlliance() public {
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(commA, commB, "", 500, true, true);

        vm.prank(bob);
        alliance.acceptAlliance(id);
        assertTrue(alliance.isAllied(commA, commB));

        // Either founder can dissolve
        vm.prank(alice);
        alliance.dissolveAlliance(id);

        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        assertTrue(status == AllianceModule.AllianceStatus.Dissolved);
    }

    function test_RevertNonFounderPropose() public {
        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Only founders can propose alliances");
        alliance.proposeAlliance(commA, commB, "", 0, false, false);
    }

    function test_RevertNonTargetAccept() public {
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(commA, commB, "", 0, false, false);

        vm.prank(alice); // Alice is founder of A, not B
        vm.expectRevert("Only target founders can accept");
        alliance.acceptAlliance(id);
    }

    function test_CommunityAllianceTracking() public {
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(commA, commB, "", 0, true, false);

        vm.prank(bob);
        alliance.acceptAlliance(id);

        uint256[] memory aAlliances = alliance.getCommunityAlliances(commA);
        uint256[] memory bAlliances = alliance.getCommunityAlliances(commB);

        assertEq(aAlliances.length, 1);
        assertEq(bAlliances.length, 1);
        assertEq(aAlliances[0], id);
    }
}
