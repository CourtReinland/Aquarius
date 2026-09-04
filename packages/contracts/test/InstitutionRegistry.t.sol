// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {TokenModule} from "../src/TokenModule.sol";

contract InstitutionRegistryTest is Test {
    CommunityFactory public factory;
    InstitutionRegistry public registry;
    TokenModule public token;

    address public alice = makeAddr("alice");  // founder
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    address public communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        registry = new InstitutionRegistry();
        token = new TokenModule();

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

        communityAddr = factory.createCommunity("Skateville", "", founders, bylaws, "", "", false);

        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        vm.stopPrank();

        // Initialize token with alice as bank
        token.initialize(
            "Skate Coin", "SK8",
            communityAddr, alice,
            1_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Austrian,
                allowArbitraryCreation: false,
                allowFractionalLending: false,
                leverageRatio: 1,
                maxSupply: 0
            })
        );
    }

    // ─── Institution Creation ─────────────────────────────────────────

    function test_CreateInstitution() public {
        vm.prank(alice);
        uint256 id = registry.createInstitution(communityAddr, "Pizza Foundry", 100, true);

        (string memory name, address comm, uint256 totalShares,
         bool paysDividends, bool active,, uint256 createdAt) = registry.getInstitution(id);

        assertEq(name, "Pizza Foundry");
        assertEq(comm, communityAddr);
        assertEq(totalShares, 100);
        assertTrue(paysDividends);
        assertTrue(active);
        assertTrue(createdAt > 0);
    }

    function test_MemberCanCreateInstitution() public {
        vm.prank(bob);
        uint256 id = registry.createInstitution(communityAddr, "Coffee Shop", 50, false);
        assertEq(id, 0);
    }

    function test_RevertNonMemberCreate() public {
        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not a community member");
        registry.createInstitution(communityAddr, "Hack", 10, false);
    }

    function test_CommunityInstitutionTracking() public {
        vm.startPrank(alice);
        registry.createInstitution(communityAddr, "Pizza Foundry", 100, true);
        registry.createInstitution(communityAddr, "Kindergarten", 50, false);
        registry.createInstitution(communityAddr, "Coffee Shop", 30, true);
        vm.stopPrank();

        uint256[] memory ids = registry.getCommunityInstitutions(communityAddr);
        assertEq(ids.length, 3);
    }

    // ─── Share Allocation ─────────────────────────────────────────────

    function test_AllocateShares() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Pizza Foundry", 100, true);

        vm.prank(alice);
        registry.allocateShares(instId, bob, 23);

        assertEq(registry.getMemberShares(instId, bob), 23);
        assertEq(registry.getShareholderCount(instId), 1);
    }

    function test_MultipleShareholders() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Farm", 200, true);

        vm.startPrank(alice);
        registry.allocateShares(instId, alice, 100);
        registry.allocateShares(instId, bob, 60);
        registry.allocateShares(instId, charlie, 40);
        vm.stopPrank();

        assertEq(registry.getShareholderCount(instId), 3);
        assertEq(registry.getMemberShares(instId, alice), 100);
        assertEq(registry.getMemberShares(instId, bob), 60);
        assertEq(registry.getMemberShares(instId, charlie), 40);
    }

    // ─── Position Creation & Assignment ───────────────────────────────

    function test_CreatePosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Kindergarten", 50, false);

        vm.prank(alice);
        uint256 posId = registry.createPosition(
            instId,
            "Kindergarten Headmaster",
            "Manage curriculum, supervise teachers, 5.5hr workday M-F",
            400, // 400 tokens/day
            10   // 10 shares in the institution
        );

        (uint256 institutionId, string memory title, string memory responsibilities,
         uint256 reward, uint256 shareGrant, address holder, bool active) = registry.getPosition(posId);

        assertEq(institutionId, instId);
        assertEq(title, "Kindergarten Headmaster");
        assertEq(reward, 400);
        assertEq(shareGrant, 10);
        assertEq(holder, address(0)); // Vacant
        assertTrue(active);
        assertTrue(registry.isPositionVacant(posId));
    }

    function test_OfferAndAcceptPosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Pizza Foundry", 100, true);

        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Baker", "Bake 60 cupcakes/day", 200, 5);

        // Offer to bob
        vm.prank(alice);
        registry.offerPosition(posId, bob);
        assertEq(registry.getPendingAssignment(posId), bob);

        // Bob accepts
        vm.prank(bob);
        registry.acceptPosition(posId);

        (,,,,, address holder,) = registry.getPosition(posId);
        assertEq(holder, bob);
        assertFalse(registry.isPositionVacant(posId));

        // Bob should have received share grant
        assertEq(registry.getMemberShares(instId, bob), 5);
    }

    function test_DeclinePosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "School", 50, false);

        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Teacher", "Teach math", 300, 0);

        vm.prank(alice);
        registry.offerPosition(posId, charlie);

        // Charlie declines
        vm.prank(charlie);
        registry.declinePosition(posId);

        assertEq(registry.getPendingAssignment(posId), address(0));
        assertTrue(registry.isPositionVacant(posId));
    }

    function test_VacatePosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Cafe", 30, true);

        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Barista", "Make coffee", 150, 0);

        vm.prank(alice);
        registry.offerPosition(posId, bob);

        vm.prank(bob);
        registry.acceptPosition(posId);

        // Bob resigns
        vm.prank(bob);
        registry.vacatePosition(posId);

        assertTrue(registry.isPositionVacant(posId));
    }

    function test_RevertAcceptNotOffered() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Shop", 20, false);

        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Clerk", "Sell things", 100, 0);

        // Charlie tries to accept without being offered
        vm.prank(charlie);
        vm.expectRevert("Not offered to you");
        registry.acceptPosition(posId);
    }

    function test_RevertOfferFilledPosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Gym", 40, false);

        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Trainer", "Train people", 250, 0);

        vm.prank(alice);
        registry.offerPosition(posId, bob);

        vm.prank(bob);
        registry.acceptPosition(posId);

        // Try to offer again — position already filled
        vm.prank(alice);
        vm.expectRevert("Position already filled");
        registry.offerPosition(posId, charlie);
    }

    // ─── Dividend Distribution ────────────────────────────────────────

    function test_DistributeDividends() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Pizza Foundry", 100, true);

        // Allocate shares: alice 60, bob 40
        vm.startPrank(alice);
        registry.allocateShares(instId, alice, 60);
        registry.allocateShares(instId, bob, 40);

        // Alice (bank) approves registry to spend tokens
        uint256 dividendAmount = 10_000 * 1e18;
        token.approve(address(registry), dividendAmount);

        // Distribute dividends
        registry.distributeDividends(instId, address(token), dividendAmount);
        vm.stopPrank();

        // Alice should get 60% = 6000, Bob should get 40% = 4000
        assertEq(token.balanceOf(alice), (1_000_000 * 1e18) - dividendAmount + (6000 * 1e18));
        assertEq(token.balanceOf(bob), 4000 * 1e18);
    }

    // ─── Full Integration: The "Ryan & Jess" Story ────────────────────

    function test_FullPizzaFoundryStory() public {
        // 1. Alice creates the Pizza Foundry institution
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Pizza Foundry", 100, true);

        // 2. Shares allocated to voters (simulating post-proposal)
        vm.startPrank(alice);
        registry.allocateShares(instId, alice, 40);
        registry.allocateShares(instId, bob, 35);
        registry.allocateShares(instId, charlie, 25);
        vm.stopPrank();

        // 3. Create baker position
        vm.prank(alice);
        uint256 bakerPos = registry.createPosition(
            instId, "Baker",
            "Bake 60 Cupcakes/day",
            200,  // 200 tokens/day
            5     // 5 extra shares
        );

        // 4. Offer baker role to bob
        vm.prank(alice);
        registry.offerPosition(bakerPos, bob);

        // 5. Bob accepts — gets 5 additional shares
        vm.prank(bob);
        registry.acceptPosition(bakerPos);

        // Verify final state
        assertEq(registry.getMemberShares(instId, bob), 40); // 35 + 5
        assertEq(registry.getShareholderCount(instId), 3);
        assertFalse(registry.isPositionVacant(bakerPos));

        (,,,,, address holder,) = registry.getPosition(bakerPos);
        assertEq(holder, bob);
    }

    // ─── Authz (outsider / non-founder / wrong candidate) ─────────────

    function _offeredPosition(address candidate, uint256 shareGrant)
        internal
        returns (uint256 instId, uint256 posId)
    {
        vm.prank(alice);
        instId = registry.createInstitution(communityAddr, "Authz Shop", 100, true);
        vm.prank(alice);
        posId = registry.createPosition(instId, "Clerk", "Sell things", 100, shareGrant);
        vm.prank(alice);
        registry.offerPosition(posId, candidate);
    }

    function test_RevertNonFounderAllocateShares() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Farm", 100, true);

        vm.prank(bob);
        vm.expectRevert("Only founders can allocate shares");
        registry.allocateShares(instId, charlie, 10);

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Only founders can allocate shares");
        registry.allocateShares(instId, charlie, 10);
    }

    function test_RevertAllocateToNonMember() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Farm", 100, true);

        address outsider = makeAddr("outsider");
        vm.prank(alice);
        vm.expectRevert("Recipient must be member");
        registry.allocateShares(instId, outsider, 10);
    }

    function test_RevertAllocateInactiveInstitution() public {
        vm.prank(alice);
        vm.expectRevert("Institution not active");
        registry.allocateShares(999, bob, 10);
    }

    function test_RevertNonFounderCreatePosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Gym", 40, false);

        vm.prank(bob);
        vm.expectRevert("Only founders can create positions");
        registry.createPosition(instId, "Trainer", "Train", 250, 0);

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Only founders can create positions");
        registry.createPosition(instId, "Trainer", "Train", 250, 0);
    }

    function test_RevertNonFounderOfferPosition() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Gym", 40, false);
        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Trainer", "Train", 250, 0);

        vm.prank(bob);
        vm.expectRevert("Only founders can offer positions");
        registry.offerPosition(posId, charlie);

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Only founders can offer positions");
        registry.offerPosition(posId, charlie);
    }

    function test_RevertOfferToNonMember() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Gym", 40, false);
        vm.prank(alice);
        uint256 posId = registry.createPosition(instId, "Trainer", "Train", 250, 0);

        address outsider = makeAddr("outsider");
        vm.prank(alice);
        vm.expectRevert("Candidate must be member");
        registry.offerPosition(posId, outsider);
    }

    function test_RevertDeclineByWrongCandidate() public {
        (, uint256 posId) = _offeredPosition(bob, 0);

        vm.prank(charlie);
        vm.expectRevert("Not offered to you");
        registry.declinePosition(posId);

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not offered to you");
        registry.declinePosition(posId);
    }

    function test_RevertVacateByNonHolder() public {
        (, uint256 posId) = _offeredPosition(bob, 0);
        vm.prank(bob);
        registry.acceptPosition(posId);

        vm.prank(charlie);
        vm.expectRevert("Not the position holder");
        registry.vacatePosition(posId);

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert("Not the position holder");
        registry.vacatePosition(posId);
    }

    // ─── Position state machine ───────────────────────────────────────

    function test_RevertDoubleAccept() public {
        (, uint256 posId) = _offeredPosition(bob, 0);
        vm.prank(bob);
        registry.acceptPosition(posId);

        vm.prank(bob);
        vm.expectRevert("Not offered to you");
        registry.acceptPosition(posId);
    }

    function test_RevertDeclineAfterAccept() public {
        (, uint256 posId) = _offeredPosition(bob, 0);
        vm.prank(bob);
        registry.acceptPosition(posId);

        vm.prank(bob);
        vm.expectRevert("Not offered to you");
        registry.declinePosition(posId);
    }

    function test_RevertAcceptAfterDecline() public {
        (, uint256 posId) = _offeredPosition(bob, 0);
        vm.prank(bob);
        registry.declinePosition(posId);

        vm.prank(bob);
        vm.expectRevert("Not offered to you");
        registry.acceptPosition(posId);
    }

    function test_ReofferReplacesPendingCandidate() public {
        (, uint256 posId) = _offeredPosition(bob, 0);

        vm.prank(alice);
        registry.offerPosition(posId, charlie);
        assertEq(registry.getPendingAssignment(posId), charlie);

        vm.prank(bob);
        vm.expectRevert("Not offered to you");
        registry.acceptPosition(posId);

        vm.prank(charlie);
        registry.acceptPosition(posId);
        (,,,,, address holder,) = registry.getPosition(posId);
        assertEq(holder, charlie);
    }

    function test_RevertAcceptAfterExile() public {
        (uint256 instId, uint256 posId) = _offeredPosition(bob, 5);

        vm.prank(alice);
        Community(communityAddr).removeMember(bob);
        assertFalse(Community(communityAddr).isMember(bob));

        vm.prank(bob);
        vm.expectRevert("Must be a member");
        registry.acceptPosition(posId);

        assertTrue(registry.isPositionVacant(posId));
        assertEq(registry.getPendingAssignment(posId), bob);
        assertEq(registry.getMemberShares(instId, bob), 0);
        assertEq(registry.outstandingShares(instId), 0);
    }

    function test_ExiledHolderCanVacate() public {
        (, uint256 posId) = _offeredPosition(bob, 0);
        vm.prank(bob);
        registry.acceptPosition(posId);

        vm.prank(alice);
        Community(communityAddr).removeMember(bob);

        vm.prank(bob);
        registry.vacatePosition(posId);
        assertTrue(registry.isPositionVacant(posId));
    }

    // ─── Share accounting ─────────────────────────────────────────────

    function test_RepeatAllocateDoesNotDuplicateShareholder() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Mill", 100, true);

        vm.startPrank(alice);
        registry.allocateShares(instId, bob, 10);
        registry.allocateShares(instId, bob, 15);
        vm.stopPrank();

        assertEq(registry.getShareholderCount(instId), 1);
        assertEq(registry.getMemberShares(instId, bob), 25);
        assertEq(registry.outstandingShares(instId), 25);
        assertEq(registry.institutionShareholders(instId, 0), bob);
    }

    function test_OutstandingSharesTracksAllocationsAndPositionGrants() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Mill", 100, true);

        vm.startPrank(alice);
        registry.allocateShares(instId, alice, 40);
        registry.allocateShares(instId, bob, 20);
        uint256 posId = registry.createPosition(instId, "Miller", "Mill grain", 0, 7);
        registry.offerPosition(posId, charlie);
        vm.stopPrank();

        vm.prank(charlie);
        registry.acceptPosition(posId);

        uint256 sum = registry.getMemberShares(instId, alice)
            + registry.getMemberShares(instId, bob)
            + registry.getMemberShares(instId, charlie);
        assertEq(sum, 67);
        assertEq(registry.outstandingShares(instId), 67);
        assertEq(registry.getShareholderCount(instId), 3);
    }

    function test_ReacceptAfterVacateGrantsAgain() public {
        // Current product behavior: shareGrant is applied on every accept.
        // Not treated as drift — outstandingShares stays coherent with balances.
        (uint256 instId, uint256 posId) = _offeredPosition(bob, 5);

        vm.prank(bob);
        registry.acceptPosition(posId);
        vm.prank(bob);
        registry.vacatePosition(posId);

        vm.prank(alice);
        registry.offerPosition(posId, bob);
        vm.prank(bob);
        registry.acceptPosition(posId);

        assertEq(registry.getMemberShares(instId, bob), 10);
        assertEq(registry.outstandingShares(instId), 10);
        assertEq(registry.getShareholderCount(instId), 1);
    }

    function test_ExiledMemberKeepsExistingShares() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Mill", 100, true);
        vm.prank(alice);
        registry.allocateShares(instId, bob, 12);

        vm.prank(alice);
        Community(communityAddr).removeMember(bob);

        assertEq(registry.getMemberShares(instId, bob), 12);
        assertEq(registry.outstandingShares(instId), 12);

        vm.prank(alice);
        vm.expectRevert("Recipient must be member");
        registry.allocateShares(instId, bob, 1);
    }

    // ─── ETH / payable-adjacent ───────────────────────────────────────

    function test_RegistryRejectsPlainETH() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(registry).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(registry).balance, 0);
    }
}
