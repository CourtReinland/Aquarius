# Aquarius Web (`@aquarius/web`)

The **fundamental web app** that mobile and desktop wrap.

## Why a single web foundation?

Aquarius's UI is the same on every platform: connect wallet → explore communities →
found a community → propose / vote / join institutions. Building one battle-tested web app
and wrapping it for mobile and desktop avoids three separate UI codebases drifting apart.

## Roadmap

| Stage | Status | What |
|---|---|---|
| **Static prototypes** | ✅ in `prototypes/` | Standalone HTML files that explored the UI ideas |
| **Production web app** | 🔨 planned | Next.js + viem/wagmi (shares the React Native screens via `react-native-web`) |
| **Mobile wrapper** | ✅ shipping | `@aquarius/mobile` — React Native + Expo (Android first, iOS next) |
| **Desktop wrapper** | 🔨 planned | `@aquarius/desktop` — Tauri (macOS first, Windows next) |

The current `apps/mobile/` is a React Native app; once the web app exists, large chunks of
the screen code will be shared via `react-native-web` so the UI stays in sync across all
three platforms.

## Multi-device test lab

All shared state lives on the host Mac (Anvil chain on :8545, API on :3001, vite on
:5173). Any device that can reach those ports is a full participant — found, join,
propose, vote, all against the same chain.

```bash
# 1. Chain — bind all interfaces so phones can reach it
anvil --host 0.0.0.0 --chain-id 31337
# (re-deploy contracts, or restore a snapshot via anvil_loadState)

# 2. API + web (vite.config.ts sets server.host = true)
pnpm --filter @aquarius/api dev
pnpm --filter @aquarius/web dev
```

| Device | How it connects |
|---|---|
| Mac | http://localhost:5173 |
| Any phone on the same Wi-Fi (iPhone etc.) | `http://<mac-LAN-ip>:5173` |
| Android via USB (no Wi-Fi needed) | `adb reverse tcp:5173 tcp:5173 && adb reverse tcp:8545 tcp:8545 && adb reverse tcp:3001 tcp:3001`, then open http://localhost:5173 in Chrome |

The app derives the RPC URL from `window.location.hostname`, so whichever host
served the page is also where it looks for the chain — no per-device config.

**Identities:** on local Anvil, "Choose Identity" offers ten named, pre-funded
test identities (Anvil accounts #0–#9). Each device should pick a different one
so votes come from distinct members.

## `prototypes/`

Standalone HTML mockups produced during early UI exploration:

- `v0.1.html` — first attempt at the home + create-community flow
- `v0.2-onchain.html` — added live wallet connect + chain reads
- `v0.3.html` — refined layout
- `dashboard.html` — community dashboard ("My Memberships") concept

These are reference material, not the production web app.
