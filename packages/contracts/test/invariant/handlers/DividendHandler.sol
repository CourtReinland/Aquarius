// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../../src/Community.sol";
import {InstitutionRegistry} from "../../../src/InstitutionRegistry.sol";
import {TokenModule} from "../../../src/TokenModule.sol";

/**
 * @notice Targeted handler for outstandingShares coherence and dividend payout bounds.
 */
contract DividendHandler is Test {
    InstitutionRegistry public immutable registry;
    TokenModule public immutable token;
    address public immutable community;
    address public immutable founder; // bank + founder

    address[] public actors;

    uint256 public institutionId;
    uint256 public ghostDistributed; // sum of successful _totalAmount args
    uint256 public ghostActuallyPaid; // sum of tokens leaving distributor
    uint256 public overpayEvents;
    uint256 public calls;

    constructor(
        InstitutionRegistry _registry,
        TokenModule _token,
        address _community,
        address _founder,
        address[] memory _actors
    ) {
        registry = _registry;
        token = _token;
        community = _community;
        founder = _founder;
        actors = _actors;

        vm.prank(_founder);
        institutionId = _registry.createInstitution(_community, "Inv Dividends Co", 1000, true);
    }

    function allocateShares(uint256 memberSeed, uint256 sharesSeed) external {
        address member = actors[bound(memberSeed, 0, actors.length - 1)];
        if (!Community(community).isMember(member)) {
            calls++;
            return;
        }
        uint256 shares = bound(sharesSeed, 1, 200);
        vm.prank(founder);
        try registry.allocateShares(institutionId, member, shares) {} catch {}
        calls++;
    }

    function createPositionWithGrant(uint256 grantSeed) external {
        uint256 grant = bound(grantSeed, 0, 50);
        vm.prank(founder);
        try registry.createPosition(institutionId, "Role", "Do work", 0, grant) {} catch {}
        calls++;
    }

    function offerAndAccept(uint256 positionSeed, uint256 memberSeed) external {
        uint256 nextPos = registry.nextPositionId();
        if (nextPos == 0) {
            calls++;
            return;
        }
        uint256 posId = bound(positionSeed, 0, nextPos - 1);
        address member = actors[bound(memberSeed, 0, actors.length - 1)];
        if (!Community(community).isMember(member) || member == founder) {
            // founder can still accept if offered
        }
        if (!Community(community).isMember(member)) {
            calls++;
            return;
        }

        vm.prank(founder);
        try registry.offerPosition(posId, member) {
            vm.prank(member);
            try registry.acceptPosition(posId) {} catch {}
        } catch {}
        calls++;
    }

    function distribute(uint256 amountSeed, uint256 approveSeed) external {
        uint256 outstanding = registry.outstandingShares(institutionId);
        if (outstanding == 0) {
            calls++;
            return;
        }

        uint256 amount = bound(amountSeed, 1, 10_000 * 1e18);
        // Sometimes under-approve / under-fund to exercise require paths
        uint256 approveAmt = bound(approveSeed, 0, amount + amount / 2);

        // Top up bank balance as needed
        uint256 bankBal = token.balanceOf(founder);
        if (bankBal < approveAmt) {
            // Cannot mint under Austrian locked config — transfer nothing; approve what we have
            approveAmt = bankBal;
        }

        vm.startPrank(founder);
        token.approve(address(registry), approveAmt);
        uint256 balBefore = token.balanceOf(founder);
        try registry.distributeDividends(institutionId, address(token), amount) {
            uint256 paid = balBefore - token.balanceOf(founder);
            ghostDistributed += amount;
            ghostActuallyPaid += paid;
            if (paid > amount) {
                overpayEvents++;
            }
            // Also cannot exceed approval that was spent — transferFrom enforces
            if (paid > approveAmt) {
                overpayEvents++;
            }
        } catch {}
        vm.stopPrank();
        calls++;
    }

    function sumShareholdings() external view returns (uint256 sum) {
        uint256 n = registry.getShareholderCount(institutionId);
        // institutionShareholders is public mapping to array — use count + getMemberShares via actors + scan
        // We don't have a public getter for the full array contents by index beyond the auto getter.
        for (uint256 i = 0; i < n; i++) {
            address holder = registry.institutionShareholders(institutionId, i);
            sum += registry.shareholdings(institutionId, holder);
        }
    }
}
