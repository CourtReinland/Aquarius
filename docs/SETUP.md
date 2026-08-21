# Setup Guide

## Prerequisites

### Required

- **Node.js 20+** — `node --version`
- **pnpm** — `npm install -g pnpm`
- **Foundry** — `curl -L https://foundry.paradigm.xyz | bash && foundryup`

### Optional

- **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` (for future backend services)
- **xAI API Key** — Primary AI provider (Grok) for legal generation and Blue chat
- **Anthropic API Key** — Optional fallback if Grok is unset or a Grok call fails

## Installation

```bash
git clone https://github.com/CourtReinland/Aquarius.git
cd Aquarius
pnpm install
```

## Running Smart Contract Tests

```bash
cd packages/contracts
forge test           # All 81 tests
forge test -v        # Verbose
forge test --summary # Table summary
```

Expected output:
```
| AIAgentRegistryTest      | 10 | 0 | 0 |
| AllianceModuleTest       | 7  | 0 | 0 |
| CommunityFactoryTest     | 8  | 0 | 0 |
| E2E_CincinnatiSkateville | 1  | 0 | 0 |
| GovernanceModuleTest     | 18 | 0 | 0 |
| InstitutionRegistryTest  | 14 | 0 | 0 |
| SmartProposalTest        | 9  | 0 | 0 |
| TokenModuleTest          | 14 | 0 | 0 |
```

## Running the Mobile App

### Web Preview

```bash
cd apps/mobile
npx expo start --web
```

Opens at `http://localhost:8081`. Use Chrome DevTools device emulation for mobile view.

### Android

```bash
cd apps/mobile
npx expo start --android
```

Requires Android Studio with an emulator or a physical device with Expo Go.

### iOS

```bash
cd apps/mobile
npx expo start --ios
```

Requires Xcode (macOS only).

## Running the API Server

```bash
cd packages/api

# Set your xAI key (primary for legal generation + Blue). Anthropic is optional fallback.
export XAI_API_KEY=xai-...
# export ANTHROPIC_API_KEY=sk-ant-...

# Start dev server
pnpm dev
```

API runs at `http://localhost:3001`. Endpoints:

- `GET /health` — Health check
- `POST /api/auth/challenge` — Create wallet login challenge
- `POST /api/auth/verify` — Verify wallet signature and issue session
- `GET /api/auth/session` — Validate bearer session token
- `POST /api/auth/logout` — Revoke bearer session token
- `POST /api/agents/create` — Create AI-agent wallet/card/config
- `GET /api/agents` — List agents you created (auth; Postgres when `DATABASE_URL` is set)
- `GET /api/agents/:agentId/card` — Public agent card
- `GET /api/legal/templates` — List charter templates (public)
- `POST /api/legal/generate` — Generate charter from parameters (**wallet session required**)
- `POST /api/legal/summarize` — Summarize existing charter (**wallet session required**)
- `POST /api/blue/chat` — Ask Blue (**wallet session required**)
- `GET /api/blue/status` — `{ available: boolean }` only
- `GET /api/communities` — Placeholder community list
- `POST /api/communities` — Placeholder community creation facade

## Deploying Smart Contracts

### Local (Anvil)

```bash
# Terminal 1: Start local chain
cd packages/contracts
anvil

# Terminal 2: Deploy
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Base Sepolia (Testnet)

1. Get testnet ETH from the [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Export your private key
3. Deploy:

```bash
cd packages/contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --private-key $YOUR_PRIVATE_KEY
```

4. Copy the printed contract addresses into `apps/mobile/src/config/chains.ts`

### Base Mainnet (Production)

Same as above but with `--rpc-url https://mainnet.base.org`. Ensure contracts have been audited first.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# API
XAI_API_KEY=xai-...               # Primary (Grok) for legal docs + Blue
# ANTHROPIC_API_KEY=sk-ant-...    # Optional Anthropic fallback
# LEGAL_GROK_MODEL=grok-4         # Long-form legal default (not the tiny fast model)
PORT=3001                         # API port (default 3001)
AQUARIUS_AUTH_SECRET=...          # Stable HMAC secret for auth sessions
AGENT_KEY_ENCRYPTION_SECRET=...   # Encrypt generated agent keys in API storage
AQUARIUS_OPERATOR_PRIVATE_KEY=0x... # Optional API-side agent registration/funding
AQUARIUS_RPC_URL=http://127.0.0.1:8545

# Contracts (for deployment)
PRIVATE_KEY=0x...                 # Deployer wallet private key
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

## Type Checking

```bash
pnpm --filter @aquarius/mobile exec tsc --noEmit
pnpm --filter @aquarius/api build
```

## Project Structure Conventions

- Smart contracts: `packages/contracts/src/`
- Contract tests: `packages/contracts/test/`
- Mobile screens: `apps/mobile/src/screens/`
- Blockchain hooks: `apps/mobile/src/hooks/`
- API routes: `packages/api/src/routes/`
- API services: `packages/api/src/services/`
- Documentation: `docs/`
