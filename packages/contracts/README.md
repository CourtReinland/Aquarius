# Aquarius Contracts (`@aquarius/contracts`)

Solidity contracts for Aquarius community governance, tested with Foundry and designed for Base L2.

## Contracts

| Contract | Purpose |
|---|---|
| `CommunityFactory` | Deploys and tracks community contracts |
| `Community` | Stores community info, bylaws, founders, members, and AI-agent registry |
| `GovernanceModule` | Proposals, voting, funding, refunds, smart proposal deployment |
| `TokenModule` | ERC-20 style community token with Austrian/Keynesian banking config |
| `InstitutionRegistry` | Institutions, positions, shareholders, dividends |
| `AllianceModule` | Inter-community alliances |

## Test

```bash
forge test
```

The current suite covers:

- Community creation and member management.
- ERC-8004-style AI-agent registry behavior.
- Proposal creation, voting, funding, finalization, cancellation, refunds.
- Smart proposal bytecode registration and deployment.
- Token transfer, mint, burn, salary distribution, banking limits.
- Institution creation, shares, positions, dividends.
- Alliance propose/accept/decline/dissolve flows.
- Full Cincinnati Skateville E2E story.

## Build

```bash
forge build
```

## Deploy Locally

```bash
anvil
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

After deployment, copy contract addresses into `apps/mobile/src/config/chains.ts`.

## Reference

See [../../docs/CONTRACTS.md](../../docs/CONTRACTS.md) for function-level details and [../../docs/CURRENT_BUILD.md](../../docs/CURRENT_BUILD.md) for the product-level current build summary.
