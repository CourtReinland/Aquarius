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
- Foundry invariant / fuzz campaigns under `test/invariant/` (refund conservation, status machine, mint bounds, membership, dividends).

### Invariant / fuzz tests

Default `forge test` uses a bounded invariant campaign (`[profile.default.invariant]`: `runs = 64`, `depth = 15`) so CI stays fast.

```bash
# Invariants + fuzz only
forge test --match-path test/invariant/

# Longer audit campaign (see [profile.audit] in foundry.toml)
forge test --profile audit --match-path test/invariant/

# Or override without switching profile
FOUNDRY_INVARIANT_RUNS=1000 FOUNDRY_INVARIANT_DEPTH=50 forge test --match-path test/invariant/
```

Handlers are targeted (bounded actors/actions, expected reverts swallowed) to avoid flaky chaos runs. Properties covered are listed in `test/invariant/SecurityInvariants.t.sol`.

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

## Security hardening

Focused guards added for the highest-risk paths (see [../../docs/CONTRACTS.md](../../docs/CONTRACTS.md#security-hardening--assumptions)):

| Threat | Fix |
|---|---|
| Refund reentrancy / stuck ETH on hostile receivers | `nonReentrant` + CEI queue into `claimableRefunds` + best-effort push + `claimRefund()` pull |
| Smart-proposal constructor reenters `executeProposal` | Status set to `Executed` before `CREATE`; permissionless execution kept (intentional) |
| `TokenModule.initialize` / bare `Community.initialize` frontrun | Deployer-only initializer (`deployer == msg.sender` at construction) |
| Malicious ERC-20 reenters `distributeDividends` | `nonReentrant` + `outstandingShares` accounting + zero-address/amount checks |
| Alliance / vote edge inputs | Zero-address + initialized community checks; reject unexpected ETH on free votes |

In-repo `src/utils/ReentrancyGuard.sol` (OZ-style) avoids a full OpenZeppelin submodule for a single primitive.

```bash
forge test --match-contract SecurityHardeningTest
forge test
```

## Reference

See [../../docs/CONTRACTS.md](../../docs/CONTRACTS.md) for function-level details and [../../docs/CURRENT_BUILD.md](../../docs/CURRENT_BUILD.md) for the product-level current build summary.
