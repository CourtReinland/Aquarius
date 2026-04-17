// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {PermissionRegistry} from "../src/PermissionRegistry.sol";
import {HybridGovernor} from "../src/HybridGovernor.sol";
import {IVotes} from "openzeppelin-contracts/governance/utils/IVotes.sol";
import {console} from "forge-std/console.sol";

/**
 * @title Deploy
 * @notice Deploys all Aquarius core contracts to local Anvil fork.
 * Registers sample agents for testing hybrid DAO functionality.
 * Ready for testnet/mainnet with minor config changes.
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying Aquarius contracts from:", deployer);

        // Deploy core registries
        IdentityRegistry identityRegistry = new IdentityRegistry(deployer);
        ReputationRegistry reputationRegistry = new ReputationRegistry(deployer);
        ValidationRegistry validationRegistry = new ValidationRegistry(deployer);
        PermissionRegistry permissionRegistry = new PermissionRegistry(deployer);
        
        // Set cross-references
        permissionRegistry.setIdentityRegistry(address(identityRegistry));
        
        // Deploy governor (using identityRegistry as placeholder for vote token; in prod use dedicated token)
        HybridGovernor governor = new HybridGovernor(
            IVotes(address(identityRegistry)), 
            reputationRegistry, 
            permissionRegistry, 
            "AquariusHybridGovernor",
            deployer
        );

        // Setup roles and permissions
        identityRegistry.grantRole(identityRegistry.REGISTERER_ROLE(), deployer);
        identityRegistry.grantRole(identityRegistry.VALIDATOR_ROLE(), deployer);
        reputationRegistry.grantRole(reputationRegistry.UPDATER_ROLE(), address(validationRegistry));
        permissionRegistry.grantPermission(keccak256("VOTER_ROLE"), deployer, false);
        permissionRegistry.addModule(address(governor), address(0));

        // Register sample agents (2-3 as per requirements)
        uint256 agent1 = identityRegistry.registerAgent("ipfs://QmAgent1Metadata-HumanDAOContributor");
        uint256 agent2 = identityRegistry.registerAgent("ipfs://QmAgent2Metadata-AIAnalyst");
        uint256 agent3 = identityRegistry.registerAgent("ipfs://QmAgent3Metadata-ResearcherTBA");
        
        // Assign sample TBAs for ERC6551 compatibility (in prod use proper 6551 registry)
        // TODO: Integrate proper ERC-6551 registry in production
        identityRegistry.assignTBA(agent1, address(0x0000000000000000000000000000000000000001));
        identityRegistry.assignTBA(agent2, address(0x0000000000000000000000000000000000000002));
        
        // Update initial reputations
        reputationRegistry.updateReputation(deployer, 1000, "genesis_deployer");
        reputationRegistry.updateReputation(vm.addr(0xABCD), 750, "sample_agent");
        
        console.log("=== Aquarius DAO Contracts Deployed Successfully ===");
        console.log("IdentityRegistry:", address(identityRegistry));
        console.log("ReputationRegistry:", address(reputationRegistry));
        console.log("ValidationRegistry:", address(validationRegistry));
        console.log("PermissionRegistry:", address(permissionRegistry));
        console.log("HybridGovernor:", address(governor));
        console.log("Sample Agent NFTs minted:", agent1, agent2, agent3);
        console.log("Deployment complete. Ready for integration with Goose agents and frontend.");

        vm.stopBroadcast();
    }
}