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

# 2. Start Metro
cd ../../apps/mobile
npx expo start --dev-client --port 8081

# 3. Build and install on a connected Android device (USB debugging on)
npx expo run:android

# 4. Forward Metro + Anvil over USB so the phone can reach the Mac's localhost
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8545 tcp:8545
```

Both `adb reverse` mappings are flaky over long sessions (they drop when the phone screen
sleeps). The repo includes `scripts/aq-reverse-watchdog.sh` (TODO: move from `/tmp`) which
re-asserts both ports every few seconds.

## Layout

```
apps/mobile/src/
├── screens/            # 12 screens matching the original SVG mockups
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

`apps/mobile/android/` and `apps/mobile/ios/` are git-ignored and regenerated on demand by
`expo prebuild`. Native config tweaks live in `apps/mobile/app.json`.
