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

# 3. Start Metro
cd ../../apps/mobile
npx expo start --dev-client --port 8081

# 4. Build and install on a connected Android device (USB debugging on)
npx expo run:android

# 5. Forward Metro + Anvil + API over USB so the phone can reach the Mac's localhost
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8545 tcp:8545
adb reverse tcp:3001 tcp:3001
```

`adb reverse` mappings can drop over long sessions, especially when the phone sleeps. Re-run the three reverse commands if blockchain reads, Metro, or API calls stop working.

## Current Features

- Local dev wallet generation/import.
- SIWE-style wallet login against the Aquarius API.
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
├── config/             # Chain config, contract addresses, ABIs
├── context/            # BlockchainContext (provides clients, factory address)
├── types/              # TypeScript domain types
├── utils/              # showAlert helper (cross-platform), etc.
└── navigation/         # Stack + bottom tab navigator
```

Native config tweaks live in `apps/mobile/app.json` and `apps/mobile/android/`.
