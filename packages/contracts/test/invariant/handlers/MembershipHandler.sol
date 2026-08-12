// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../../src/Community.sol";

/**
 * @notice Targeted handler for membership / founder / initialize-once invariants.
 */
contract MembershipHandler is Test {
    Community public immutable community;
    address public immutable founder;

    address[] public pool; // candidate addresses (members + outsiders)
    address[] public founders;

    uint256 public founderRemovedSucceeded;
    uint256 public zeroAddressMemberSucceeded;
    uint256 public reinitializeSucceeded;
    uint256 public calls;

    constructor(Community _community, address _founder, address[] memory _pool) {
        community = _community;
        founder = _founder;
        pool = _pool;
        founders = _community.getFounders();
    }

    function addMember(uint256 actorSeed, uint256 targetSeed) external {
        address actor = pool[bound(actorSeed, 0, pool.length - 1)];
        address target = pool[bound(targetSeed, 0, pool.length - 1)];

        vm.prank(actor);
        try community.addMember(target) {} catch {}
        calls++;
    }

    function addZeroAddress(uint256 actorSeed) external {
        address actor = pool[bound(actorSeed, 0, pool.length - 1)];
        vm.prank(actor);
        try community.addMember(address(0)) {
            zeroAddressMemberSucceeded++;
        } catch {}
        calls++;
    }

    function removeMember(uint256 actorSeed, uint256 targetSeed) external {
        address actor = pool[bound(actorSeed, 0, pool.length - 1)];
        address target = pool[bound(targetSeed, 0, pool.length - 1)];

        bool wasFounder = community.isFounder(target);
        vm.prank(actor);
        try community.removeMember(target) {
            if (wasFounder) {
                founderRemovedSucceeded++;
            }
        } catch {}
        calls++;
    }

    function removeFounderDirect(uint256 founderSeed) external {
        address f = founders[bound(founderSeed, 0, founders.length - 1)];
        vm.prank(founder);
        try community.removeMember(f) {
            founderRemovedSucceeded++;
        } catch {}
        calls++;
    }

    function tryReinitialize(uint256 nameSeed) external {
        address[] memory fs = new address[](1);
        fs[0] = founder;
        string memory name = nameSeed % 2 == 0 ? "Hijack" : "Hijack2";
        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersOnly,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOnly,
            requireBuyIn: false
        });
        // Deployer is CommunityFactory in normal flow; onlyOnce must still block.
        vm.prank(community.deployer());
        try community.initialize(name, "", fs, bylaws, "", "", false) {
            reinitializeSucceeded++;
        } catch {}
        calls++;
    }
}
