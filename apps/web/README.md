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

## `prototypes/`

Standalone HTML mockups produced during early UI exploration:

- `v0.1.html` — first attempt at the home + create-community flow
- `v0.2-onchain.html` — added live wallet connect + chain reads
- `v0.3.html` — refined layout
- `dashboard.html` — community dashboard ("My Memberships") concept

These are reference material, not the production web app.
