# Aquarius Current Build

This document summarizes what Aquarius can do today, how the pieces fit together, and which parts are still scaffolding or planned. It is meant to be the fastest orientation point for a new developer or reviewer.

## Product Shape

Aquarius is a blockchain-native community management platform for humans and AI agents. A community can define bylaws, membership rules, proposal rules, a token economy, institutions, positions, shares, alliances, legal documents, and agent members. The current implementation is strongest on Android/mobile, Solidity contracts, and Hono API services.

The key design principle is:

```text
wallet proves identity
contracts define authority
the app/API provide convenience and readability
```

No centralized username/password server is required for the root identity model.

## Current Capabilities

| Area | Built Today | Source of Truth |
|---|---|---|
| Wallet login | Local wallet connect plus SIWE-style challenge/sign/verify flow | Wallet signature |
| Local identity | Aquarius Passport stores linked wallets and short-lived sessions locally | Device storage |
| Community founding | Deploy community contracts through `CommunityFactory` | On-chain |
| Community bylaws | Admission, exile, voting, proposal permissions, corporate/agent member support | On-chain |
| Membership | Founders and members are tracked by each `Community` contract | On-chain |
| AI-agent membership | Agents have wallets, public agent cards, and community registry entries | API + on-chain optional |
| Proposals | Create, vote, fund, finalize, cancel, refund | On-chain |
| Smart proposals | Store creation bytecode and deploy a contract when a proposal passes | On-chain |
| Community tokens | ERC-20 style token with Austrian or Keynesian banking rules | On-chain |
| Institutions | Create institutions, allocate shares, create/offer/accept/vacate positions | On-chain |
| Dividends | Proportional token dividend distribution for institution shareholders | On-chain |
| Alliances | Propose, accept, decline, dissolve inter-community alliances | On-chain |
| Legal docs | Generate charters/bylaws with Anthropic Claude from community parameters | API |
| Explorer UI | 3D/2D community explorer and membership dashboard | Mobile app + chain reads |
| Android deployment | Release APK builds and installs on a connected Pixel 3a | Native Android project |

## Repository Structure

```text
apps/mobile/            React Native + Expo Android-first app
apps/web/               HTML prototypes and planned web source of truth
apps/desktop/           Placeholder Tauri shell
packages/api/           Hono API for auth, agents, legal docs, community stubs
packages/contracts/     Solidity contracts and Foundry tests
packages/shared/        Shared package placeholder
docs/                   Architecture, setup, current build, identity, agents
```

## Mobile App

The mobile app is the most complete client implementation. It runs as a React Native + Expo app and has been built and installed on a physical Pixel 3a.

### Screens

| Screen | Purpose |
|---|---|
| Home | Wallet connection and entry point |
| Community Explorer | Search/browse communities in 2D grid or 3D scene |
| Found Community | Three-step community creation wizard |
| Found Community Success | Post-deploy confirmation |
| My Memberships | Wallet profile, memberships, agent count, active votes, local Passport |
| Create AI Agent | Community-scoped agent setup form |
| Proposals Tracker | Proposal lists, voting modal, proposal creation modal |
| Banking Setup | Token/banking configuration UI |
| Bi-laws Explorer | Constitution/bylaws-style community view |
| Histories Explorer | Event/history-oriented explorer |
| Congrats / Role | Role acceptance notification mock flow |
| Alliance Approval | Inter-community alliance invitation mock flow |
| Legal Doc Viewer | Generated legal document review |

### Mobile Data Flow

- `BlockchainContext` hydrates the signing key from SecureStore, then calls `useBlockchainData` for wallet-scoped chain reads.
- `useWalletStore` persists Passport metadata (session + linked wallets) in AsyncStorage — never the private key.
- `WalletConnect` creates/imports a personal local wallet (or opt-in Anvil account #0 when `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1`), then signs in through the auth API.
- `useWalletAuth` performs the SIWE-style challenge/verify flow with the same `getWalletClient()` used for txs.
- `useAgentCreator` creates agent cards/wallets through the API and sends the signed session when present.
- Contract write hooks sign through `src/wallet/signer.ts` → `getWalletClient()` (no silent shared Anvil key).

## Wallet-Native Login

Aquarius login is not a centralized account record. It is proof that the current user controls a wallet.

### Implemented Flow

1. User creates or imports a local wallet.
2. App asks the API for `POST /api/auth/challenge`.
3. API returns a one-time SIWE-style message with nonce and expiration.
4. Wallet signs the message locally.
5. App sends `message + signature` to `POST /api/auth/verify`.
6. API verifies the signature with `viem.verifyMessage`.
7. API returns a short-lived session token.
8. App stores the session and linked wallet in the local Aquarius Passport.

### Why This Matters

- The private key never leaves the device.
- The API session is only a convenience token.
- Membership, rights, shares, votes, and obligations still come from contracts.
- One human can locally link multiple wallets without publicly revealing that relationship.

### Current Auth Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/challenge` | Create nonce-bound SIWE-style message |
| `POST /api/auth/verify` | Verify wallet signature and issue session |
| `GET /api/auth/session` | Validate bearer session token |
| `POST /api/auth/logout` | Revoke bearer session token |

### Signing Modes (Mobile)

| Mode | Flag | Behavior |
|---|---|---|
| Secure (default) | unset | Generate/import personal key; persist in SecureStore; sign via `getWalletClient()` |
| Dev Anvil | `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1` | Explicit UI button for Anvil account #0; labeled **DEV SIGNER ACTIVE** |

Web preview cannot use SecureStore and falls back to AsyncStorage for the key — preview-only, not for real funds.

### Current Limitations

- Session storage is in-memory in the API process.
- Production wallet connectors are planned: WalletConnect v2, Coinbase Wallet, hardware wallets.
- Smart-contract wallet auth needs ERC-1271 support.
- Smart-account onboarding should use ERC-4337 in production.

See [IDENTITY.md](IDENTITY.md) for the detailed identity model.

## AI Agents

Aquarius agents are intended to be first-class community members. The current build creates the identity layer and the management flow, but not yet a persistent autonomous runtime.

### Built Today

- Mobile `Create AI Agent` screen.
- `POST /api/agents/create` endpoint.
- Generated EOA wallet per agent.
- Public agent card with `agentId`, role, capabilities, community address, payment address, A2A/MCP endpoint placeholders, and prompt hash.
- Private prompt/runtime config stored by the API process.
- Optional encrypted private key storage if `AGENT_KEY_ENCRYPTION_SECRET` is set.
- Optional on-chain registration through `Community.registerAIAgent` if operator env vars are set.
- Agent creation attribution is protected: if `creatorAddress` is provided, the API requires a matching signed wallet session.

### Planned Next

- PostgreSQL + Drizzle persistence.
- KMS, Lit Protocol, or ERC-4337 smart accounts for agent keys.
- Isolated agent runtime workers.
- Event listeners with `viem.watchContractEvent`.
- Real A2A/MCP handlers.
- Governance-scoped permissioning for agent spending/voting/trading.

See [AGENTS.md](AGENTS.md) for the agent flow.

## Smart Contracts

Contracts are in `packages/contracts/src` and tested with Foundry.

### Modules

| Contract | Purpose |
|---|---|
| `CommunityFactory` | Deploys and tracks communities |
| `Community` | Stores community info, bylaws, founders, members, and AI-agent registry |
| `GovernanceModule` | Proposals, voting, funding, refunds, smart proposal deployment |
| `TokenModule` | ERC-20 style community token and banking rules |
| `InstitutionRegistry` | Institutions, shares, positions, dividends |
| `AllianceModule` | Inter-community alliances |

### Community

Supports founder/member lists, admission rules, exile rules, voting config, proposal permissions, corporate/AI member allowance, AI-agent registration, and AI-agent deactivation.

### Governance

Supports proposal creation by authorized community members, time-bounded voting, majority/supermajority/minimum-member quorum modes, yes/no tallies, optional ETH funding per yes vote, funding thresholds, failed/cancelled refunds, smart proposal bytecode registration, and smart proposal deployment.

### Tokens

Supports ERC-20 transfer/approve/transferFrom, bank-controlled minting, burning, salary distribution, Austrian fixed-supply banking, and Keynesian fractional/leverage banking.

### Institutions

Supports institution creation, share allocation, role/position creation, position offer/accept/decline/vacate, and token dividend distribution.

### Alliances

Supports alliance proposals, accept/decline flows, dissolution, and community alliance lookup.

## API Services

The API is a Hono server in `packages/api`.

| Route Group | Status | Purpose |
|---|---|---|
| `/health` | Built | Health check |
| `/api/auth/*` | Built | Wallet challenge, verify, session, logout |
| `/api/agents/*` | Built | Agent create/list/card |
| `/api/legal/*` | Built | Legal generation, template listing, summarization |
| `/api/communities/*` | Placeholder | Community CRUD facade, future contract-backed API |

### Important Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | API port, defaults to `3001` |
| `ANTHROPIC_API_KEY` | Enables legal document generation |
| `AQUARIUS_AUTH_SECRET` | Stable HMAC secret for API session tokens |
| `AGENT_KEY_ENCRYPTION_SECRET` | Encrypts generated agent private keys before storage |
| `AQUARIUS_OPERATOR_PRIVATE_KEY` | Operator wallet for agent registration/funding |
| `AQUARIUS_RPC_URL` or `RPC_URL` | RPC URL for API-side transactions |
| `AQUARIUS_PUBLIC_API_BASE_URL` | Public base URL used in generated agent cards |
| `AGENT_RUNTIME_BASE_URL` | Future A2A/MCP runtime base URL |
| `EXPO_PUBLIC_AQUARIUS_API_BASE_URL` | Mobile bundle API target override |
| `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER` | Set to `1` to allow opt-in Anvil shared-key signing in the mobile UI |

## Legal Generation

The API can generate legal charters/bylaws using Anthropic Claude from community wizard parameters.

Templates:

- Draft Original.
- U.S. Constitution inspired.
- Magna Carta inspired.
- Blackfeet Tribal Constitution inspired.

Generated docs are displayed in the mobile Legal Doc Viewer. IPFS pinning is planned; the on-chain community currently stores a charter hash field.

## Local Development Workflow

### Install

```bash
pnpm install
```

### Run Contracts

```bash
pnpm contracts:test
```

Current suite has 81 tests.

### Run API

```bash
pnpm --filter @aquarius/api dev
```

### Run Mobile Web Preview

```bash
pnpm --filter @aquarius/mobile web
```

### Build Android Release APK

```bash
cd apps/mobile/android
EXPO_PUBLIC_AQUARIUS_API_BASE_URL=http://127.0.0.1:3001 ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK output:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Pixel 3a Local Ports

When testing on a USB-connected Android phone:

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8545 tcp:8545
adb reverse tcp:3001 tcp:3001
```

## Verification Done Recently

The current feature set was checked with:

```bash
pnpm --filter @aquarius/api build
pnpm --filter @aquarius/mobile exec tsc --noEmit
pnpm contracts:test
```

The Android release APK was built and installed on a physical Pixel 3a.

## Known Gaps

- Web app is still prototype-only; mobile is the active client.
- Desktop app is a placeholder.
- API persistence is in-memory for auth sessions and agents.
- Contract state reads are direct and local-chain oriented; production should add an indexer.
- Agent runtime is not autonomous yet.
- External WalletConnect v2 / Coinbase Wallet / hardware connectors are planned but not fully integrated into the app flow.
- ERC-1271 smart-wallet signature verification is not implemented yet.
- ERC-4337 account abstraction is planned for production onboarding and agents.
- IPFS pinning flow for generated legal documents is planned.
- Community API CRUD route is still a placeholder facade.
