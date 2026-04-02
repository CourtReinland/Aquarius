// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Community} from "../src/Community.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {TokenModule} from "../src/TokenModule.sol";

contract TokenModuleTest is Test {
    CommunityFactory public factory;
    TokenModule public token;

    address public alice = makeAddr("alice"); // founder + bank
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    address public communityAddr;

    function setUp() public {
        factory = new CommunityFactory();
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

        communityAddr = factory.createCommunity("TokenTest", "", founders, bylaws, "", "", false);
    }

    function _initAustrian() internal {
        token.initialize(
            "Skateville Coin", "SKATE",
            communityAddr, alice,
            33_000_000, // 33M tokens
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Austrian,
                allowArbitraryCreation: false,
                allowFractionalLending: false,
                leverageRatio: 1,
                maxSupply: 0 // Will be set to initial supply by initialize()
            })
        );
    }

    function _initKeynesian() internal {
        token.initialize(
            "Flexible Coin", "FLEX",
            communityAddr, alice,
            10_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Keynesian,
                allowArbitraryCreation: false,
                allowFractionalLending: true,
                leverageRatio: 4,
                maxSupply: 0
            })
        );
    }

    // ─── Initialization ───────────────────────────────────────────────

    function test_InitializeAustrian() public {
        _initAustrian();

        assertEq(token.name(), "Skateville Coin");
        assertEq(token.symbol(), "SKATE");
        assertEq(token.totalSupply(), 33_000_000 * 1e18);
        assertEq(token.balanceOf(alice), 33_000_000 * 1e18);
        assertEq(token.getBankBalance(), 33_000_000 * 1e18);
    }

    function test_RevertDoubleInitialize() public {
        _initAustrian();
        vm.expectRevert("Already initialized");
        _initAustrian();
    }

    // ─── ERC-20 Transfers ─────────────────────────────────────────────

    function test_Transfer() public {
        _initAustrian();

        vm.prank(alice);
        token.transfer(bob, 1000 * 1e18);

        assertEq(token.balanceOf(bob), 1000 * 1e18);
        assertEq(token.balanceOf(alice), (33_000_000 - 1000) * 1e18);
    }

    function test_RevertInsufficientBalance() public {
        _initAustrian();

        vm.prank(bob); // Bob has 0 tokens
        vm.expectRevert("Insufficient balance");
        token.transfer(charlie, 1);
    }

    function test_ApproveAndTransferFrom() public {
        _initAustrian();

        vm.prank(alice);
        token.approve(bob, 500 * 1e18);

        assertEq(token.allowance(alice, bob), 500 * 1e18);

        vm.prank(bob);
        token.transferFrom(alice, charlie, 500 * 1e18);

        assertEq(token.balanceOf(charlie), 500 * 1e18);
        assertEq(token.allowance(alice, bob), 0);
    }

    // ─── Austrian Banking ─────────────────────────────────────────────

    function test_AustrianCannotMintBeyondSupply() public {
        _initAustrian();

        // Austrian with allowArbitraryCreation=false cannot mint at all
        vm.prank(alice);
        vm.expectRevert("Austrian: arbitrary creation disabled");
        token.mint(bob, 1, "test");
    }

    function test_AustrianWithCreationEnabled() public {
        token.initialize(
            "Gold Coin", "GOLD",
            communityAddr, alice,
            1_000_000,
            TokenModule.BankingConfig({
                style: TokenModule.BankingStyle.Austrian,
                allowArbitraryCreation: true,
                allowFractionalLending: false,
                leverageRatio: 1,
                maxSupply: 0
            })
        );

        // Can mint up to max supply
        // Max supply is set to initial = 1M * 1e18
        // Already minted 1M, so no more room
        vm.prank(alice);
        vm.expectRevert("Austrian: exceeds max supply");
        token.mint(bob, 1, "over limit");
    }

    // ─── Keynesian Banking ────────────────────────────────────────────

    function test_KeynesianCanMintWithinLeverage() public {
        _initKeynesian();

        // Initial: 10M tokens, leverage 4x → max 40M
        // Already have 10M, can mint up to 30M more
        vm.prank(alice);
        token.mint(bob, 5_000_000 * 1e18, "Stimulus");

        assertEq(token.balanceOf(bob), 5_000_000 * 1e18);
        assertEq(token.totalSupply(), 15_000_000 * 1e18);
    }

    function test_KeynesianCannotExceedLeverage() public {
        _initKeynesian();

        // Try to mint 31M (would make total 41M, exceeding 4x leverage of 40M)
        vm.prank(alice);
        vm.expectRevert("Exceeds leverage ratio");
        token.mint(bob, 31_000_000 * 1e18, "Too much");
    }

    // ─── Salary Distribution ──────────────────────────────────────────

    function test_DistributeSalary() public {
        _initAustrian();

        vm.prank(alice);
        token.distributeSalary(bob, 400 * 1e18, "Baker");

        assertEq(token.balanceOf(bob), 400 * 1e18);
        assertEq(token.getBankBalance(), (33_000_000 - 400) * 1e18);
    }

    function test_RevertSalaryFromNonBank() public {
        _initAustrian();

        vm.prank(bob);
        vm.expectRevert("Only bank");
        token.distributeSalary(charlie, 100, "Hack");
    }

    // ─── Burn ─────────────────────────────────────────────────────────

    function test_BurnTokens() public {
        _initAustrian();

        vm.prank(alice);
        token.transfer(bob, 1000 * 1e18);

        uint256 supplyBefore = token.totalSupply();

        vm.prank(bob);
        token.burn(500 * 1e18);

        assertEq(token.balanceOf(bob), 500 * 1e18);
        assertEq(token.totalSupply(), supplyBefore - 500 * 1e18);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function test_GetBankingStyle() public {
        _initAustrian();
        assertEq(token.getBankingStyle(), "Austrian (Strict)");
    }

    function test_CanMint() public {
        _initKeynesian();
        assertTrue(token.canMint(1_000_000 * 1e18));
        assertFalse(token.canMint(31_000_000 * 1e18));
    }
}
