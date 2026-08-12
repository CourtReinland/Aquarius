// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../../src/Community.sol";
import {GovernanceModule} from "../../../src/GovernanceModule.sol";

/// @dev Receiver that can reject ETH pushes so refunds land in claimableRefunds.
contract InvariantRefundReceiver {
    GovernanceModule public immutable gov;
    bool public accept;

    constructor(GovernanceModule _gov) {
        gov = _gov;
        accept = false;
    }

    function setAccept(bool _accept) external {
        accept = _accept;
    }

    receive() external payable {
        require(accept, "reject");
    }

    function claim() external {
        gov.claimRefund();
    }
}

/// @dev Trivial deployable bytecode target for smart proposals.
contract InvariantTiny {
    uint256 public x = 1;
}

/**
 * @notice Targeted handler for governance refund + status-machine invariants.
 * @dev Bounds actors/actions so most calls are meaningful; expected failures are swallowed.
 */
contract GovernanceHandler is Test {
    GovernanceModule public immutable gov;
    address public immutable community;

    address[] public actors;
    InvariantRefundReceiver public rejector;

    uint256 public ghostEthIn;
    uint256 public ghostEthOut;
    uint256 public ghostClaims;
    uint256 public calls;

    // Proposal bookkeeping for status-machine checks
    uint256 public maxProposalIdSeen;
    mapping(uint256 => GovernanceModule.ProposalStatus) public lastStatus;
    mapping(uint256 => bool) public seenProposal;
    mapping(uint256 => bool) public isSmart;
    mapping(uint256 => bool) public everPassed;

    // Illegal transition / double-claim counters (must stay 0)
    uint256 public illegalTransitions;
    uint256 public doubleClaimAttemptsSucceeded;
    uint256 public votesAfterEndSucceeded;
    uint256 public finalizeBeforeEndSucceeded;
    uint256 public executeFromNonPassedSucceeded;

    bytes public tinyBytecode;

    constructor(GovernanceModule _gov, address _community, address[] memory _actors) {
        gov = _gov;
        community = _community;
        actors = _actors;

        rejector = new InvariantRefundReceiver(_gov);
        vm.prank(_actors[0]); // founder
        Community(_community).addMember(address(rejector));
        actors.push(address(rejector));

        tinyBytecode = type(InvariantTiny).creationCode;

        // Seed ETH
        for (uint256 i = 0; i < actors.length; i++) {
            vm.deal(actors[i], 100 ether);
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    // ─── Actions ──────────────────────────────────────────────────────

    function createProposal(uint256 actorSeed, uint256 durationSeed) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 duration = bound(durationSeed, 300, 2 days);

        vm.prank(actor);
        try gov.createProposal(
            community,
            "inv-proposal",
            "",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            duration,
            GovernanceModule.OutcomeType.OneTimeFee,
            0.1 ether,
            0.3 ether, // threshold so some finals fail refund path
            "InvInst"
        ) returns (uint256 pid) {
            _recordNew(pid, false);
        } catch {}
        calls++;
    }

    function createSmartProposal(uint256 actorSeed, uint256 durationSeed) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 duration = bound(durationSeed, 300, 2 days);

        vm.prank(actor);
        try gov.createSmartProposal(
            community,
            "inv-smart",
            "",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            duration,
            0.1 ether,
            0, // no threshold — easier pass → execute
            "SmartInst",
            tinyBytecode
        ) returns (uint256 pid) {
            _recordNew(pid, true);
        } catch {}
        calls++;
    }

    function castYes(uint256 actorSeed, uint256 proposalSeed, uint256 valueSeed) external {
        if (gov.nextProposalId() == 0) {
            calls++;
            return;
        }
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 pid = bound(proposalSeed, 0, gov.nextProposalId() - 1);

        (,,, GovernanceModule.ProposalStatus status,,,,, uint256 endTime,, uint256 cost) =
            _proposalView(pid);

        if (status != GovernanceModule.ProposalStatus.Active) {
            calls++;
            return;
        }
        if (block.timestamp > endTime) {
            // Attempt illegal late vote — must fail
            uint256 pay = cost > 0 ? cost : 0;
            if (actor.balance < pay) vm.deal(actor, pay + 1 ether);
            vm.prank(actor);
            try gov.castVote{value: pay}(pid, true) {
                votesAfterEndSucceeded++;
            } catch {}
            calls++;
            return;
        }

        uint256 value = cost;
        if (cost > 0) {
            // Occasionally overfund
            value = bound(valueSeed, cost, cost + 0.5 ether);
        } else {
            value = 0;
        }
        if (actor.balance < value) vm.deal(actor, value + 1 ether);

        // Toggle rejector accept randomly via valueSeed parity so some pushes fail
        if (actor == address(rejector)) {
            rejector.setAccept(valueSeed % 3 == 0);
        }

        uint256 balBefore = address(gov).balance;
        vm.prank(actor);
        try gov.castVote{value: value}(pid, true) {
            uint256 gained = address(gov).balance - balBefore;
            ghostEthIn += gained;
            _syncStatus(pid);
        } catch {}
        calls++;
    }

    function castNo(uint256 actorSeed, uint256 proposalSeed) external {
        if (gov.nextProposalId() == 0) {
            calls++;
            return;
        }
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 pid = bound(proposalSeed, 0, gov.nextProposalId() - 1);

        (,,, GovernanceModule.ProposalStatus status,,,,, uint256 endTime,,) = _proposalView(pid);
        if (status != GovernanceModule.ProposalStatus.Active || block.timestamp > endTime) {
            calls++;
            return;
        }

        vm.prank(actor);
        try gov.castVote(pid, false) {
            _syncStatus(pid);
        } catch {}
        calls++;
    }

    function warpTowardEnd(uint256 proposalSeed, uint256 skipSeed) external {
        if (gov.nextProposalId() == 0) {
            calls++;
            return;
        }
        uint256 pid = bound(proposalSeed, 0, gov.nextProposalId() - 1);
        (,,,,,,,, uint256 endTime,,) = _proposalView(pid);
        if (block.timestamp >= endTime) {
            calls++;
            return;
        }
        uint256 remaining = endTime - block.timestamp;
        uint256 skip = bound(skipSeed, 1, remaining + 1);
        vm.warp(block.timestamp + skip);
        calls++;
    }

    function finalize(uint256 proposalSeed) external {
        if (gov.nextProposalId() == 0) {
            calls++;
            return;
        }
        uint256 pid = bound(proposalSeed, 0, gov.nextProposalId() - 1);
        (,,, GovernanceModule.ProposalStatus status,,,,, uint256 endTime,,) = _proposalView(pid);

        if (status != GovernanceModule.ProposalStatus.Active) {
            calls++;
            return;
        }

        if (block.timestamp <= endTime) {
            try gov.finalizeProposal(pid) {
                finalizeBeforeEndSucceeded++;
            } catch {}
            calls++;
            return;
        }

        uint256 balBefore = address(gov).balance;
        try gov.finalizeProposal(pid) {
            _afterRefundPath(balBefore);
            _syncStatus(pid);
        } catch {}
        calls++;
    }

    function cancel(uint256 actorSeed, uint256 proposalSeed) external {
        if (gov.nextProposalId() == 0) {
            calls++;
            return;
        }
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 pid = bound(proposalSeed, 0, gov.nextProposalId() - 1);

        (,,, GovernanceModule.ProposalStatus status,,,,,,,) = _proposalView(pid);
        if (status != GovernanceModule.ProposalStatus.Active) {
            calls++;
            return;
        }

        uint256 balBefore = address(gov).balance;
        vm.prank(actor);
        try gov.cancelProposal(pid) {
            _afterRefundPath(balBefore);
            _syncStatus(pid);
        } catch {}
        calls++;
    }

    function claimRefund(uint256 actorSeed) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 claimable = gov.claimableRefunds(actor);
        if (claimable == 0) {
            // Double-claim / empty claim must fail
            if (actor == address(rejector)) {
                rejector.setAccept(true);
                try rejector.claim() {
                    doubleClaimAttemptsSucceeded++;
                } catch {}
            } else {
                vm.prank(actor);
                try gov.claimRefund() {
                    doubleClaimAttemptsSucceeded++;
                } catch {}
            }
            calls++;
            return;
        }

        if (actor == address(rejector)) {
            rejector.setAccept(true);
            uint256 balBefore = address(gov).balance;
            try rejector.claim() {
                uint256 sent = balBefore - address(gov).balance;
                ghostEthOut += sent;
                ghostClaims++;
            } catch {}
        } else {
            uint256 balBefore = address(gov).balance;
            vm.prank(actor);
            try gov.claimRefund() {
                uint256 sent = balBefore - address(gov).balance;
                ghostEthOut += sent;
                ghostClaims++;
            } catch {}
        }
        calls++;
    }

    function execute(uint256 proposalSeed) external {
        if (gov.nextProposalId() == 0) {
            calls++;
            return;
        }
        uint256 pid = bound(proposalSeed, 0, gov.nextProposalId() - 1);
        (,,, GovernanceModule.ProposalStatus status,,,,,,,) = _proposalView(pid);

        if (status != GovernanceModule.ProposalStatus.Passed) {
            try gov.executeProposal(pid) {
                executeFromNonPassedSucceeded++;
            } catch {}
            calls++;
            return;
        }

        try gov.executeProposal(pid) {
            _syncStatus(pid);
        } catch {}
        calls++;
    }

    // ─── Views for invariants ─────────────────────────────────────────

    function sumClaimable() external view returns (uint256) {
        return _sumClaimable();
    }

    function sumRemainingFunded() external view returns (uint256 sum) {
        uint256 n = gov.nextProposalId();
        for (uint256 pid = 0; pid < n; pid++) {
            (
                ,,,
                GovernanceModule.ProposalStatus status,
                ,,
                uint256 totalFunded,,,,
            ) = gov.getProposal(pid);
            if (
                status == GovernanceModule.ProposalStatus.Active
                    || status == GovernanceModule.ProposalStatus.Passed
                    || status == GovernanceModule.ProposalStatus.Executed
            ) {
                sum += totalFunded;
            }
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────

    function _recordNew(uint256 pid, bool smart) internal {
        seenProposal[pid] = true;
        isSmart[pid] = smart;
        lastStatus[pid] = GovernanceModule.ProposalStatus.Active;
        if (pid > maxProposalIdSeen) maxProposalIdSeen = pid;
    }

    function _syncStatus(uint256 pid) internal {
        (,,, GovernanceModule.ProposalStatus status,,,,,,,) = _proposalView(pid);
        if (!seenProposal[pid]) {
            seenProposal[pid] = true;
            lastStatus[pid] = status;
            return;
        }

        GovernanceModule.ProposalStatus prev = lastStatus[pid];
        if (!_legalTransition(prev, status)) {
            illegalTransitions++;
        }
        if (status == GovernanceModule.ProposalStatus.Passed) {
            everPassed[pid] = true;
        }
        if (
            status == GovernanceModule.ProposalStatus.Executed && !everPassed[pid]
                && prev != GovernanceModule.ProposalStatus.Passed
        ) {
            // Executed without ever being Passed
            illegalTransitions++;
        }
        lastStatus[pid] = status;
    }

    function _legalTransition(
        GovernanceModule.ProposalStatus prev,
        GovernanceModule.ProposalStatus next
    ) internal pure returns (bool) {
        if (prev == next) return true;
        if (prev == GovernanceModule.ProposalStatus.Active) {
            return next == GovernanceModule.ProposalStatus.Passed
                || next == GovernanceModule.ProposalStatus.Failed
                || next == GovernanceModule.ProposalStatus.Cancelled;
        }
        if (prev == GovernanceModule.ProposalStatus.Passed) {
            return next == GovernanceModule.ProposalStatus.Executed;
        }
        // Failed / Cancelled / Executed are terminal
        return false;
    }

    function _afterRefundPath(uint256 balBefore) internal {
        uint256 balAfter = address(gov).balance;
        // ETH that left the contract went to actors (successful pushes).
        // Failed pushes remain in claimableRefunds and keep the balance unchanged.
        if (balAfter < balBefore) {
            ghostEthOut += (balBefore - balAfter);
        }
    }

    function _sumClaimable() internal view returns (uint256 sum) {
        for (uint256 i = 0; i < actors.length; i++) {
            sum += gov.claimableRefunds(actors[i]);
        }
    }

    function _proposalView(uint256 pid)
        internal
        view
        returns (
            string memory title,
            address proposer,
            string memory communityName,
            GovernanceModule.ProposalStatus status,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 totalFunded,
            uint256 startTime,
            uint256 endTime,
            GovernanceModule.OutcomeType outcomeType,
            uint256 fundingCostPerYes
        )
    {
        return gov.getProposal(pid);
    }

}
