# Setup Guide

## Prerequisites

### Required

- **Node.js 20+** — `node --version`
- **pnpm** — `npm install -g pnpm`
- **Foundry** — `curl -L https://foundry.paradigm.xyz | bash && foundryup`

### Optional

- **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` (for future backend services)
- **Anthropic API Key** — For AI legal document generation

## Installation

```bash
git clone https://github.com/CourtReinland/Aquarius.git
cd Aquarius
pnpm install
```

## Running Smart Contract Tests

```bash
cd packages/contracts
forge test           # All 62 tests
forge test -v        # Verbose
forge test --summary # Table summary
```

Expected output:
```
| AllianceModuleTest       | 7  | 0 | 0 |
| CommunityFactoryTest     | 8  | 0 | 0 |
| E2E_CincinnatiSkateville | 1  | 0 | 0 |
| GovernanceModuleTest     | 18 | 0 | 0 |
| InstitutionRegistryTest  | 14 | 0 | 0 |
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

# Set your Anthropic API key (required for legal generation)
export ANTHROPIC_API_KEY=sk-ant-...

# Start dev server
pnpm dev
```

API runs at `http://localhost:3001`. Endpoints:

- `GET /health` — Health check
- `GET /api/legal/templates` — List charter templates
- `POST /api/legal/generate` — Generate charter from parameters
- `POST /api/legal/summarize` — Summarize existing charter

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
ANTHROPIC_API_KEY=sk-ant-...     # Required for legal doc generation
PORT=3001                         # API port (default 3001)

# Contracts (for deployment)
PRIVATE_KEY=0x...                 # Deployer wallet private key
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

## Type Checking

```bash
cd apps/mobile
npx tsc --noEmit    # Should output nothing (zero errors)
```

## Project Structure Conventions

- Smart contracts: `packages/contracts/src/`
- Contract tests: `packages/contracts/test/`
- Mobile screens: `apps/mobile/src/screens/`
- Blockchain hooks: `apps/mobile/src/hooks/`
- API routes: `packages/api/src/routes/`
- API services: `packages/api/src/services/`
- Documentation: `docs/`
