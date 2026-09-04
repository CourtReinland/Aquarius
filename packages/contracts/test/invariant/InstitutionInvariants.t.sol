// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../src/Community.sol";
import {CommunityFactory} from "../../src/CommunityFactory.sol";
import {InstitutionRegistry} from "../../src/InstitutionRegistry.sol";

import {InstitutionHandler} from "./handlers/InstitutionHandler.sol";

/**
 * @title InstitutionInvariants
 * @notice Authz, position state machine, and share-accounting properties for
 *         InstitutionRegistry. Dividend payout bounds stay in DividendInvariants.
 *
 * Properties:
 *  1. Outsiders cannot create institutions; non-founders cannot allocate /
 *     create positions / offer.
 *  2. Accept / decline only the pending candidate; vacate only the holder.
 *  3. No accept without offer, double-accept, offer-while-occupied, or
 *     decline-after-accept.
 *  4. Shares are never granted to a non-member (allocate or position grant).
 *  5. outstandingShares == sum(shareholdings) per institution.
 *  6. Shareholder lists have no duplicates; every positive balance is listed.
 *  7. A filled position never has a pending assignment (and vice versa).
 */
contract InstitutionInvariants is Test {
    CommunityFactory internal factory;
    InstitutionRegistry internal registry;
    InstitutionHandler internal handler;

    address internal alice = makeAddr("inst-alice");
    address internal bob = makeAddr("inst-bob");
    address internal charlie = makeAddr("inst-charlie");
    address internal outsider = makeAddr("inst-outsider");

    address internal communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        registry = new InstitutionRegistry();

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
        communityAddr = factory.createCommunity("InstInv", "", founders, bylaws, "", "", false);

        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        vm.stopPrank();

        address[] memory actors = new address[](4);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = charlie;
        actors[3] = outsider;

        handler = new InstitutionHandler(registry, communityAddr, alice, actors);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = InstitutionHandler.createInstitution.selector;
        selectors[1] = InstitutionHandler.allocateShares.selector;
        selectors[2] = InstitutionHandler.createPosition.selector;
        selectors[3] = InstitutionHandler.offerPosition.selector;
        selectors[4] = InstitutionHandler.acceptPosition.selector;
        selectors[5] = InstitutionHandler.declinePosition.selector;
        selectors[6] = InstitutionHandler.vacatePosition.selector;
        selectors[7] = InstitutionHandler.exileMember.selector;
        selectors[8] = InstitutionHandler.reinstateMember.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_authzGates() public view {
        assertEq(handler.unauthorizedCreateSucceeded(), 0, "outsider created institution");
        assertEq(handler.unauthorizedAllocateSucceeded(), 0, "non-founder allocated shares");
        assertEq(handler.unauthorizedCreatePositionSucceeded(), 0, "non-founder created position");
        assertEq(handler.unauthorizedOfferSucceeded(), 0, "non-founder offered position");
        assertEq(handler.unauthorizedAcceptSucceeded(), 0, "unauthorized accept succeeded");
        assertEq(handler.unauthorizedDeclineSucceeded(), 0, "unauthorized decline succeeded");
        assertEq(handler.unauthorizedVacateSucceeded(), 0, "unauthorized vacate succeeded");
        assertEq(handler.allocateToNonMemberSucceeded(), 0, "allocated to non-member");
        assertEq(handler.allocateInactiveSucceeded(), 0, "allocated on inactive institution");
        assertEq(handler.sharesGrantedToNonMember(), 0, "position grant to non-member");
    }

    function invariant_positionStateMachine() public view {
        assertEq(handler.illegalOfferOccupiedSucceeded(), 0, "offer while occupied");
        assertEq(handler.illegalAcceptNoOfferSucceeded(), 0, "accept without offer");
        assertEq(handler.illegalDoubleAcceptSucceeded(), 0, "double accept");
        assertEq(handler.illegalDeclineAfterAcceptSucceeded(), 0, "decline after accept");

        uint256 n = registry.nextPositionId();
        for (uint256 posId = 0; posId < n; posId++) {
            address pending = registry.getPendingAssignment(posId);
            (,,,,, address holder,) = registry.getPosition(posId);
            if (holder != address(0)) {
                assertEq(pending, address(0), "filled position still pending");
            }
            if (pending != address(0)) {
                assertEq(holder, address(0), "pending assignment on filled position");
            }
        }
    }

    function invariant_shareAccounting() public view {
        uint256 n = registry.nextInstitutionId();
        for (uint256 instId = 0; instId < n; instId++) {
            assertEq(
                registry.outstandingShares(instId),
                handler.sumShareholdings(instId),
                "outstandingShares != sum shareholdings"
            );
            assertFalse(handler.hasShareholderDuplicate(instId), "duplicate shareholder");
            assertFalse(handler.unlistedPositiveShares(instId), "positive shares not listed");
        }
    }
}
