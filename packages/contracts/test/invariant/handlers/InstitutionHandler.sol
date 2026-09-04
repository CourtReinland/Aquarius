// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../../src/Community.sol";
import {InstitutionRegistry} from "../../../src/InstitutionRegistry.sol";

/**
 * @notice Targeted handler for InstitutionRegistry authz, position state machine,
 *         and share-accounting invariants.
 * @dev Expected reverts are swallowed. Counters increment only when a call that
 *      should have been rejected succeeds.
 */
contract InstitutionHandler is Test {
    InstitutionRegistry public immutable registry;
    Community public immutable community;
    address public immutable founder;

    address[] public actors;

    uint256 public calls;

    uint256 public unauthorizedCreateSucceeded;
    uint256 public unauthorizedAllocateSucceeded;
    uint256 public unauthorizedCreatePositionSucceeded;
    uint256 public unauthorizedOfferSucceeded;
    uint256 public unauthorizedAcceptSucceeded;
    uint256 public unauthorizedDeclineSucceeded;
    uint256 public unauthorizedVacateSucceeded;
    uint256 public allocateToNonMemberSucceeded;
    uint256 public allocateInactiveSucceeded;
    uint256 public illegalOfferOccupiedSucceeded;
    uint256 public illegalAcceptNoOfferSucceeded;
    uint256 public illegalDoubleAcceptSucceeded;
    uint256 public illegalDeclineAfterAcceptSucceeded;
    uint256 public sharesGrantedToNonMember;

    constructor(
        InstitutionRegistry _registry,
        address _community,
        address _founder,
        address[] memory _actors
    ) {
        registry = _registry;
        community = Community(_community);
        founder = _founder;
        actors = _actors;

        vm.prank(_founder);
        _registry.createInstitution(_community, "Inv Institution", 1000, true);
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    // ─── Actions ──────────────────────────────────────────────────────

    function createInstitution(uint256 actorSeed, uint256 sharesSeed) external {
        address actor = _actor(actorSeed);
        uint256 shares = bound(sharesSeed, 1, 5000);
        bool allowed = community.isMember(actor);

        vm.prank(actor);
        try registry.createInstitution(address(community), "Inst", shares, true) {
            if (!allowed) unauthorizedCreateSucceeded++;
        } catch {}
        calls++;
    }

    function allocateShares(
        uint256 actorSeed,
        uint256 instSeed,
        uint256 memberSeed,
        uint256 sharesSeed
    ) external {
        uint256 n = registry.nextInstitutionId();
        if (n == 0) {
            calls++;
            return;
        }

        address actor = _actor(actorSeed);
        // Include `n` so nonexistent / inactive ids are exercised.
        uint256 instId = bound(instSeed, 0, n);
        address recipient = _actor(memberSeed);
        uint256 shares = bound(sharesSeed, 1, 200);

        bool founderOk = community.isFounder(actor);
        bool recipientOk = community.isMember(recipient);
        (,,,, bool active,,) = registry.getInstitution(instId);

        vm.prank(actor);
        try registry.allocateShares(instId, recipient, shares) {
            if (!founderOk) unauthorizedAllocateSucceeded++;
            if (!recipientOk) allocateToNonMemberSucceeded++;
            if (!active) allocateInactiveSucceeded++;
        } catch {}
        calls++;
    }

    function createPosition(uint256 actorSeed, uint256 instSeed, uint256 grantSeed) external {
        uint256 n = registry.nextInstitutionId();
        if (n == 0) {
            calls++;
            return;
        }

        address actor = _actor(actorSeed);
        uint256 instId = bound(instSeed, 0, n);
        uint256 grant = bound(grantSeed, 0, 40);
        bool founderOk = community.isFounder(actor);

        vm.prank(actor);
        try registry.createPosition(instId, "Role", "Do work", 0, grant) {
            if (!founderOk) unauthorizedCreatePositionSucceeded++;
        } catch {}
        calls++;
    }

    function offerPosition(uint256 actorSeed, uint256 posSeed, uint256 candidateSeed) external {
        uint256 n = registry.nextPositionId();
        if (n == 0) {
            calls++;
            return;
        }

        address actor = _actor(actorSeed);
        uint256 posId = bound(posSeed, 0, n - 1);
        address candidate = _actor(candidateSeed);

        bool founderOk = community.isFounder(actor);
        (,,,,, address holder,) = registry.getPosition(posId);

        vm.prank(actor);
        try registry.offerPosition(posId, candidate) {
            if (!founderOk) unauthorizedOfferSucceeded++;
            if (holder != address(0)) illegalOfferOccupiedSucceeded++;
        } catch {}
        calls++;
    }

    function acceptPosition(uint256 actorSeed, uint256 posSeed) external {
        uint256 n = registry.nextPositionId();
        if (n == 0) {
            calls++;
            return;
        }

        address actor = _actor(actorSeed);
        uint256 posId = bound(posSeed, 0, n - 1);

        address pending = registry.getPendingAssignment(posId);
        (,,,, uint256 shareGrant, address holder,) = registry.getPosition(posId);
        bool memberOk = community.isMember(actor);

        vm.prank(actor);
        try registry.acceptPosition(posId) {
            if (pending != actor) {
                unauthorizedAcceptSucceeded++;
                if (pending == address(0)) illegalAcceptNoOfferSucceeded++;
            }
            if (holder == actor) illegalDoubleAcceptSucceeded++;
            if (holder != address(0) && holder != actor) unauthorizedAcceptSucceeded++;
            if (!memberOk) {
                unauthorizedAcceptSucceeded++;
                if (shareGrant > 0) sharesGrantedToNonMember++;
            }
        } catch {}
        calls++;
    }

    function declinePosition(uint256 actorSeed, uint256 posSeed) external {
        uint256 n = registry.nextPositionId();
        if (n == 0) {
            calls++;
            return;
        }

        address actor = _actor(actorSeed);
        uint256 posId = bound(posSeed, 0, n - 1);

        address pending = registry.getPendingAssignment(posId);
        (,,,,, address holder,) = registry.getPosition(posId);

        vm.prank(actor);
        try registry.declinePosition(posId) {
            if (pending != actor) unauthorizedDeclineSucceeded++;
            if (holder != address(0) && pending == address(0)) {
                illegalDeclineAfterAcceptSucceeded++;
            }
        } catch {}
        calls++;
    }

    function vacatePosition(uint256 actorSeed, uint256 posSeed) external {
        uint256 n = registry.nextPositionId();
        if (n == 0) {
            calls++;
            return;
        }

        address actor = _actor(actorSeed);
        uint256 posId = bound(posSeed, 0, n - 1);
        (,,,,, address holder,) = registry.getPosition(posId);

        vm.prank(actor);
        try registry.vacatePosition(posId) {
            if (holder != actor) unauthorizedVacateSucceeded++;
        } catch {}
        calls++;
    }

    function exileMember(uint256 targetSeed) external {
        address target = _actor(targetSeed);
        if (target == founder || !community.isMember(target)) {
            calls++;
            return;
        }
        vm.prank(founder);
        try community.removeMember(target) {} catch {}
        calls++;
    }

    function reinstateMember(uint256 targetSeed) external {
        address target = _actor(targetSeed);
        if (community.isMember(target)) {
            calls++;
            return;
        }
        vm.prank(founder);
        try community.addMember(target) {} catch {}
        calls++;
    }

    // ─── Views for invariants ─────────────────────────────────────────

    function sumShareholdings(uint256 instId) external view returns (uint256 sum) {
        uint256 n = registry.getShareholderCount(instId);
        for (uint256 i = 0; i < n; i++) {
            address holder = registry.institutionShareholders(instId, i);
            sum += registry.shareholdings(instId, holder);
        }
    }

    function hasShareholderDuplicate(uint256 instId) external view returns (bool) {
        uint256 n = registry.getShareholderCount(instId);
        for (uint256 i = 0; i < n; i++) {
            address a = registry.institutionShareholders(instId, i);
            for (uint256 j = i + 1; j < n; j++) {
                if (a == registry.institutionShareholders(instId, j)) return true;
            }
        }
        return false;
    }

    function unlistedPositiveShares(uint256 instId) external view returns (bool) {
        uint256 n = registry.getShareholderCount(instId);
        for (uint256 a = 0; a < actors.length; a++) {
            address actor = actors[a];
            if (registry.shareholdings(instId, actor) == 0) continue;
            bool found = false;
            for (uint256 i = 0; i < n; i++) {
                if (registry.institutionShareholders(instId, i) == actor) {
                    found = true;
                    break;
                }
            }
            if (!found) return true;
        }
        return false;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }
}
