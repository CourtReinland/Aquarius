// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {GovernanceModule} from "../src/GovernanceModule.sol";
import {TokenModule} from "../src/TokenModule.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {AllianceModule} from "../src/AllianceModule.sol";

// ─── Attack / helper contracts ────────────────────────────────────────

/// @dev Toggles whether it accepts ETH so failed pushes can later be pulled.
contract ToggleRefundReceiver {
    GovernanceModule public gov;
    bool public accept;

    constructor(GovernanceModule _gov) {
        gov = _gov;
    }

    function setAccept(bool _accept) external {
        accept = _accept;
    }

    receive() external payable {
        require(accept, "rejecting refund");
    }

    function claim() external {
        gov.claimRefund();
    }
}

/// @dev Attempts to reenter governance during a refund push.
contract ReentrantRefundAttacker {
    GovernanceModule public gov;
    uint256 public proposalId;
    bool public attackOnReceive;
    uint256 public reenterAttempts;
    uint256 public receivedTotal;

    constructor(GovernanceModule _gov) {
        gov = _gov;
    }

    function setProposal(uint256 _id) external {
        proposalId = _id;
    }

    function enableAttack() external {
        attackOnReceive = true;
    }

    receive() external payable {
        receivedTotal += msg.value;
        if (attackOnReceive) {
            attackOnReceive = false;
            reenterAttempts++;
            // Both should fail while the outer nonReentrant lock is held
            try gov.cancelProposal(proposalId) {
                reenterAttempts += 100; // mark unexpected success
            } catch {}
            try gov.finalizeProposal(proposalId) {
                reenterAttempts += 100;
            } catch {}
            try gov.claimRefund() {
                reenterAttempts += 100;
            } catch {}
        }
    }
}

/// @dev Shared config so malicious creation bytecode can discover the proposal id.
contract ExecReenterConfig {
    address public gov;
    uint256 public pid;

    function set(address _gov, uint256 _pid) external {
        gov = _gov;
        pid = _pid;
    }
}

/// @dev Constructor tries to reenter executeProposal (double CREATE without CEI).
contract ReenterOnConstruct {
    address public nested;

    constructor(address config) {
        ExecReenterConfig c = ExecReenterConfig(config);
        try GovernanceModule(payable(c.gov())).executeProposal(c.pid()) returns (address deployed) {
            nested = deployed;
        } catch {
            nested = address(0);
        }
    }
}

/// @dev Malicious ERC-20 that reenters distributeDividends during transferFrom.
contract ReentrantDividendToken {
    InstitutionRegistry public registry;
    uint256 public instId;
    address public tokenSelf; // set after deploy
    bool public attacking;
    uint256 public reenterAttempts;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function configureAttack(InstitutionRegistry _registry, uint256 _instId) external {
        registry = _registry;
        instId = _instId;
        attacking = true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "bal");
        require(allowance[from][msg.sender] >= amount, "allow");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;

        if (attacking) {
            attacking = false;
            reenterAttempts++;
            try registry.distributeDividends(instId, address(this), amount) {
                reenterAttempts += 100;
            } catch {}
        }
        return true;
    }
}

/// @dev Fake community used to probe AllianceModule callback reentrancy.
///      `initialized()` / `isFounder()` look like Community; isFounder can
///      reenter accept or decline on the same alliance id.
contract ReentrantAllianceCommunity {
    AllianceModule public alliance;
    uint256 public attackId;
    uint256 public reenterAttempts;
    uint256 public reenterSucceeded;

    enum Attack {
        None,
        ReenterAccept,
        ReenterDeclineDuringAccept
    }

    Attack public attack;

    function initialized() external pure returns (bool) {
        return true;
    }

    function configure(AllianceModule _alliance) external {
        alliance = _alliance;
    }

    function enableAcceptReenter(uint256 id) external {
        attackId = id;
        attack = Attack.ReenterAccept;
    }

    function enableDeclineDuringAccept(uint256 id) external {
        attackId = id;
        attack = Attack.ReenterDeclineDuringAccept;
    }

    function isFounder(address) external returns (bool) {
        if (attack == Attack.ReenterAccept) {
            attack = Attack.None;
            reenterAttempts++;
            try alliance.acceptAlliance(attackId) {
                reenterSucceeded++;
            } catch {}
        } else if (attack == Attack.ReenterDeclineDuringAccept) {
            attack = Attack.None;
            reenterAttempts++;
            try alliance.declineAlliance(attackId) {
                reenterSucceeded++;
            } catch {}
        }
        return true;
    }
}

contract SecurityHardeningTest is Test {
    CommunityFactory public factory;
    GovernanceModule public governance;
    InstitutionRegistry public registry;
    AllianceModule public alliance;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    address public communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
        governance = new GovernanceModule();
        registry = new InstitutionRegistry();
        alliance = new AllianceModule();

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
            "Secure Community", "", founders, bylaws, "", "", false
        );

        vm.startPrank(alice);
        Community(communityAddr).addMember(bob);
        Community(communityAddr).addMember(charlie);
        vm.stopPrank();

        vm.deal(alice, 20 ether);
        vm.deal(bob, 20 ether);
        vm.deal(charlie, 20 ether);
    }

    // ─── 1. Refund reentrancy / pull fallback ─────────────────────────

    function test_RefundReentrancyBlockedAndPullWorks() public {
        ReentrantRefundAttacker attacker = new ReentrantRefundAttacker(governance);
        vm.deal(address(attacker), 5 ether);

        vm.prank(alice);
        Community(communityAddr).addMember(address(attacker));

        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr,
            "Funded then cancel",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            1 ether, 0, "Thing"
        );

        attacker.setProposal(proposalId);

        // Attacker and bob fund yes votes
        vm.prank(address(attacker));
        governance.castVote{value: 1 ether}(proposalId, true);

        vm.prank(bob);
        governance.castVote{value: 1 ether}(proposalId, true);

        uint256 bobBefore = bob.balance;
        attacker.enableAttack();

        vm.prank(alice);
        governance.cancelProposal(proposalId);

        // Reenter was attempted but did not succeed (no +100 markers)
        assertEq(attacker.reenterAttempts(), 1);
        // Attacker still received exactly one push refund
        assertEq(attacker.receivedTotal(), 1 ether);
        assertEq(governance.claimableRefunds(address(attacker)), 0);
        // Honest EOA still refunded
        assertEq(bob.balance, bobBefore + 1 ether);
    }

    function test_RejectingReceiverCanPullRefund() public {
        ToggleRefundReceiver receiver = new ToggleRefundReceiver(governance);
        vm.deal(address(receiver), 2 ether);

        vm.prank(alice);
        Community(communityAddr).addMember(address(receiver));

        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr, "Fail funding", "",
            GovernanceModule.QuorumType.Majority, 51, 0, 1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            1 ether, 10 ether, "Big"
        );

        vm.prank(address(receiver));
        governance.castVote{value: 1 ether}(proposalId, true);

        vm.prank(bob);
        governance.castVote{value: 1 ether}(proposalId, true);

        // Reject pushes during finalize
        receiver.setAccept(false);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        assertEq(governance.claimableRefunds(address(receiver)), 1 ether);
        // Bob (EOA) was pushed successfully
        assertEq(governance.claimableRefunds(bob), 0);

        // Later the receiver opts in and pulls
        receiver.setAccept(true);
        uint256 before = address(receiver).balance;
        receiver.claim();
        assertEq(address(receiver).balance, before + 1 ether);
        assertEq(governance.claimableRefunds(address(receiver)), 0);
    }

    // ─── 2. Smart proposal execute CEI / constructor reentrancy ───────

    function test_ExecuteProposalConstructorCannotReenter() public {
        ExecReenterConfig config = new ExecReenterConfig();
        bytes memory bytecode = abi.encodePacked(
            type(ReenterOnConstruct).creationCode,
            abi.encode(address(config))
        );

        vm.prank(alice);
        uint256 proposalId = governance.createSmartProposal(
            communityAddr,
            "Deploy with reenter ctor",
            "",
            GovernanceModule.QuorumType.Majority,
            51, 0, 1 days,
            0, 0, "Inst",
            bytecode
        );

        config.set(address(governance), proposalId);

        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);

        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(proposalId);

        address deployed = governance.executeProposal(proposalId);
        assertTrue(deployed != address(0));

        // Nested re-execute must have failed (status already Executed)
        assertEq(ReenterOnConstruct(deployed).nested(), address(0));

        (,,, GovernanceModule.ProposalStatus status,,,,,,,) =
            governance.getProposal(proposalId);
        assertTrue(status == GovernanceModule.ProposalStatus.Executed);
        assertEq(governance.deployedContracts(proposalId), deployed);
    }

    // ─── 3. TokenModule initialize frontrun ───────────────────────────

    function test_TokenInitializeOnlyDeployer() public {
        TokenModule token = new TokenModule();
        assertEq(token.deployer(), address(this));

        address attacker = makeAddr("tokenAttacker");
        vm.prank(attacker);
        vm.expectRevert("Only deployer");
        token.initialize(
            "Hack", "HAK",
            communityAddr, attacker,
            1_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Austrian,
                allowArbitraryCreation: false,
                allowFractionalLending: false,
                leverageRatio: 1,
                maxSupply: 0
            })
        );

        // Deployer can still initialize
        token.initialize(
            "Skate", "SK8",
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
        assertTrue(token.initialized());
        assertEq(token.bank(), alice);
    }

    // ─── 4. Community initialize frontrun ─────────────────────────────

    function test_CommunityInitializeOnlyDeployer() public {
        // Bare Community deploy: only this test contract (deployer) may init
        Community bare = new Community();
        assertEq(bare.deployer(), address(this));

        address[] memory founders = new address[](1);
        founders[0] = alice;
        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersOnly,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOnly,
            requireBuyIn: false
        });

        address attacker = makeAddr("communityAttacker");
        vm.prank(attacker);
        vm.expectRevert("Only deployer");
        bare.initialize("Stolen", "", founders, bylaws, "", "", false);

        // Factory path remains atomic and sets deployer = factory
        address viaFactory = factory.createCommunity(
            "Factory Community", "", founders, bylaws, "", "", false
        );
        assertEq(Community(viaFactory).deployer(), address(factory));
        assertTrue(Community(viaFactory).initialized());
    }

    // ─── 5. Dividend reentrancy ───────────────────────────────────────

    function test_DividendReentrancyBlocked() public {
        ReentrantDividendToken badToken = new ReentrantDividendToken();

        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Cafe2", 100, true);

        vm.startPrank(alice);
        registry.allocateShares(instId, alice, 50);
        registry.allocateShares(instId, bob, 50);
        vm.stopPrank();

        uint256 amount = 1000 ether;
        badToken.mint(alice, amount);
        vm.prank(alice);
        badToken.approve(address(registry), amount);
        badToken.configureAttack(registry, instId);

        vm.prank(alice);
        registry.distributeDividends(instId, address(badToken), amount);

        // One reenter attempt, but it must not succeed (+100)
        assertEq(badToken.reenterAttempts(), 1);
        // Payouts still applied once (alice 50% + bob 50%)
        assertEq(badToken.balanceOf(alice), amount / 2);
        assertEq(badToken.balanceOf(bob), amount / 2);
    }

    function test_OutstandingSharesTracksAllocations() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "Shop", 100, true);

        vm.startPrank(alice);
        registry.allocateShares(instId, alice, 60);
        registry.allocateShares(instId, bob, 40);
        vm.stopPrank();

        assertEq(registry.outstandingShares(instId), 100);
    }

    // ─── 6. Input validation ──────────────────────────────────────────

    function test_AllianceRejectsZeroAndUninitCommunity() public {
        vm.prank(alice);
        vm.expectRevert("Invalid community");
        alliance.proposeAlliance(
            communityAddr, address(0), "terms", 0, true, false
        );

        Community bare = new Community(); // not initialized
        vm.prank(alice);
        vm.expectRevert("Invalid community");
        alliance.proposeAlliance(
            communityAddr, address(bare), "terms", 0, true, false
        );
    }

    function test_CastVoteRejectsUnexpectedETH() public {
        vm.prank(alice);
        uint256 proposalId = governance.createProposal(
            communityAddr, "Free vote", "",
            GovernanceModule.QuorumType.Majority, 51, 0, 1 days,
            GovernanceModule.OutcomeType.SimpleYes,
            0, 0, ""
        );

        vm.prank(bob);
        vm.expectRevert("Unexpected ETH");
        governance.castVote{value: 0.1 ether}(proposalId, true);
    }

    function test_DistributeDividendsRejectsZeroTokenOrAmount() public {
        vm.prank(alice);
        uint256 instId = registry.createInstitution(communityAddr, "X", 10, true);
        vm.prank(alice);
        registry.allocateShares(instId, alice, 10);

        vm.prank(alice);
        vm.expectRevert("Invalid token");
        registry.distributeDividends(instId, address(0), 1);

        vm.prank(alice);
        vm.expectRevert("Amount required");
        registry.distributeDividends(instId, address(0xBEEF), 0);
    }

    // ─── 7. AllianceModule access / status / spoof / callback ─────────

    function _createCommunity(address founder, string memory name) internal returns (address) {
        address[] memory founders = new address[](1);
        founders[0] = founder;
        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });
        return factory.createCommunity(name, "", founders, bylaws, "", "", false);
    }

    function test_AllianceRejectsSelfAlliance() public {
        vm.prank(alice);
        vm.expectRevert("Cannot ally with self");
        alliance.proposeAlliance(communityAddr, communityAddr, "self", 0, false, false);
    }

    function test_AllianceFounderBCannotProposeAsA() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(bob);
        vm.expectRevert("Only founders can propose alliances");
        alliance.proposeAlliance(communityAddr, commB, "", 0, false, false);
    }

    function test_AllianceMemberCannotPropose() public {
        address commB = _createCommunity(makeAddr("founderB2"), "Target B");
        vm.prank(charlie); // member of A, not a founder
        vm.expectRevert("Only founders can propose alliances");
        alliance.proposeAlliance(communityAddr, commB, "", 0, false, false);
    }

    function test_AllianceDoubleAcceptReverts() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);

        vm.prank(bob);
        alliance.acceptAlliance(id);

        vm.prank(bob);
        vm.expectRevert("Not proposed");
        alliance.acceptAlliance(id);
    }

    function test_AllianceDoubleDissolveReverts() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);
        vm.prank(bob);
        alliance.acceptAlliance(id);

        vm.prank(alice);
        alliance.dissolveAlliance(id);

        vm.prank(bob);
        vm.expectRevert("Not active");
        alliance.dissolveAlliance(id);
    }

    function test_AllianceCannotDissolveWhenProposed() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);

        vm.prank(alice);
        vm.expectRevert("Not active");
        alliance.dissolveAlliance(id);
    }

    function test_AllianceCannotAcceptAfterDecline() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);

        vm.prank(bob);
        alliance.declineAlliance(id);

        vm.prank(bob);
        vm.expectRevert("Not proposed");
        alliance.acceptAlliance(id);

        assertFalse(alliance.isAllied(communityAddr, commB));
        assertEq(alliance.getCommunityAlliances(communityAddr).length, 0);
        assertEq(alliance.getCommunityAlliances(commB).length, 0);
    }

    function test_AllianceCannotDeclineWhenActive() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);
        vm.prank(bob);
        alliance.acceptAlliance(id);

        vm.prank(bob);
        vm.expectRevert("Not proposed");
        alliance.declineAlliance(id);
    }

    function test_AllianceFounderCCannotAcceptOrDeclineAB() public {
        address commB = _createCommunity(bob, "Target B");
        address commC = _createCommunity(charlie, "Spoof C");

        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);

        vm.prank(charlie);
        vm.expectRevert("Only target founders can accept");
        alliance.acceptAlliance(id);

        vm.prank(charlie);
        vm.expectRevert("Only target founders can decline");
        alliance.declineAlliance(id);

        // Charlie also cannot dissolve a later active A–B alliance
        vm.prank(bob);
        alliance.acceptAlliance(id);
        vm.prank(charlie);
        vm.expectRevert("Only founders can dissolve");
        alliance.dissolveAlliance(id);
        assertTrue(alliance.isAllied(communityAddr, commB));
        assertFalse(alliance.isAllied(communityAddr, commC));
    }

    function test_AllianceOutsiderCannotDeclineOrDissolve() public {
        address commB = _createCommunity(bob, "Target B");
        address outsider = makeAddr("allianceOutsider");

        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);

        vm.prank(outsider);
        vm.expectRevert("Only target founders can decline");
        alliance.declineAlliance(id);

        vm.prank(bob);
        alliance.acceptAlliance(id);

        vm.prank(outsider);
        vm.expectRevert("Only founders can dissolve");
        alliance.dissolveAlliance(id);
    }

    function test_AllianceFounderACannotDecline() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);

        vm.prank(alice);
        vm.expectRevert("Only target founders can decline");
        alliance.declineAlliance(id);
    }

    function test_AllianceDissolveClearsIsAlliedButKeepsHistory() public {
        address commB = _createCommunity(bob, "Target B");
        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, commB, "", 0, true, false);
        vm.prank(bob);
        alliance.acceptAlliance(id);
        assertTrue(alliance.isAllied(communityAddr, commB));

        vm.prank(bob);
        alliance.dissolveAlliance(id);

        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        assertTrue(status == AllianceModule.AllianceStatus.Dissolved);
        assertFalse(alliance.isAllied(communityAddr, commB));

        uint256[] memory aList = alliance.getCommunityAlliances(communityAddr);
        uint256[] memory bList = alliance.getCommunityAlliances(commB);
        assertEq(aList.length, 1);
        assertEq(bList.length, 1);
        assertEq(aList[0], id);
        assertEq(bList[0], id);
    }

    function test_AllianceRejectsUnexpectedETH() public {
        address commB = _createCommunity(bob, "Target B");
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        (bool ok,) = address(alliance).call{value: 0.1 ether}(
            abi.encodeWithSelector(
                AllianceModule.proposeAlliance.selector,
                communityAddr,
                commB,
                "",
                uint256(0),
                false,
                false
            )
        );
        assertFalse(ok, "payable propose should fail");

        (bool okEmpty,) = address(alliance).call{value: 0.1 ether}("");
        assertFalse(okEmpty, "plain ETH transfer should fail");
        assertEq(address(alliance).balance, 0);
    }

    function test_AllianceAcceptReentrancyCannotDoublePush() public {
        ReentrantAllianceCommunity hostile = new ReentrantAllianceCommunity();
        hostile.configure(alliance);

        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, address(hostile), "", 0, true, false);
        hostile.enableAcceptReenter(id);

        // Any caller is treated as founder of the hostile target.
        alliance.acceptAlliance(id);

        assertEq(hostile.reenterAttempts(), 1);
        assertEq(hostile.reenterSucceeded(), 0);

        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        assertTrue(status == AllianceModule.AllianceStatus.Active);

        uint256[] memory aList = alliance.getCommunityAlliances(communityAddr);
        uint256[] memory bList = alliance.getCommunityAlliances(address(hostile));
        assertEq(aList.length, 1, "double-push on community A");
        assertEq(bList.length, 1, "double-push on hostile B");
        assertTrue(alliance.isAllied(communityAddr, address(hostile)));
    }

    function test_AllianceAcceptReentrancyCannotFlipDeclineToActive() public {
        ReentrantAllianceCommunity hostile = new ReentrantAllianceCommunity();
        hostile.configure(alliance);

        vm.prank(alice);
        uint256 id = alliance.proposeAlliance(communityAddr, address(hostile), "", 0, true, false);
        hostile.enableDeclineDuringAccept(id);

        alliance.acceptAlliance(id);

        assertEq(hostile.reenterAttempts(), 1);
        assertEq(hostile.reenterSucceeded(), 0);

        (,, AllianceModule.AllianceStatus status,,,) = alliance.getAlliance(id);
        assertTrue(status == AllianceModule.AllianceStatus.Active);
        assertEq(alliance.getCommunityAlliances(communityAddr).length, 1);
        assertEq(alliance.getCommunityAlliances(address(hostile)).length, 1);
    }
}
