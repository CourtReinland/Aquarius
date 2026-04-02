// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {GovernanceModule} from "../src/GovernanceModule.sol";
import {TokenModule} from "../src/TokenModule.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {AllianceModule} from "../src/AllianceModule.sol";

/**
 * @title Full End-to-End Integration Test
 * @notice Tells the complete story from the Aquarius pitch deck:
 *
 *  Ryan and Jess found "Cincinnati Skateville" with 28 friends.
 *  They create a community bank, propose a pizza making machine,
 *  vote on it, fund it, create the Pizza Foundry institution,
 *  hire a baker, distribute dividends, and form an alliance
 *  with a neighboring skating community.
 */
contract E2E_CincinnatiSkateville is Test {
    // Contracts
    CommunityFactory factory;
    GovernanceModule governance;
    TokenModule tokenTemplate;
    InstitutionRegistry institutions;
    AllianceModule alliances;

    // Characters
    address ryan = makeAddr("ryan");
    address jess = makeAddr("jess");
    address wolfgang = makeAddr("wolfgang"); // the pizza chef
    address[] friends;

    // State
    address skateville;
    address alphaCentauri;

    function setUp() public {
        factory = new CommunityFactory();
        governance = new GovernanceModule();
        tokenTemplate = new TokenModule();
        institutions = new InstitutionRegistry();
        alliances = new AllianceModule();

        // Create 5 friend accounts (representing 28 in the story)
        for (uint i = 0; i < 5; i++) {
            friends.push(makeAddr(string(abi.encodePacked("friend", i))));
        }

        // Fund everyone
        vm.deal(ryan, 100 ether);
        vm.deal(jess, 100 ether);
        vm.deal(wolfgang, 10 ether);
        for (uint i = 0; i < friends.length; i++) {
            vm.deal(friends[i], 50 ether);
        }
    }

    function test_FullCincinnatiSkatevilleStory() public {
        // ═══════════════════════════════════════════════════════════════
        // ACT 1: Ryan and Jess found Cincinnati Skateville
        // ═══════════════════════════════════════════════════════════════

        address[] memory founders = new address[](2);
        founders[0] = ryan;
        founders[1] = jess;

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });

        vm.prank(ryan);
        skateville = factory.createCommunity(
            "Cincinnati Skateville",
            "QmCharterHash_MustLoveSkating",
            founders,
            bylaws,
            "U.S. Code",
            "State of Ohio",
            false
        );

        Community community = Community(skateville);
        (string memory name,,,,,) = community.info();
        assertEq(name, "Cincinnati Skateville");
        assertTrue(community.isFounder(ryan));
        assertTrue(community.isFounder(jess));

        // Add friends as members
        vm.startPrank(ryan);
        for (uint i = 0; i < friends.length; i++) {
            community.addMember(friends[i]);
        }
        community.addMember(wolfgang);
        vm.stopPrank();

        assertEq(community.getMemberCount(), 8); // 2 founders + 5 friends + wolfgang

        // ═══════════════════════════════════════════════════════════════
        // ACT 2: Create the community bank and mint tokens
        // ═══════════════════════════════════════════════════════════════

        TokenModule skateToken = new TokenModule();
        skateToken.initialize(
            "Skateville Coin", "SKATE",
            skateville, ryan,  // Ryan is the bank controller
            33_000_000,        // 33 million starting tokens
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Austrian,
                allowArbitraryCreation: false,
                allowFractionalLending: false,
                leverageRatio: 1,
                maxSupply: 0
            })
        );

        assertEq(skateToken.totalSupply(), 33_000_000 * 1e18);
        assertEq(skateToken.balanceOf(ryan), 33_000_000 * 1e18); // Bank holds all

        // ═══════════════════════════════════════════════════════════════
        // ACT 3: Propose buying a pizza making machine
        // ═══════════════════════════════════════════════════════════════

        vm.prank(ryan);
        uint256 pizzaProposal = governance.createProposal(
            skateville,
            "Buy a pizza making machine for the community",
            "QmPizzaProposalDetails",
            GovernanceModule.QuorumType.Majority,
            51,
            0,
            1 days,
            GovernanceModule.OutcomeType.ShareOwnership,
            0.071 ether,  // ~$266 per yes vote
            0,
            "Pizza Foundry"
        );

        // ═══════════════════════════════════════════════════════════════
        // ACT 4: Everyone votes YES (crowdfunding the machine)
        // ═══════════════════════════════════════════════════════════════

        vm.prank(ryan);
        governance.castVote{value: 0.071 ether}(pizzaProposal, true);
        vm.prank(jess);
        governance.castVote{value: 0.071 ether}(pizzaProposal, true);

        for (uint i = 0; i < friends.length; i++) {
            vm.prank(friends[i]);
            governance.castVote{value: 0.071 ether}(pizzaProposal, true);
        }

        // Wolfgang votes yes too
        vm.prank(wolfgang);
        governance.castVote{value: 0.071 ether}(pizzaProposal, true);

        // Verify tally: 8 yes, 0 no
        (,,,, uint256 yesVotes, uint256 noVotes, uint256 totalFunded,,,,) =
            governance.getProposal(pizzaProposal);
        assertEq(yesVotes, 8);
        assertEq(noVotes, 0);
        assertEq(totalFunded, 0.071 ether * 8); // ~$2,128

        // Finalize after voting period
        vm.warp(block.timestamp + 2 days);
        governance.finalizeProposal(pizzaProposal);

        (,,, GovernanceModule.ProposalStatus status,,,,,,,) =
            governance.getProposal(pizzaProposal);
        assertTrue(status == GovernanceModule.ProposalStatus.Passed);

        // ═══════════════════════════════════════════════════════════════
        // ACT 5: Create the Pizza Foundry institution
        // ═══════════════════════════════════════════════════════════════

        vm.prank(ryan);
        uint256 pizzaInst = institutions.createInstitution(
            skateville, "Pizza Foundry", 100, true
        );

        // Allocate shares to yes-voters proportionally
        address[] memory yesVoters = governance.getYesVoters(pizzaProposal);
        uint256 sharesPerVoter = 100 / yesVoters.length; // ~12 each

        vm.startPrank(ryan);
        for (uint i = 0; i < yesVoters.length; i++) {
            institutions.allocateShares(pizzaInst, yesVoters[i], sharesPerVoter);
        }
        vm.stopPrank();

        assertEq(institutions.getShareholderCount(pizzaInst), 8);

        // ═══════════════════════════════════════════════════════════════
        // ACT 6: Hire Wolfgang as the pizza chef
        // ═══════════════════════════════════════════════════════════════

        vm.prank(ryan);
        uint256 chefPos = institutions.createPosition(
            pizzaInst,
            "Pizza Chef",
            "Operate pizza machine, maintain quality, 200 pizzas/day",
            400,  // 400 tokens/day
            10    // 10 bonus shares
        );

        // Offer to Wolfgang
        vm.prank(ryan);
        institutions.offerPosition(chefPos, wolfgang);

        // Wolfgang accepts!
        vm.prank(wolfgang);
        institutions.acceptPosition(chefPos);

        (,,,,, address chef,) = institutions.getPosition(chefPos);
        assertEq(chef, wolfgang);
        // Wolfgang now has 12 (from vote) + 10 (from position) = 22 shares
        assertEq(institutions.getMemberShares(pizzaInst, wolfgang), sharesPerVoter + 10);

        // ═══════════════════════════════════════════════════════════════
        // ACT 7: Pay Wolfgang his salary
        // ═══════════════════════════════════════════════════════════════

        vm.prank(ryan);
        skateToken.distributeSalary(wolfgang, 400 * 1e18, "Pizza Chef");
        assertEq(skateToken.balanceOf(wolfgang), 400 * 1e18);

        // ═══════════════════════════════════════════════════════════════
        // ACT 8: Distribute dividends from the Pizza Foundry
        // ═══════════════════════════════════════════════════════════════

        uint256 dividendAmount = 8000 * 1e18;
        vm.startPrank(ryan);
        skateToken.approve(address(institutions), dividendAmount);
        institutions.distributeDividends(pizzaInst, address(skateToken), dividendAmount);
        vm.stopPrank();

        // Everyone should have received proportional dividends
        assertTrue(skateToken.balanceOf(jess) > 0);

        // ═══════════════════════════════════════════════════════════════
        // ACT 9: Form alliance with Alpha Centauri
        // ═══════════════════════════════════════════════════════════════

        // Create the second community
        address[] memory foundersB = new address[](1);
        foundersB[0] = makeAddr("alphaFounder");

        vm.prank(makeAddr("alphaFounder"));
        alphaCentauri = factory.createCommunity(
            "Alpha Centauri", "", foundersB, bylaws, "", "", false
        );

        // Ryan proposes alliance
        vm.prank(ryan);
        uint256 allianceId = alliances.proposeAlliance(
            skateville, alphaCentauri,
            "QmAllianceTerms",
            500,   // 500 tokens per member
            true,  // Free travel
            true   // Voting rights
        );

        // Alpha Centauri founder accepts
        vm.prank(makeAddr("alphaFounder"));
        alliances.acceptAlliance(allianceId);

        assertTrue(alliances.isAllied(skateville, alphaCentauri));

        // ═══════════════════════════════════════════════════════════════
        // EPILOGUE: Verify the final state
        // ═══════════════════════════════════════════════════════════════

        // Community exists with members
        assertEq(community.getMemberCount(), 8);

        // Token economy is running
        assertTrue(skateToken.totalSupply() == 33_000_000 * 1e18);

        // Institution is active with shareholders
        (string memory instName,,,,,, ) = institutions.getInstitution(pizzaInst);
        assertEq(instName, "Pizza Foundry");
        assertEq(institutions.getShareholderCount(pizzaInst), 8);

        // Position is filled
        assertFalse(institutions.isPositionVacant(chefPos));

        // Alliance is active
        assertTrue(alliances.isAllied(skateville, alphaCentauri));

        // The community has 1 institution
        uint256[] memory communityInsts = institutions.getCommunityInstitutions(skateville);
        assertEq(communityInsts.length, 1);

        // Factory knows about 2 communities
        assertEq(factory.getCommunityCount(), 2);
    }
}
