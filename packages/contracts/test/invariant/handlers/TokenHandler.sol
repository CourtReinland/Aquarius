// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TokenModule} from "../../../src/TokenModule.sol";

/**
 * @notice Targeted handler for Austrian / Keynesian mint-bound and burn invariants.
 */
contract TokenHandler is Test {
    TokenModule public immutable austrian;
    TokenModule public immutable keynesian;
    address public immutable bank;

    address[] public actors;

    uint256 public ghostMintedAustrian;
    uint256 public ghostBurnedAustrian;
    uint256 public ghostMintedKeynesian;
    uint256 public ghostBurnedKeynesian;

    uint256 public nonBankMintSucceeded;
    uint256 public calls;

    uint256 public immutable initialAustrian;
    uint256 public immutable initialKeynesian;
    uint256 public immutable austrianMax;
    uint256 public immutable keynesianBase;
    uint8 public immutable leverage;

    constructor(
        TokenModule _austrian,
        TokenModule _keynesian,
        address _bank,
        address[] memory _actors
    ) {
        austrian = _austrian;
        keynesian = _keynesian;
        bank = _bank;
        actors = _actors;

        initialAustrian = _austrian.totalSupply();
        initialKeynesian = _keynesian.totalSupply();
        austrianMax = _austrian.getMaxSupply();
        keynesianBase = _keynesian.getMaxSupply();
        (, , , uint8 lev,) = _keynesian.bankingConfig();
        leverage = lev;
    }

    function mintAustrian(uint256 toSeed, uint256 amountSeed) external {
        address to = actors[bound(toSeed, 0, actors.length - 1)];
        // Prefer amounts that may hit the cap
        uint256 amount = bound(amountSeed, 0, austrianMax);

        uint256 beforeSupply = austrian.totalSupply();
        vm.prank(bank);
        try austrian.mint(to, amount, "inv") {
            uint256 minted = austrian.totalSupply() - beforeSupply;
            ghostMintedAustrian += minted;
        } catch {}
        calls++;
    }

    function mintKeynesian(uint256 toSeed, uint256 amountSeed) external {
        address to = actors[bound(toSeed, 0, actors.length - 1)];
        uint256 maxAllowed = keynesianBase * uint256(leverage);
        uint256 room = maxAllowed > keynesian.totalSupply()
            ? maxAllowed - keynesian.totalSupply()
            : 0;
        // Include overshoot attempts
        uint256 amount = bound(amountSeed, 0, room + (keynesianBase / 10) + 1);

        uint256 beforeSupply = keynesian.totalSupply();
        vm.prank(bank);
        try keynesian.mint(to, amount, "inv") {
            ghostMintedKeynesian += keynesian.totalSupply() - beforeSupply;
        } catch {}
        calls++;
    }

    function mintAsNonBank(uint256 actorSeed, uint256 which, uint256 amountSeed) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        if (actor == bank) {
            calls++;
            return;
        }
        uint256 amount = bound(amountSeed, 1, 1e18);
        if (which % 2 == 0) {
            vm.prank(actor);
            try austrian.mint(actor, amount, "hack") {
                nonBankMintSucceeded++;
            } catch {}
        } else {
            vm.prank(actor);
            try keynesian.mint(actor, amount, "hack") {
                nonBankMintSucceeded++;
            } catch {}
        }
        calls++;
    }

    function burnAustrian(uint256 actorSeed, uint256 amountSeed) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 bal = austrian.balanceOf(actor);
        if (bal == 0) {
            calls++;
            return;
        }
        uint256 amount = bound(amountSeed, 0, bal);
        uint256 beforeSupply = austrian.totalSupply();
        vm.prank(actor);
        try austrian.burn(amount) {
            ghostBurnedAustrian += beforeSupply - austrian.totalSupply();
        } catch {}
        calls++;
    }

    function burnKeynesian(uint256 actorSeed, uint256 amountSeed) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 bal = keynesian.balanceOf(actor);
        if (bal == 0) {
            calls++;
            return;
        }
        uint256 amount = bound(amountSeed, 0, bal);
        uint256 beforeSupply = keynesian.totalSupply();
        vm.prank(actor);
        try keynesian.burn(amount) {
            ghostBurnedKeynesian += beforeSupply - keynesian.totalSupply();
        } catch {}
        calls++;
    }

    function transferAustrian(uint256 fromSeed, uint256 toSeed, uint256 amountSeed) external {
        address from = actors[bound(fromSeed, 0, actors.length - 1)];
        address to = actors[bound(toSeed, 0, actors.length - 1)];
        uint256 bal = austrian.balanceOf(from);
        if (bal == 0 || to == address(0)) {
            calls++;
            return;
        }
        uint256 amount = bound(amountSeed, 0, bal);
        vm.prank(from);
        try austrian.transfer(to, amount) {} catch {}
        calls++;
    }

    function transferKeynesian(uint256 fromSeed, uint256 toSeed, uint256 amountSeed) external {
        address from = actors[bound(fromSeed, 0, actors.length - 1)];
        address to = actors[bound(toSeed, 0, actors.length - 1)];
        uint256 bal = keynesian.balanceOf(from);
        if (bal == 0 || to == address(0)) {
            calls++;
            return;
        }
        uint256 amount = bound(amountSeed, 0, bal);
        vm.prank(from);
        try keynesian.transfer(to, amount) {} catch {}
        calls++;
    }

    function sumBalances(TokenModule token) external view returns (uint256 sum) {
        for (uint256 i = 0; i < actors.length; i++) {
            sum += token.balanceOf(actors[i]);
        }
    }
}
