# Aquarius Android App

Hybrid Human/AI Blockchain Community Manager. Built with Jetpack Compose, MVVM, and Web3 integrations.

## Architecture Choices
- **UI**: Jetpack Compose with Material3 for modern, responsive UI. MVI-inspired state management using Kotlin Flows and ViewModels.
- **Navigation**: Compose Navigation with Bottom Bar for 4 core screens.
- **State Management**: ViewModel + StateFlow for reactive updates (prepares for real-time blockchain events).
- **Architecture**: Clean MVVM with separation of concerns (ui/, viewmodel/, model/, web3/). Dummy data layer that mirrors future contract reads.
- **Web3**: WalletConnect v2 for wallet connection + Web3j for EVM interactions. Configured for local Anvil RPC (http://127.0.0.1:8545). Placeholder for ERC-8004 AgentRegistry and Governor contract calls.
- **Dependencies**: Compose BOM, Material3, Navigation, Coil (for agent avatars), WalletConnect, Web3j, Koin (DI).
- **Target**: SDK 34, minSDK 24. Optimized for phones/tablets.

This foundation prepares for integration with:
- Alice's smart contracts (registries, governors)
- Charlie's agent cards and ERC-8004 implementations
- Real-time updates from blockchain events

## Key Files Created
- **Gradle**: settings.gradle.kts, build.gradle.kts, libs.versions.toml, app/build.gradle.kts
- **Core**: MainActivity.kt, AquariusApp.kt (navigation), Theme.kt
- **Screens**: DashboardScreen.kt, AgentDirectoryScreen.kt (ERC-8004 cards), GovernanceScreen.kt (proposals/voting), WalletScreen.kt
- **ViewModel**: MainViewModel.kt (state + dummy blockchain simulation)
- **Models**: Agent.kt (with status, trustScore, onChainId), Community, Proposal, WalletState
- **Web3**: Web3Manager.kt (Anvil connection, contract placeholders)
- **Resources**: Manifest, themes, strings

## How the App Displays On-Chain Agents & Human Interactions
- **Agent Directory**: Displays cards for each registered ERC-8004 agent with avatar (placeholder), trust score, specialization, on-chain ID, status badge. Humans can "Interact" (future: trigger agent actions via contract calls).
- **Dashboard**: Overview of communities/DAOs with TVL, member/agent counts. Real-time refresh button simulates querying registry.
- **Governance**: Lists proposals with voting buttons (only when wallet connected). Shows hybrid consensus notes.
- **Wallet**: WalletConnect simulation. Once connected, enables all on-chain actions (voting, agent interaction). Displays address/balance.
- Agents appear as living on-chain entities. Humans connect wallet → view agents → vote on their proposals → interact directly with AI agents registered on-chain.

Future flows: Wallet connection triggers contract reads → populates real agent list from registry → humans propose/vote via Governor.

## Setup Instructions

1. Open the project root in Android Studio (Koala or later recommended).
2. Import the `mobile/` directory as an Android project (or open Aquarius/mobile).
3. Sync Gradle (it will download Compose, Web3j, WalletConnect dependencies).
4. For blockchain:
   - Start local Anvil: `anvil --port 8545` (from contracts/ or root)
   - Optionally deploy contracts from Alice's work to the addresses in Web3Manager.
5. Run the app on emulator/device (API 34+ recommended).
6. Configure RPC in code or add settings screen (default: http://10.0.2.2:8545 for emulator).
7. Connect wallet using the Wallet tab (simulated for now; full WalletConnect QR flow in Phase 1).

**Note**: This is a complete, buildable skeleton. Build may require small adjustments for WalletConnect signing in full prod. See development-workflow.md for integration steps with other team members.

Ready for Phase 1 enhancements!
