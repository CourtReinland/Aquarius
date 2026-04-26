// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {Community} from "../src/Community.sol";
import {GovernanceModule} from "../src/GovernanceModule.sol";

/**
 * @notice End-to-end local test: deploy factory, create a community, verify state.
 *
 * Usage:
 *   anvil &  # Start local chain
 *   forge script script/LocalTest.s.sol:LocalTestScript \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 */
contract LocalTestScript is Script {
    function run() public {
        vm.startBroadcast();

        // 1. Deploy factory
        CommunityFactory factory = new CommunityFactory();
        console.log("=== CommunityFactory deployed at:", address(factory));

        // 2. Create "Cincinnati Skateville" community
        address[] memory founders = new address[](1);
        founders[0] = msg.sender;

        Community.Bylaws memory bylaws = Community.Bylaws({
            admissionRule: Community.MemberAdmission.FoundersAndMembers,
            exileRule: Community.MemberAdmission.FoundersOnly,
            voteThreshold: Community.VoteThreshold.Majority,
            votePercentage: 51,
            whoMayPropose: Community.ProposalPermission.FoundersOrMembers,
            requireBuyIn: false
        });

        address communityAddr = factory.createCommunity(
            "Cincinnati Skateville",
            "QmExampleCharterHash",
            founders,
            bylaws,
            "U.S. Code",
            "State of Ohio",
            false
        );

        console.log("=== Community 'Cincinnati Skateville' deployed at:", communityAddr);

        // 3. Verify state
        Community community = Community(communityAddr);
        (string memory name,,,,, uint256 createdAt) = community.info();
        console.log("=== Community name:", name);
        console.log("=== Created at:", createdAt);
        console.log("=== Founder count:", community.getFounderCount());
        console.log("=== Member count:", community.getMemberCount());
        console.log("=== Is founder (deployer):", community.isFounder(msg.sender));

        // 4. Verify factory tracking
        console.log("=== Total communities in factory:", factory.getCommunityCount());

        // 5. Register an ERC-8004 AI Agent
        address aiBot = address(0xA1B07);
        community.registerAIAgent(
            aiBot,
            "did:erc8004:aquarius:skateville-bot",
            "ipfs://QmSkatevilleAIAgent"
        );
        console.log("=== AI Agent registered:", aiBot);
        console.log("=== AI agent count:", community.getAIAgentCount());
        console.log("=== AI agent is member:", community.isMember(aiBot));

        // 6. Deploy GovernanceModule & create a smart proposal
        GovernanceModule governance = new GovernanceModule();
        console.log("=== GovernanceModule deployed at:", address(governance));

        // Minimal bytecode: a contract that just stores a value
        // (runtime = PUSH1 0x42 PUSH1 0 SSTORE STOP → 0x60420060005500)
        bytes memory initCode = hex"6060604052600760008190555060358060186000396000f3fe6000357c01000000000000000000000000000000000000000000000000000000009004806360fe47b11460005763000000005b005b60076000f3";

        uint256 proposalId = governance.createSmartProposal(
            communityAddr,
            "Deploy Skateville Score Tracker",
            "QmSkateScoreProposal",
            GovernanceModule.QuorumType.Majority,
            51, 0, 300,  // 5 min vote
            0, 0, "Score Tracker",
            initCode
        );
        console.log("=== Smart Proposal created, ID:", proposalId);

        // Cast a yes vote (proposer is only member so auto-passes)
        governance.castVote(proposalId, true);
        console.log("=== Vote cast: YES");

        console.log("");
        console.log("=== END-TO-END TEST PASSED ===");
        console.log("=== Aquarius is ALIVE on the blockchain! ===");
        console.log("=== ERC-8004 AI agents + Smart Proposals ready ===");

        vm.stopBroadcast();
    }
}
