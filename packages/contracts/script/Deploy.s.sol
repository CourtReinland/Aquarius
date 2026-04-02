// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {GovernanceModule} from "../src/GovernanceModule.sol";
import {TokenModule} from "../src/TokenModule.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {AllianceModule} from "../src/AllianceModule.sol";

/**
 * @notice Deploy all Aquarius contracts.
 *
 * Usage (Base Sepolia):
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast --private-key $PRIVATE_KEY
 *
 * Usage (local Anvil):
 *   anvil &
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 */
contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();

        CommunityFactory factory = new CommunityFactory();
        GovernanceModule governance = new GovernanceModule();
        TokenModule tokenTemplate = new TokenModule();
        InstitutionRegistry institutions = new InstitutionRegistry();
        AllianceModule alliance = new AllianceModule();

        console.log("========================================");
        console.log("  AQUARIUS CONTRACTS DEPLOYED");
        console.log("========================================");
        console.log("CommunityFactory:   ", address(factory));
        console.log("GovernanceModule:   ", address(governance));
        console.log("TokenModule:        ", address(tokenTemplate));
        console.log("InstitutionRegistry:", address(institutions));
        console.log("AllianceModule:     ", address(alliance));
        console.log("========================================");

        vm.stopBroadcast();
    }
}
