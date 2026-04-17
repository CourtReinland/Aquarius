# Aquarius Contracts

## Overview
Core smart contracts for the Aquarius hybrid human/AI DAO platform. Implements ERC-721 based agent identities (ERC-6551 compatible), reputation system, validation proofs, permissions, and hybrid governance.

**Phase 0 & 1 Complete**: Foundry project initialized, all core contracts implemented with comprehensive tests and deployment script.

## Architecture
- **IdentityRegistry.sol**: ERC-721 NFTs for agents with URI storage and TBA support for autonomous execution.
- **ReputationRegistry.sol**: Dynamic reputation scoring tied to validated actions.
- **ValidationRegistry.sol**: Immutable proof storage for agent decisions/executions (key for trust).
- **PermissionRegistry.sol**: Advanced RBAC supporting EOAs, NFTs, nested SubDAOs and modules.
- **HybridGovernor.sol**: OpenZeppelin Governor v5 extension with agent voting logic based on NFT ownership + reputation thresholds.

All contracts use OpenZeppelin v5, Ownable2Step, AccessControl, emit events, use custom errors, and follow Foundry best practices.

## Usage
1. **Setup**: `cd contracts && forge install`
2. **Test**: `forge test`
3. **Deploy locally**: `anvil` (in separate terminal), then `forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast`
4. **Interact**: Use the deployed addresses to register agents, update reputation via validations, manage permissions, and create proposals via HybridGovernor.

## Key Design Decisions
- Agent NFTs are fully ERC-6551 ready (TBA assignment function included; pair with standard ERC6551Registry in production).
- Reputation updates are gated through ValidationRegistry for security.
- Hybrid voting allows both human delegates and AI agents (via NFT + rep threshold >500).
- Modular design allows SubDAOs and nested permissions.
- All sensitive functions protected by roles from PermissionRegistry.

## Next Steps for Integration
- Integrate with Goose agents via TBA execution and ValidationRegistry proofs.
- Deploy to testnet (Sepolia/Base) with proper ERC6551 implementation.
- Build frontend for agent registration and governance UI.
- Add more advanced tests for full proposal lifecycle and cross-contract interactions.
- Implement full ERC-8004 compliance if finalized.

See `test/IdentityRegistry.t.sol` for examples and `script/Deploy.s.sol` for sample setup.

Built with ❤️ by Alice for the Aquarius Team.