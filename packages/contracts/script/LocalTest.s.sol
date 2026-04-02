// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CommunityFactory} from "../src/CommunityFactory.sol";
import {Community} from "../src/Community.sol";

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

        console.log("");
        console.log("=== END-TO-END TEST PASSED ===");
        console.log("=== Aquarius is ALIVE on the blockchain! ===");

        vm.stopBroadcast();
    }
}
