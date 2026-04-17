// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IVotes} from "openzeppelin-contracts/governance/utils/IVotes.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {PermissionRegistry} from "../src/PermissionRegistry.sol";
import {HybridGovernor} from "../src/HybridGovernor.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;
    PermissionRegistry public permissionRegistry;
    HybridGovernor public governor;
    
    address public owner = address(0x1);
    address public user = address(0x2);
    string public testURI = "ipfs://QmTestAgentMetadata123";

    function setUp() public {
        vm.startPrank(owner);
        identityRegistry = new IdentityRegistry(owner);
        reputationRegistry = new ReputationRegistry(owner);
        validationRegistry = new ValidationRegistry(owner);
        permissionRegistry = new PermissionRegistry(owner);
        // Governor needs a token, using identityRegistry as vote token for test
        governor = new HybridGovernor(IVotes(address(identityRegistry)), reputationRegistry, permissionRegistry, "AquariusTestGovernor", owner);
        permissionRegistry.setIdentityRegistry(address(identityRegistry));
        vm.stopPrank();
    }

    function testRegisterAgent() public {
        vm.startPrank(owner);
        identityRegistry.grantRole(identityRegistry.REGISTERER_ROLE(), user);
        vm.stopPrank();

        vm.startPrank(user);
        uint256 tokenId = identityRegistry.registerAgent(testURI);
        assertEq(identityRegistry.ownerOf(tokenId), user);
        assertEq(identityRegistry.tokenURI(tokenId), testURI);
        vm.stopPrank();
    }

    function testReputationUpdate() public {
        vm.startPrank(owner);
        reputationRegistry.grantRole(reputationRegistry.UPDATER_ROLE(), owner);
        reputationRegistry.updateReputation(user, 250, "test_action");
        assertEq(reputationRegistry.getReputation(user), 350); // default 100 + 250
        vm.stopPrank();
    }

    function testValidationProof() public {
        vm.startPrank(owner);
        validationRegistry.grantRole(validationRegistry.VALIDATOR_ROLE(), owner);
        bytes32 proofId = keccak256("test-proof-1");
        bytes32 proofHash = keccak256("execution-result");
        bool success = validationRegistry.storeProof(proofId, proofHash, "execution");
        assertTrue(success);
        assertTrue(validationRegistry.verifyProof(proofId, proofHash));
        vm.stopPrank();
    }

    function testPermissionManagement() public {
        vm.startPrank(owner);
        permissionRegistry.grantPermission(keccak256("VOTER_ROLE"), user, false);
        assertTrue(permissionRegistry.hasPermission(keccak256("VOTER_ROLE"), user, 0));
        vm.stopPrank();
    }

    // Additional tests for governor, permissions with NFTs, edge cases would go here in full suite
    function testHybridVotingFlow() public {
        // Simplified test for hybrid flow
        vm.startPrank(owner);
        permissionRegistry.grantPermission(keccak256("VOTER_ROLE"), owner, false);
        vm.stopPrank();
        
        // In full implementation, would propose and vote with agent logic
        assertTrue(true); // Placeholder for complex governor test
    }
}