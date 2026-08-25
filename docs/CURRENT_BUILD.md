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
| Wallet login | Local wallet or WalletConnect v2 plus SIWE-style challenge/sign/verify flow | Wallet signature |
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
| Legal docs | Generate charters/bylaws with Grok (xAI) from community parameters; Anthropic optional fallback | API |
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

- `BlockchainContext` hydrates a WalletConnect session when present, otherwise the signing key from SecureStore, then calls `useBlockchainData` for wallet-scoped chain reads.
- `useWalletStore` persists Passport metadata (session + linked wallets) in AsyncStorage — never the private key.
- `WalletConnect` creates/imports a personal local wallet, connects WalletConnect v2 when `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` is set (or opt-in Anvil account #0 when `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1`), then signs in through the auth API.
- `useWalletAuth` performs the SIWE-style challenge/verify flow with the same `getWalletClient()` used for txs (WC session when connected, otherwise the local key).
- `useAgentCreator` creates agent cards/wallets through the API and sends the signed session when present.
- Contract write hooks sign through `src/wallet/signer.ts` → `getWalletClient()` (no silent shared Anvil key).

## Wallet-Native Login

Aquarius login is not a centralized account record. It is proof that the current user controls a wallet.

### Implemented Flow

1. User creates or imports a local wallet, or connects an external wallet via WalletConnect v2.
2. App asks the API for `POST /api/auth/challenge`.
3. API returns a one-time SIWE-style message with nonce and expiration.
4. Wallet signs the message locally.
5. App sends `message + signature` to `POST /api/auth/verify`.
6. API verifies the signature with `viem.verifyMessage` for EOAs, or ERC-1271 `isValidSignature` (magic `0x1626ba7e`) for contract wallets when `AQUARIUS_RPC_URL` or `RPC_URL` is set.
7. API returns a short-lived session token.
8. App stores the session and linked wallet in the local Aquarius Passport.

### Why This Matters

- The private key never leaves the device. With WalletConnect, it never enters the Aquarius process.
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
| WalletConnect v2 | `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` | External wallet session; `getWalletClient()` prefers WC when connected. Button hidden if unset. |
| Dev Anvil | `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1` | Explicit UI button for Anvil account #0; labeled **DEV SIGNER ACTIVE** |

Web preview cannot use SecureStore and falls back to AsyncStorage for the key — preview-only, not for real funds.

### Current Limitations

- Session and challenge storage is durable in Postgres when `DATABASE_URL` is set; otherwise it stays in-memory in the API process (not durable across restarts or replicas).
- Rate limits are per-process, not shared across multiple API instances.
- WalletConnect v2 is available on mobile when `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` is set (Android-first). Coinbase Wallet SDK and hardware wallets are still later.
- Smart-contract wallet auth uses ERC-1271 when `AQUARIUS_RPC_URL` or `RPC_URL` is set; without RPC, only EOA `personal_sign` is verified.
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
- Agent creation always requires a signed wallet session; creator attribution is bound to that session.
- Operator funding / on-chain registration are gated by `AGENT_OPERATOR_ACTIONS_ENABLED` (and optional allowlist) with an `AGENT_MAX_INITIAL_FUNDING_ETH` cap.
- `GET /api/agents` is auth-scoped to the caller's creations; public cards stay at `GET /api/agents/:id/card`.
- Auth challenge/verify are rate-limited; CORS is origin-allowlisted; API responses include basic security headers.
- Paid AI routes (legal generate/summarize, Blue chat) require a wallet session and are rate-limited per IP + address.

### Planned Next

- PostgreSQL + Drizzle persistence.
- KMS, Lit Protocol, or ERC-4337 smart accounts for agent keys.
- Isolated agent runtime workers.
- Wire the app to the API indexer stub (`GET /api/indexer/*`); expand beyond factory/community/governance events.
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
| `/api/legal/*` | Built | Legal generation/summarization (**session required**); templates public |
| `/api/blue/*` | Built | Blue chat (**session required**); status returns `{ available }` only |
| `/api/communities/*` | Placeholder | Community CRUD facade, future contract-backed API |
| `/api/indexer/*` | Stub | On-chain event catch-up (`getLogs`) + `watchContractEvent`; public community list |

### Important Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | API port, defaults to `3001` |
| `XAI_API_KEY` | Primary AI provider (Grok) for legal generate/summarize and Blue chat |
| `ANTHROPIC_API_KEY` | Optional Anthropic fallback when Grok is unset or a Grok call fails |
| `LEGAL_GROK_MODEL` / `AQUARIUS_GROK_MODEL` | Legal long-form Grok model (default `grok-4`) |
| `BLUE_GROK_MODEL` | Blue chat Grok model (default `grok-4-fast-non-reasoning`) |
| `AQUARIUS_AUTH_SECRET` | HMAC secret for API session tokens (**required in production**) |
| `AQUARIUS_ENV` / `NODE_ENV` | Set to `production` to enforce auth-secret boot checks |
| `AQUARIUS_CORS_ORIGINS` | Comma-separated CORS allowlist (dev defaults to localhost Expo/web) |
| `AGENT_KEY_ENCRYPTION_SECRET` | Encrypts generated agent private keys before storage |
| `AGENT_OPERATOR_ACTIONS_ENABLED` | Opt-in for operator funding / on-chain registration (`true` to enable) |
| `AGENT_OPERATOR_ALLOWLIST` | Optional wallets allowed to request operator-funded actions |
| `AGENT_MAX_INITIAL_FUNDING_ETH` | Cap for agent `initialFundingEth` (default `0.01`) |
| `AQUARIUS_OPERATOR_PRIVATE_KEY` | Operator wallet for agent registration/funding |
| `AQUARIUS_RPC_URL` or `RPC_URL` | RPC URL for API-side transactions and ERC-1271 SIWE verification |
| `AQUARIUS_PUBLIC_API_BASE_URL` | Public base URL used in generated agent cards |
| `AGENT_RUNTIME_BASE_URL` | Future A2A/MCP runtime base URL |
| `DATABASE_URL` | Postgres URL for durable auth sessions/challenges, Agent Foundry schema, and indexer cursors/events. Unset = in-memory fallback |
| `EXPO_PUBLIC_AQUARIUS_API_BASE_URL` | Mobile bundle API target override |
| `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER` | Set to `1` to allow opt-in Anvil shared-key signing in the mobile UI |
| `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown / WalletConnect Cloud project ID. Unset hides the WalletConnect button |
| `INDEXER_START_BLOCK` | First block for indexer catch-up when no cursor exists (default `0`) |
| `AQUARIUS_COMMUNITY_FACTORY_ADDRESS` / `COMMUNITY_FACTORY_ADDRESS` | Factory watched for `CommunityDeployed` (dev defaults to local Anvil) |
| `AQUARIUS_GOVERNANCE_ADDRESS` / `GOVERNANCE_MODULE_ADDRESS` | Governance module watched for proposal/vote events (dev defaults to local Anvil) |
| `INDEXER_DISABLED` | Set to `true` to skip starting the watcher on API boot |

## Legal Generation & Blue AI

Paid AI features use **Grok (xAI) as the primary provider** when `XAI_API_KEY` is set. Anthropic Claude is an optional fallback. Legal generation defaults to `grok-4` for long-form charters; Blue uses a faster Grok model for short replies.

**Session required:** `POST /api/legal/generate`, `POST /api/legal/summarize`, `POST /api/legal/pin`, and `POST /api/blue/chat` all require a valid Aquarius wallet session (`Authorization: Bearer …`). `GET /api/legal/templates` stays public. `GET /api/blue/status` only returns `{ available: boolean }` (does not advertise which provider keys are set).

These paid AI routes are also rate-limited in-process per IP + session address (stricter for legal generate than Blue chat).

Templates:

- Draft Original.
- U.S. Constitution inspired.
- Magna Carta inspired.
- Blackfeet Tribal Constitution inspired.

Generated docs are displayed in the mobile Legal Doc Viewer. See **IPFS Pinning** below for optional CID return; the on-chain community already has a charter hash field for the next client write.

## IPFS Pinning

Without pinning, generated charters exist only in the API response and on the client. A process restart or a lost device drops the only copy, and there is no content-addressed hash to store on-chain.

When `IPFS_API_URL` is set, `POST /api/legal/generate` pins the markdown after a successful generation and returns `{ cid, uri }`. `POST /api/legal/pin` pins already-generated markdown (50k-character bound, same class as summarize). Both require a wallet session.

- Local Kubo: `IPFS_API_URL=http://127.0.0.1:5001` (POST `/api/v0/add?pin=true`)
- Hosted pinning: set `IPFS_API_URL` to the HTTP pin endpoint and `IPFS_PINNING_TOKEN` for Bearer auth
- Optional `IPFS_GATEWAY_URL` builds an HTTPS gateway `uri`; otherwise `uri` is `ipfs://<cid>`

If pinning is unset or the pin HTTP call fails, generate still succeeds with `cid: null` and a warning. Document bodies are never logged.

**Next client step:** write the returned CID to the community `charterIpfsHash` field on-chain. This API slice does not submit that transaction.

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
- API persistence: auth sessions/challenges are durable in Postgres when `DATABASE_URL` is set; agents still use the JSON bridge store (Drizzle schema is ready).
- A stub on-chain event indexer exists at `GET /api/indexer/communities` and `GET /api/indexer/health` (catch-up + `watchContractEvent`, Postgres when `DATABASE_URL` is set). The mobile/web apps still read the chain directly; remaining work is wiring clients to this API.
- Agent runtime is not autonomous yet.
- WalletConnect v2 is wired into mobile `getWalletClient()` for SIWE and contract writes. Coinbase Wallet SDK, hardware wallets, and ERC-4337 onboarding are still later.
- ERC-1271 smart-wallet SIWE verification is supported when `AQUARIUS_RPC_URL` or `RPC_URL` is set; undeployed/counterfactual accounts are still follow-ups.
- ERC-4337 account abstraction is planned for production onboarding and agents.
- Generated legal documents can be pinned to IPFS (`cid`/`uri` on generate, `POST /api/legal/pin`). Clients still need to write the CID to the on-chain charter hash field.
- Community API CRUD route is still a placeholder facade.
