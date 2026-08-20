# Aquarius Mobile (`@aquarius/mobile`)

React Native + Expo SDK 54 app for Aquarius.

> **Status:** Android shipping (running on physical Pixel 3a). iOS planned after web app stabilises.

## Targets, in order

1. **Android** — primary target. Supports Pixel 3a forward; we're optimising for older / lower-cost devices on purpose so Aquarius runs on phones that real working-class users own.
2. **iOS** — built from the same RN codebase via `expo run:ios`. Will turn on once web app is feature-complete and the share-via-`react-native-web` story is in place.

The mobile app is a wrapper around the same UI primitives that `@aquarius/web` will host —
sharing screens via `react-native-web` keeps web/mobile/desktop in sync.

## Quick start (local dev)

```bash
# 1. Start a local chain and deploy contracts
anvil &
cd packages/contracts && forge script script/LocalTest.s.sol --broadcast --rpc-url http://127.0.0.1:8545

# 2. Start the API
pnpm --filter @aquarius/api dev

# 3. Start Metro (secure mode by default — personal local keys only)
cd ../../apps/mobile
npx expo start --dev-client --port 8081

# Optional: Anvil pre-funded shared-key signing (local only; labeled in UI)
EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1 npx expo start --dev-client --port 8081

# Optional: WalletConnect v2 (button hidden if unset)
EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id npx expo start --dev-client --port 8081

# 4. Build and install on a connected Android device (USB debugging on)
npx expo run:android

# 5. Forward Metro + Anvil + API over USB so the phone can reach the Mac's localhost
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8545 tcp:8545
adb reverse tcp:3001 tcp:3001
```

`adb reverse` mappings can drop over long sessions, especially when the phone sleeps. Re-run the three reverse commands if blockchain reads, Metro, or API calls stop working.

## Signing modes

| Mode | How to enable | What signs txs / SIWE |
|---|---|---|
| **Secure (default)** | No flag | User-generated or imported personal key via `getWalletClient()` |
| **WalletConnect v2** | `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` | External wallet session; `getWalletClient()` prefers WC when connected |
| **Dev Anvil** | `EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1` | Opt-in "Use Anvil Account #0" button; UI shows **DEV SIGNER ACTIVE** |

Rules:

- There is no silent default path that signs with the well-known Anvil key.
- All contract writes go through `src/wallet/signer.ts` → `getWalletClient()`.
- Private keys persist in `expo-secure-store` on native. Web preview falls back to AsyncStorage and is **insecure / preview-only**.
- Passport metadata (session, linked wallets) stays in AsyncStorage; the raw key never goes there and is never logged.
- SIWE challenge/verify uses the same WalletClient as transactions (address consistency).
- WalletConnect is skipped (button hidden) when `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` is unset, so a missing ID never crashes the app.

For local Anvil gas without the shared key, create a personal wallet and fund it from Anvil account #0 manually.

### WalletConnect v2

Create a project ID at [Reown Dashboard](https://dashboard.reown.com) and set `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`. The Home / wallet panel then shows **Connect WalletConnect** next to Create / Import.

**Android (primary path)**

1. Build a dev client or release APK (`npx expo run:android`) so the `aquarius://` return scheme is registered.
2. Start Metro with the project ID exported (values are inlined at bundle time).
3. Tap **Connect WalletConnect**. Approve the pairing URI in MetaMask, Rainbow, or another WC v2 wallet — either scan/paste the URI or tap **Open installed wallet**.
4. Approve the SIWE `personal_sign` in that same wallet. The connected address is used for login and later contract writes.
5. Disconnect from the same panel. Create / Import local wallet remains available.

**iOS caveats**

- Pairing via the displayed `wc:` URI still works (paste/scan in a wallet, including on another device).
- Returning to Aquarius after approve/sign is less reliable without extra Universal Links / associated domains. `LSApplicationQueriesSchemes` lists a few wallet schemes, but bounce-back was not the focus of this slice.
- Prefer a custom-scheme native build over Expo Go for return-to-app.

**Local Anvil**

Most external wallets cannot send transactions to a USB-forwarded Anvil (`31337`). Use Create / Import or the opt-in Anvil signer for local-chain writes. WalletConnect is for SIWE plus Base / Base Sepolia (or mainnet) writes when `defaultChain` points there.

## Current Features

- Local wallet create/import with SecureStore-backed key material.
- WalletConnect v2 external-wallet connector when `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` is set.
- Explicit opt-in Anvil/dev signer for local gas testing.
- SIWE-style wallet login against the Aquarius API (same wallet that signs txs).
- Local Aquarius Passport with signed session and linked wallets.
- Community explorer in 2D grid or 3D React Three Fiber scene.
- Found Community wizard.
- On-chain membership dashboard.
- AI-agent creation screen.
- Proposal tracker with create/vote flows.
- Banking setup UI.
- Bylaws, histories, alliance, role, and legal document screens.

## Android Release Build

```bash
cd apps/mobile/android
EXPO_PUBLIC_AQUARIUS_API_BASE_URL=http://127.0.0.1:3001 ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

This has been built and installed on a physical Pixel 3a.

## Layout

```
apps/mobile/src/
├── screens/            # 13 screens including Create AI Agent
├── components/
│   ├── explorer3d/     # 3D Community Explorer (React Three Fiber)
│   └── WalletConnect.tsx
├── hooks/              # Blockchain reads/writes via viem
├── wallet/             # SecureStore key storage + WalletConnect + getWalletClient() signer
├── config/             # Chain config, contract addresses, ABIs, env flags
├── context/            # BlockchainContext (provides clients, factory address)
├── types/              # TypeScript domain types
├── utils/              # showAlert helper (cross-platform), etc.
└── navigation/         # Stack + bottom tab navigator
```

Native config tweaks live in `apps/mobile/app.json` and `apps/mobile/android/`.
