// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../../src/Community.sol";
import {CommunityFactory} from "../../src/CommunityFactory.sol";
import {GovernanceModule} from "../../src/GovernanceModule.sol";
import {TokenModule} from "../../src/TokenModule.sol";
import {InstitutionRegistry} from "../../src/InstitutionRegistry.sol";

import {AllianceModule} from "../../src/AllianceModule.sol";

import {GovernanceHandler} from "./handlers/GovernanceHandler.sol";
import {TokenHandler} from "./handlers/TokenHandler.sol";
import {MembershipHandler} from "./handlers/MembershipHandler.sol";
import {DividendHandler} from "./handlers/DividendHandler.sol";
import {AllianceHandler} from "./handlers/AllianceHandler.sol";

/**
 * @title GovernanceInvariants
 * @notice Refund conservation + proposal status-machine properties.
 *
 * Properties:
 *  1. ETH conservation: gov.balance == ghostEthIn - ghostEthOut
 *  2. Liability cover: gov.balance >= sum(claimableRefunds)
 *  3. Accounting split: balance == claimable + remaining funded (Active/Passed/Executed)
 *  4. Failed/Cancelled proposals have totalFunded == 0
 *  5. No double-claim / empty claim success
 *  6. Status transitions only Active→{Passed,Failed,Cancelled}, Passed→Executed
 *  7. No successful vote after end / finalize before end / execute from non-Passed
 */
contract GovernanceInvariants is Test {
    CommunityFactory internal factory;
    GovernanceModule internal governance;
    GovernanceHandler internal handler;

    address internal alice = makeAddr("inv-alice");
    address internal bob = makeAddr("inv-bob");
    address internal charlie = makeAddr("inv-charlie");
    address internal dave = makeAddr("inv-dave");

    address internal communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        governance = new GovernanceModule();

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
            "Invariant Gov", "", founders, bylaws, "", "", false
        );

        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        Community(communityAddr).addMember(dave);
        vm.stopPrank();

        address[] memory actors = new address[](4);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = charlie;
        actors[3] = dave;

        handler = new GovernanceHandler(governance, communityAddr, actors);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = GovernanceHandler.createProposal.selector;
        selectors[1] = GovernanceHandler.createSmartProposal.selector;
        selectors[2] = GovernanceHandler.castYes.selector;
        selectors[3] = GovernanceHandler.castNo.selector;
        selectors[4] = GovernanceHandler.warpTowardEnd.selector;
        selectors[5] = GovernanceHandler.finalize.selector;
        selectors[6] = GovernanceHandler.cancel.selector;
        selectors[7] = GovernanceHandler.claimRefund.selector;
        selectors[8] = GovernanceHandler.execute.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_ethConservation() public view {
        assertEq(
            address(governance).balance,
            handler.ghostEthIn() - handler.ghostEthOut(),
            "ETH conservation broken"
        );
    }

    function invariant_claimableCoveredByBalance() public view {
        assertLe(
            handler.sumClaimable(),
            address(governance).balance,
            "claimable exceeds balance"
        );
    }

    function invariant_balanceEqualsClaimablePlusHeld() public view {
        assertEq(
            address(governance).balance,
            handler.sumClaimable() + handler.sumRemainingFunded(),
            "balance != claimable + held funded"
        );
    }

    function invariant_refundedProposalsCleared() public view {
        uint256 n = governance.nextProposalId();
        for (uint256 pid = 0; pid < n; pid++) {
            (
                ,,,
                GovernanceModule.ProposalStatus status,
                ,,
                uint256 totalFunded,,,,
            ) = governance.getProposal(pid);
            if (
                status == GovernanceModule.ProposalStatus.Failed
                    || status == GovernanceModule.ProposalStatus.Cancelled
            ) {
                assertEq(totalFunded, 0, "refund path left totalFunded");
            }
        }
    }

    function invariant_noDoubleClaim() public view {
        assertEq(handler.doubleClaimAttemptsSucceeded(), 0, "double/empty claim succeeded");
    }

    function invariant_statusMachine() public view {
        assertEq(handler.illegalTransitions(), 0, "illegal status transition");
        assertEq(handler.votesAfterEndSucceeded(), 0, "vote after end succeeded");
        assertEq(handler.finalizeBeforeEndSucceeded(), 0, "finalize before end succeeded");
        assertEq(handler.executeFromNonPassedSucceeded(), 0, "execute from non-Passed succeeded");

        uint256 n = governance.nextProposalId();
        for (uint256 pid = 0; pid < n; pid++) {
            (,,, GovernanceModule.ProposalStatus status,,,,,,,) = governance.getProposal(pid);
            if (status == GovernanceModule.ProposalStatus.Executed) {
                assertTrue(handler.everPassed(pid), "executed without ever Passed");
                assertTrue(governance.deployedContracts(pid) != address(0), "executed without deploy");
                assertGt(governance.smartProposalBytecode(pid).length, 0, "executed non-smart");
            }
        }
    }
}

/**
 * @title TokenInvariants
 * @notice Mint bounds, burn supply reduction, bank-only mint, balance conservation.
 */
contract TokenInvariants is Test {
    CommunityFactory internal factory;
    TokenModule internal austrian;
    TokenModule internal keynesian;
    TokenHandler internal handler;

    address internal alice = makeAddr("tok-alice"); // bank
    address internal bob = makeAddr("tok-bob");
    address internal charlie = makeAddr("tok-charlie");

    address internal communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        austrian = new TokenModule();
        keynesian = new TokenModule();

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
        communityAddr = factory.createCommunity("TokInv", "", founders, bylaws, "", "", false);

        // Austrian: hard cap at initial; remint only after burn (allowArbitraryCreation=true)
        austrian.initialize(
            "Austrian Inv",
            "AUS",
            communityAddr,
            alice,
            1_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Austrian,
                allowArbitraryCreation: true,
                allowFractionalLending: false,
                leverageRatio: 1,
                maxSupply: 0
            })
        );

        // Keynesian: 4x leverage on initial base
        keynesian.initialize(
            "Keynes Inv",
            "KEY",
            communityAddr,
            alice,
            1_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Keynesian,
                allowArbitraryCreation: false,
                allowFractionalLending: true,
                leverageRatio: 4,
                maxSupply: 0
            })
        );

        // Seed some balances for burns/transfers
        vm.startPrank(alice);
        austrian.transfer(bob, 100_000 * 1e18);
        austrian.transfer(charlie, 50_000 * 1e18);
        keynesian.transfer(bob, 100_000 * 1e18);
        keynesian.transfer(charlie, 50_000 * 1e18);
        vm.stopPrank();

        address[] memory actors = new address[](3);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = charlie;
        handler = new TokenHandler(austrian, keynesian, alice, actors);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = TokenHandler.mintAustrian.selector;
        selectors[1] = TokenHandler.mintKeynesian.selector;
        selectors[2] = TokenHandler.mintAsNonBank.selector;
        selectors[3] = TokenHandler.burnAustrian.selector;
        selectors[4] = TokenHandler.burnKeynesian.selector;
        selectors[5] = TokenHandler.transferAustrian.selector;
        selectors[6] = TokenHandler.transferKeynesian.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_austrianNeverExceedsMax() public view {
        assertLe(austrian.totalSupply(), austrian.getMaxSupply(), "Austrian exceeded maxSupply");
    }

    function invariant_keynesianRespectsLeverage() public view {
        (, , , uint8 lev,) = keynesian.bankingConfig();
        uint256 maxAllowed = keynesian.getMaxSupply() * uint256(lev);
        assertLe(keynesian.totalSupply(), maxAllowed, "Keynesian exceeded leverage");
    }

    function invariant_supplyMatchesGhosts() public view {
        assertEq(
            austrian.totalSupply(),
            handler.initialAustrian() + handler.ghostMintedAustrian() - handler.ghostBurnedAustrian(),
            "Austrian supply ghost mismatch"
        );
        assertEq(
            keynesian.totalSupply(),
            handler.initialKeynesian() + handler.ghostMintedKeynesian() - handler.ghostBurnedKeynesian(),
            "Keynesian supply ghost mismatch"
        );
    }

    function invariant_actorBalancesEqualSupply() public view {
        assertEq(handler.sumBalances(austrian), austrian.totalSupply(), "Austrian balance sum");
        assertEq(handler.sumBalances(keynesian), keynesian.totalSupply(), "Keynesian balance sum");
    }

    function invariant_onlyBankMints() public view {
        assertEq(handler.nonBankMintSucceeded(), 0, "non-bank mint succeeded");
    }
}

/**
 * @title MembershipInvariants
 * @notice Founders immovable via removeMember; zero address never member; init once.
 */
contract MembershipInvariants is Test {
    CommunityFactory internal factory;
    Community internal community;
    MembershipHandler internal handler;

    address internal alice = makeAddr("mem-alice");
    address internal bob = makeAddr("mem-bob");
    address internal charlie = makeAddr("mem-charlie");
    address internal outsider = makeAddr("mem-outsider");

    function setUp() public {
        factory = new CommunityFactory();

        address[] memory founders = new address[](1);
        founders[0] = alice;
        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersAndMembers,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });

        address communityAddr = factory.createCommunity(
            "MemInv", "", founders, bylaws, "", "", false
        );
        community = Community(communityAddr);

        vm.prank(alice);
        community.addMember(bob);

        address[] memory pool = new address[](4);
        pool[0] = alice;
        pool[1] = bob;
        pool[2] = charlie;
        pool[3] = outsider;

        handler = new MembershipHandler(community, alice, pool);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = MembershipHandler.addMember.selector;
        selectors[1] = MembershipHandler.addZeroAddress.selector;
        selectors[2] = MembershipHandler.removeMember.selector;
        selectors[3] = MembershipHandler.removeFounderDirect.selector;
        selectors[4] = MembershipHandler.tryReinitialize.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_foundersRemain() public view {
        address[] memory founders = community.getFounders();
        for (uint256 i = 0; i < founders.length; i++) {
            assertTrue(community.isFounder(founders[i]), "founder flag cleared");
            assertTrue(community.isMember(founders[i]), "founder not member");
        }
        assertEq(handler.founderRemovedSucceeded(), 0, "founder removed via removeMember");
    }

    function invariant_zeroNeverMember() public view {
        assertFalse(community.isMember(address(0)), "zero address is member");
        assertEq(handler.zeroAddressMemberSucceeded(), 0, "add(address(0)) succeeded");
    }

    function invariant_initializedOnce() public view {
        assertTrue(community.initialized(), "community not initialized");
        assertEq(handler.reinitializeSucceeded(), 0, "reinitialize succeeded");
    }
}

/**
 * @title DividendInvariants
 * @notice outstandingShares == sum(shareholdings); distributeDividends does not over-pay.
 */
contract DividendInvariants is Test {
    CommunityFactory internal factory;
    InstitutionRegistry internal registry;
    TokenModule internal token;
    DividendHandler internal handler;

    address internal alice = makeAddr("div-alice");
    address internal bob = makeAddr("div-bob");
    address internal charlie = makeAddr("div-charlie");

    address internal communityAddr;

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
        communityAddr = factory.createCommunity("DivInv", "", founders, bylaws, "", "", false);

        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        vm.stopPrank();

        // Keynesian with room so bank can hold large balances; no further mint needed
        token.initialize(
            "Div Token",
            "DIV",
            communityAddr,
            alice,
            10_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Keynesian,
                allowArbitraryCreation: true,
                allowFractionalLending: true,
                leverageRatio: 4,
                maxSupply: 0
            })
        );

        address[] memory actors = new address[](3);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = charlie;
        handler = new DividendHandler(registry, token, communityAddr, alice, actors);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = DividendHandler.allocateShares.selector;
        selectors[1] = DividendHandler.createPositionWithGrant.selector;
        selectors[2] = DividendHandler.offerAndAccept.selector;
        selectors[3] = DividendHandler.distribute.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_outstandingSharesCoherent() public view {
        uint256 id = handler.institutionId();
        assertEq(
            registry.outstandingShares(id),
            handler.sumShareholdings(),
            "outstandingShares != sum shareholdings"
        );
    }

    function invariant_dividendsDoNotOverpay() public view {
        assertEq(handler.overpayEvents(), 0, "dividend overpay detected");
        assertLe(
            handler.ghostActuallyPaid(),
            handler.ghostDistributed(),
            "paid more than requested totalAmount aggregate"
        );
    }
}

/**
 * @title AllianceInvariants
 * @notice Access control, status machine, spoofing, ETH, and list-accounting
 *         properties for AllianceModule.
 *
 * Properties:
 *  1. Only founder of A can propose; only founder of B can accept/decline;
 *     only founder of A or B can dissolve.
 *  2. Status may only move Proposed → Active | Dissolved, Active → Dissolved.
 *     No double-accept / double-dissolve / skip transitions.
 *  3. A founder of community C cannot accept/decline an A–B alliance.
 *  4. Module rejects unexpected ETH (no payable / receive path).
 *  5. communityAlliances lists match accepted (ever-Active) ids: no declined
 *     phantoms, no duplicates, and isAllied iff an Active pair exists.
 */
contract AllianceInvariants is Test {
    CommunityFactory internal factory;
    AllianceModule internal alliance;
    AllianceHandler internal handler;

    address internal founderA = makeAddr("ally-founder-a");
    address internal founderB = makeAddr("ally-founder-b");
    address internal founderC = makeAddr("ally-founder-c");
    address internal memberA = makeAddr("ally-member-a");
    address internal memberB = makeAddr("ally-member-b");
    address internal outsider = makeAddr("ally-outsider");

    address internal commA;
    address internal commB;
    address internal commC;

    function setUp() public {
        factory = new CommunityFactory();
        alliance = new AllianceModule();

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });

        address[] memory foundersA = new address[](1);
        foundersA[0] = founderA;
        address[] memory foundersB = new address[](1);
        foundersB[0] = founderB;
        address[] memory foundersC = new address[](1);
        foundersC[0] = founderC;

        commA = factory.createCommunity("Ally A", "", foundersA, bylaws, "", "", false);
        commB = factory.createCommunity("Ally B", "", foundersB, bylaws, "", "", false);
        commC = factory.createCommunity("Ally C", "", foundersC, bylaws, "", "", false);

        vm.prank(founderA);
        Community(commA).addMember(memberA);
        vm.prank(founderB);
        Community(commB).addMember(memberB);

        address[] memory actors = new address[](6);
        actors[0] = founderA;
        actors[1] = founderB;
        actors[2] = founderC;
        actors[3] = memberA;
        actors[4] = memberB;
        actors[5] = outsider;

        handler = new AllianceHandler(
            alliance, commA, commB, commC, founderA, founderB, founderC, actors
        );

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](10);
        selectors[0] = AllianceHandler.proposeAsFounder.selector;
        selectors[1] = AllianceHandler.acceptAsTarget.selector;
        selectors[2] = AllianceHandler.declineAsTarget.selector;
        selectors[3] = AllianceHandler.dissolveAsPartyFounder.selector;
        selectors[4] = AllianceHandler.proposeUnauthorized.selector;
        selectors[5] = AllianceHandler.acceptAsSpoof.selector;
        selectors[6] = AllianceHandler.declineAsSpoof.selector;
        selectors[7] = AllianceHandler.dissolveAsSpoof.selector;
        selectors[8] = AllianceHandler.proposeInvalid.selector;
        selectors[9] = AllianceHandler.trySendEth.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_onlyAuthorizedActors() public view {
        assertEq(handler.unauthorizedProposeSucceeded(), 0, "unauthorized propose");
        assertEq(handler.unauthorizedAcceptSucceeded(), 0, "unauthorized accept");
        assertEq(handler.unauthorizedDeclineSucceeded(), 0, "unauthorized decline");
        assertEq(handler.unauthorizedDissolveSucceeded(), 0, "unauthorized dissolve");
        assertEq(handler.selfAllianceSucceeded(), 0, "self-alliance succeeded");
        assertEq(handler.invalidCommunitySucceeded(), 0, "zero/uninit community succeeded");
    }

    function invariant_statusMachine() public view {
        assertEq(handler.illegalTransitions(), 0, "illegal alliance status transition");
        assertEq(handler.doubleAcceptSucceeded(), 0, "double-accept succeeded");
        assertEq(handler.doubleDissolveSucceeded(), 0, "double-dissolve succeeded");

        uint256 n = alliance.nextAllianceId();
        for (uint256 id = 0; id < n; id++) {
            (address ca, address cb, AllianceModule.AllianceStatus status,,,) =
                alliance.getAlliance(id);
            assertTrue(ca != address(0) && cb != address(0), "empty alliance slot");
            assertTrue(ca != cb, "self-pair stored");
            if (status == AllianceModule.AllianceStatus.Active) {
                assertTrue(handler.everActive(id), "active without recorded accept");
                assertTrue(handler.everProposed(id) || handler.seen(id), "active unseen");
            }
            if (status == AllianceModule.AllianceStatus.Dissolved && handler.everActive(id)) {
                assertTrue(
                    handler.lastStatus(id) == AllianceModule.AllianceStatus.Dissolved
                        || handler.lastStatus(id) == AllianceModule.AllianceStatus.Active,
                    "dissolved-after-active ghost mismatch"
                );
            }
        }
    }

    function invariant_noCrossCommunitySpoof() public view {
        assertEq(handler.crossCommunityAcceptSucceeded(), 0, "cross-community accept spoof");
    }

    function invariant_noUnexpectedEth() public view {
        assertEq(address(alliance).balance, 0, "alliance holds ETH");
        assertEq(handler.unexpectedEthAccepted(), 0, "unexpected ETH accepted");
    }

    function invariant_enumerationAndIsAllied() public view {
        _assertPairwiseAllied();
        _assertCommunityList(commA);
        _assertCommunityList(commB);
        _assertCommunityList(commC);
    }

    function _assertPairwiseAllied() internal view {
        address[3] memory comms = [commA, commB, commC];
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < 3; j++) {
                if (i == j) {
                    assertFalse(alliance.isAllied(comms[i], comms[j]), "self allied");
                    continue;
                }
                assertEq(
                    alliance.isAllied(comms[i], comms[j]),
                    handler.hasActiveAlliance(comms[i], comms[j]),
                    "isAllied != active pair scan"
                );
            }
        }
    }

    function _assertCommunityList(address community) internal view {
        uint256[] memory list = alliance.getCommunityAlliances(community);
        assertEq(list.length, handler.acceptedCountFor(community), "list length != accepted");

        uint256 n = alliance.nextAllianceId();
        for (uint256 id = 0; id < n; id++) {
            (address ca, address cb, AllianceModule.AllianceStatus status,,,) =
                alliance.getAlliance(id);
            bool party = ca == community || cb == community;
            if (party && !handler.everActive(id)) {
                for (uint256 k = 0; k < list.length; k++) {
                    assertTrue(list[k] != id, "declined/unaccepted id in community list");
                }
                if (status == AllianceModule.AllianceStatus.Proposed) {
                    assertFalse(alliance.isAllied(ca, cb) && !_otherActivePair(ca, cb, id));
                }
            }
        }

        for (uint256 i = 0; i < list.length; i++) {
            (address ca, address cb,, ,,) = alliance.getAlliance(list[i]);
            assertTrue(ca == community || cb == community, "foreign id in community list");
            assertTrue(handler.everActive(list[i]), "phantom list entry");
            for (uint256 j = i + 1; j < list.length; j++) {
                assertTrue(list[i] != list[j], "duplicate alliance id in list");
            }
        }
    }

    function _otherActivePair(address ca, address cb, uint256 exceptId)
        internal
        view
        returns (bool)
    {
        uint256 n = alliance.nextAllianceId();
        for (uint256 id = 0; id < n; id++) {
            if (id == exceptId) continue;
            (address xa, address xb, AllianceModule.AllianceStatus status,,,) =
                alliance.getAlliance(id);
            if (status != AllianceModule.AllianceStatus.Active) continue;
            if ((xa == ca && xb == cb) || (xa == cb && xb == ca)) return true;
        }
        return false;
    }
}

/**
 * @title StatelessFuzzSecurity
 * @notice Complementary fuzz tests for properties that are cheaper as unit fuzzes.
 */
contract StatelessFuzzSecurity is Test {
    CommunityFactory internal factory;
    GovernanceModule internal governance;
    TokenModule internal token;
    address internal alice = makeAddr("fuzz-alice");
    address internal bob = makeAddr("fuzz-bob");
    address internal communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        governance = new GovernanceModule();
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
        communityAddr = factory.createCommunity("Fuzz", "", founders, bylaws, "", "", false);
        vm.prank(alice);
        Community(communityAddr).addMember(bob);

        token.initialize(
            "Fuzz",
            "FZZ",
            communityAddr,
            alice,
            1_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Keynesian,
                allowArbitraryCreation: false,
                allowFractionalLending: true,
                leverageRatio: 3,
                maxSupply: 0
            })
        );

        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
    }

    function testFuzz_noVoteAfterEnd(uint256 warpExtra) public {
        warpExtra = bound(warpExtra, 0, 30 days);
        vm.prank(alice);
        uint256 pid = governance.createProposal(
            communityAddr,
            "t",
            "",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            300,
            GovernanceModule.OutcomeType.SimpleYes,
            0,
            0,
            ""
        );
        vm.warp(block.timestamp + 301 + warpExtra);
        vm.prank(bob);
        vm.expectRevert("Voting ended");
        governance.castVote(pid, true);
    }

    function testFuzz_noFinalizeBeforeEnd(uint256 early) public {
        early = bound(early, 0, 299);
        vm.prank(alice);
        uint256 pid = governance.createProposal(
            communityAddr,
            "t",
            "",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            300,
            GovernanceModule.OutcomeType.SimpleYes,
            0,
            0,
            ""
        );
        vm.warp(block.timestamp + early);
        vm.expectRevert("Voting still open");
        governance.finalizeProposal(pid);
    }

    function testFuzz_keynesianMintBound(uint256 amount) public {
        uint256 maxAllowed = token.getMaxSupply() * 3;
        uint256 supply = token.totalSupply();
        amount = bound(amount, 0, (maxAllowed - supply) * 2 + 1);
        if (supply + amount > maxAllowed) {
            vm.prank(alice);
            vm.expectRevert("Exceeds leverage ratio");
            token.mint(bob, amount, "x");
        } else {
            vm.prank(alice);
            token.mint(bob, amount, "x");
            assertLe(token.totalSupply(), maxAllowed);
        }
    }

    function testFuzz_burnReducesSupply(uint256 amount) public {
        uint256 bal = token.balanceOf(alice);
        amount = bound(amount, 1, bal);
        uint256 before = token.totalSupply();
        vm.prank(alice);
        token.burn(amount);
        assertEq(token.totalSupply(), before - amount);
    }

    function testFuzz_cannotRemoveFounder(address caller) public {
        vm.assume(caller != address(0));
        vm.prank(caller);
        vm.expectRevert();
        Community(communityAddr).removeMember(alice);
    }

    function testFuzz_allianceOnlyFounderOfACanPropose(address caller) public {
        vm.assume(caller != address(0));
        vm.assume(caller != alice);

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
        address commB = factory.createCommunity("FuzzB", "", foundersB, bylaws, "", "", false);

        AllianceModule am = new AllianceModule();
        vm.prank(caller);
        vm.expectRevert("Only founders can propose alliances");
        am.proposeAlliance(communityAddr, commB, "", 0, false, false);
    }

    function testFuzz_allianceOnlyTargetFounderCanAccept(address caller) public {
        vm.assume(caller != address(0));
        vm.assume(caller != bob);

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
        address commB = factory.createCommunity("FuzzB2", "", foundersB, bylaws, "", "", false);

        AllianceModule am = new AllianceModule();
        vm.prank(alice);
        uint256 id = am.proposeAlliance(communityAddr, commB, "", 0, false, false);

        vm.prank(caller);
        vm.expectRevert("Only target founders can accept");
        am.acceptAlliance(id);
    }

    function testFuzz_refundNoDoubleClaim() public {
        vm.prank(alice);
        uint256 pid = governance.createProposal(
            communityAddr,
            "fund",
            "",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            300,
            GovernanceModule.OutcomeType.OneTimeFee,
            1 ether,
            10 ether, // unreachable threshold → fail → refund
            ""
        );
        vm.prank(bob);
        governance.castVote{value: 1 ether}(pid, true);
        vm.warp(block.timestamp + 301);
        governance.finalizeProposal(pid);

        // Push refund already attempted; claimable should be 0 for EOA
        assertEq(governance.claimableRefunds(bob), 0);
        vm.prank(bob);
        vm.expectRevert("Nothing to claim");
        governance.claimRefund();
    }
}
