// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../../src/Community.sol";
import {AllianceModule} from "../../../src/AllianceModule.sol";

/**
 * @notice Targeted handler for AllianceModule access-control, status-machine,
 *         cross-community spoofing, and list-accounting invariants.
 * @dev Bounds actors to three factory communities plus members/outsider.
 *      Expected reverts are swallowed; illegal successes increment ghosts.
 */
contract AllianceHandler is Test {
    AllianceModule public immutable alliance;

    address public immutable commA;
    address public immutable commB;
    address public immutable commC;

    address public immutable founderA;
    address public immutable founderB;
    address public immutable founderC;

    address[] public actors;
    address[] public communities;

    uint256 public calls;

    // Illegal / unauthorized success counters (must stay 0)
    uint256 public unauthorizedProposeSucceeded;
    uint256 public unauthorizedAcceptSucceeded;
    uint256 public unauthorizedDeclineSucceeded;
    uint256 public unauthorizedDissolveSucceeded;
    uint256 public crossCommunityAcceptSucceeded;
    uint256 public illegalTransitions;
    uint256 public doubleAcceptSucceeded;
    uint256 public doubleDissolveSucceeded;
    uint256 public selfAllianceSucceeded;
    uint256 public invalidCommunitySucceeded;
    uint256 public unexpectedEthAccepted;

    mapping(uint256 => AllianceModule.AllianceStatus) public lastStatus;
    mapping(uint256 => bool) public seen;
    mapping(uint256 => bool) public everActive;
    mapping(uint256 => bool) public everProposed;

    constructor(
        AllianceModule _alliance,
        address _commA,
        address _commB,
        address _commC,
        address _founderA,
        address _founderB,
        address _founderC,
        address[] memory _actors
    ) {
        alliance = _alliance;
        commA = _commA;
        commB = _commB;
        commC = _commC;
        founderA = _founderA;
        founderB = _founderB;
        founderC = _founderC;
        actors = _actors;

        communities = new address[](3);
        communities[0] = _commA;
        communities[1] = _commB;
        communities[2] = _commC;

        vm.deal(address(this), 10 ether);
    }

    // ─── Authorized / mixed actions ───────────────────────────────────

    function proposeAsFounder(uint256 fromSeed, uint256 toSeed) external {
        address from = communities[bound(fromSeed, 0, communities.length - 1)];
        address to = communities[bound(toSeed, 0, communities.length - 1)];
        if (from == to) {
            calls++;
            return;
        }

        vm.prank(_founderOf(from));
        try alliance.proposeAlliance(from, to, "inv-terms", 0, true, false) returns (uint256 id) {
            _recordNew(id);
        } catch {}
        calls++;
    }

    function acceptAsTarget(uint256 idSeed) external {
        uint256 n = alliance.nextAllianceId();
        if (n == 0) {
            calls++;
            return;
        }
        uint256 id = bound(idSeed, 0, n - 1);
        (, address cb, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        address actor = _founderOf(cb);

        if (status != AllianceModule.AllianceStatus.Proposed) {
            vm.prank(actor);
            try alliance.acceptAlliance(id) {
                if (status == AllianceModule.AllianceStatus.Active) {
                    doubleAcceptSucceeded++;
                }
                illegalTransitions++;
            } catch {}
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.acceptAlliance(id) {
            everActive[id] = true;
            _syncStatus(id);
        } catch {}
        calls++;
    }

    function declineAsTarget(uint256 idSeed) external {
        uint256 n = alliance.nextAllianceId();
        if (n == 0) {
            calls++;
            return;
        }
        uint256 id = bound(idSeed, 0, n - 1);
        (, address cb, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        address actor = _founderOf(cb);

        if (status != AllianceModule.AllianceStatus.Proposed) {
            vm.prank(actor);
            try alliance.declineAlliance(id) {
                illegalTransitions++;
            } catch {}
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.declineAlliance(id) {
            _syncStatus(id);
        } catch {}
        calls++;
    }

    function dissolveAsPartyFounder(uint256 idSeed, uint256 sideSeed) external {
        uint256 n = alliance.nextAllianceId();
        if (n == 0) {
            calls++;
            return;
        }
        uint256 id = bound(idSeed, 0, n - 1);
        (address ca, address cb, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        address actor = sideSeed % 2 == 0 ? _founderOf(ca) : _founderOf(cb);

        if (status != AllianceModule.AllianceStatus.Active) {
            vm.prank(actor);
            try alliance.dissolveAlliance(id) {
                if (status == AllianceModule.AllianceStatus.Dissolved && everActive[id]) {
                    doubleDissolveSucceeded++;
                }
                illegalTransitions++;
            } catch {}
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.dissolveAlliance(id) {
            _syncStatus(id);
        } catch {}
        calls++;
    }

    // ─── Unauthorized / spoof / invalid attempts ──────────────────────

    function proposeUnauthorized(uint256 actorSeed, uint256 fromSeed, uint256 toSeed) external {
        address from = communities[bound(fromSeed, 0, communities.length - 1)];
        address to = communities[bound(toSeed, 0, communities.length - 1)];
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];

        if (from == to || Community(from).isFounder(actor)) {
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.proposeAlliance(from, to, "spoof", 0, false, false) {
            unauthorizedProposeSucceeded++;
        } catch {}
        calls++;
    }

    function acceptAsSpoof(uint256 actorSeed, uint256 idSeed) external {
        uint256 n = alliance.nextAllianceId();
        if (n == 0) {
            calls++;
            return;
        }
        uint256 id = bound(idSeed, 0, n - 1);
        (address ca, address cb,, ,,) = alliance.getAlliance(id);
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];

        if (Community(cb).isFounder(actor)) {
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.acceptAlliance(id) {
            unauthorizedAcceptSucceeded++;
            if (_isTrackedFounder(actor) || Community(ca).isFounder(actor)) {
                crossCommunityAcceptSucceeded++;
            }
            _syncStatus(id);
        } catch {}
        calls++;
    }

    function declineAsSpoof(uint256 actorSeed, uint256 idSeed) external {
        uint256 n = alliance.nextAllianceId();
        if (n == 0) {
            calls++;
            return;
        }
        uint256 id = bound(idSeed, 0, n - 1);
        (, address cb,, ,,) = alliance.getAlliance(id);
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];

        if (Community(cb).isFounder(actor)) {
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.declineAlliance(id) {
            unauthorizedDeclineSucceeded++;
            _syncStatus(id);
        } catch {}
        calls++;
    }

    function dissolveAsSpoof(uint256 actorSeed, uint256 idSeed) external {
        uint256 n = alliance.nextAllianceId();
        if (n == 0) {
            calls++;
            return;
        }
        uint256 id = bound(idSeed, 0, n - 1);
        (address ca, address cb,, ,,) = alliance.getAlliance(id);
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];

        if (Community(ca).isFounder(actor) || Community(cb).isFounder(actor)) {
            calls++;
            return;
        }

        vm.prank(actor);
        try alliance.dissolveAlliance(id) {
            unauthorizedDissolveSucceeded++;
            _syncStatus(id);
        } catch {}
        calls++;
    }

    function proposeInvalid(uint256 kindSeed, uint256 fromSeed) external {
        address from = communities[bound(fromSeed, 0, communities.length - 1)];
        address actor = _founderOf(from);
        uint256 kind = bound(kindSeed, 0, 2);

        vm.prank(actor);
        if (kind == 0) {
            try alliance.proposeAlliance(from, from, "self", 0, false, false) {
                selfAllianceSucceeded++;
            } catch {}
        } else if (kind == 1) {
            try alliance.proposeAlliance(from, address(0), "zero", 0, false, false) {
                invalidCommunitySucceeded++;
            } catch {}
        } else {
            Community bare = new Community();
            try alliance.proposeAlliance(from, address(bare), "uninit", 0, false, false) {
                invalidCommunitySucceeded++;
            } catch {}
        }
        calls++;
    }

    function trySendEth(uint256 amountSeed, uint256 kindSeed) external {
        uint256 amount = bound(amountSeed, 1, 1 ether);
        uint256 kind = bound(kindSeed, 0, 1);

        if (kind == 0) {
            (bool ok,) = address(alliance).call{value: amount}("");
            if (ok) unexpectedEthAccepted++;
        } else {
            (bool ok,) = address(alliance).call{value: amount}(
                abi.encodeWithSelector(
                    AllianceModule.proposeAlliance.selector,
                    commA,
                    commB,
                    "eth",
                    uint256(0),
                    false,
                    false
                )
            );
            if (ok) unexpectedEthAccepted++;
        }
        calls++;
    }

    // ─── Views used by invariants ─────────────────────────────────────

    function hasActiveAlliance(address x, address y) external view returns (bool) {
        uint256 n = alliance.nextAllianceId();
        for (uint256 id = 0; id < n; id++) {
            (address ca, address cb, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
            if (status == AllianceModule.AllianceStatus.Active) {
                if ((ca == x && cb == y) || (ca == y && cb == x)) {
                    return true;
                }
            }
        }
        return false;
    }

    function acceptedCountFor(address community) external view returns (uint256 count) {
        uint256 n = alliance.nextAllianceId();
        for (uint256 id = 0; id < n; id++) {
            (address ca, address cb,, ,,) = alliance.getAlliance(id);
            if (everActive[id] && (ca == community || cb == community)) {
                count++;
            }
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────

    function _founderOf(address community) internal view returns (address) {
        if (community == commA) return founderA;
        if (community == commB) return founderB;
        return founderC;
    }

    function _isTrackedFounder(address actor) internal view returns (bool) {
        return actor == founderA || actor == founderB || actor == founderC;
    }

    function _recordNew(uint256 id) internal {
        seen[id] = true;
        everProposed[id] = true;
        lastStatus[id] = AllianceModule.AllianceStatus.Proposed;
    }

    function _syncStatus(uint256 id) internal {
        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        if (!seen[id]) {
            seen[id] = true;
            lastStatus[id] = status;
            if (status == AllianceModule.AllianceStatus.Active) {
                everActive[id] = true;
            }
            return;
        }

        AllianceModule.AllianceStatus prev = lastStatus[id];
        if (!_legalTransition(prev, status)) {
            illegalTransitions++;
        }
        if (status == AllianceModule.AllianceStatus.Active) {
            everActive[id] = true;
        }
        lastStatus[id] = status;
    }

    function _legalTransition(
        AllianceModule.AllianceStatus prev,
        AllianceModule.AllianceStatus next
    ) internal pure returns (bool) {
        if (prev == next) return true;
        if (prev == AllianceModule.AllianceStatus.Proposed) {
            return next == AllianceModule.AllianceStatus.Active
                || next == AllianceModule.AllianceStatus.Dissolved;
        }
        if (prev == AllianceModule.AllianceStatus.Active) {
            return next == AllianceModule.AllianceStatus.Dissolved;
        }
        return false;
    }

    receive() external payable {}
}
