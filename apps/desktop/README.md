# Aquarius Desktop (`@aquarius/desktop`)

Native desktop wrapper around `@aquarius/web`.

> **Status:** placeholder. The desktop client is planned for after the web app stabilises.

## Plan

- **Toolchain:** [Tauri 2](https://tauri.app/) — small binary, native menus, system-tray support, Rust-backed
- **Targets, in order:** macOS (universal arm64+x86_64) → Windows (x86_64) → Linux (deb/AppImage) if there's demand
- **What it adds over the browser:** persistent background daemon for blockchain event indexing, system notifications for governance events (vote opens, role elections, alliance invites), local IPFS pinning for community charters, deep-link handling (`aquarius://community/0x…`)

## Why not Electron?

Tauri produces ~10 MB binaries vs. Electron's ~150 MB, and the Aquarius use case (a thin shell
around a web bundle plus a small Rust event indexer) is exactly what Tauri is built for. We
already use Rust for the heavier backend services (`packages/services/`), so the toolchain
overlap is welcome.

## Folder layout (planned)

```
apps/desktop/
├── src-tauri/        # Rust side: indexer, IPFS, deep-links, notifications
├── src/              # Front-end shell that loads @aquarius/web
└── tauri.conf.json
```

Until the web app is feature-complete, this directory intentionally stays empty.
