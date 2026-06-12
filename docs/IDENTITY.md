# Aquarius Identity and Login

Aquarius does not use usernames and passwords as the root of identity. A user proves control of a wallet, and the blockchain defines what that wallet can see or do in each community.

The short version:

```text
wallet signature proves identity
contracts define authority
local Passport groups the user's own wallets
API sessions are temporary convenience tokens
```

## Model

```mermaid
flowchart LR
  Wallet["Wallet or smart account"] --> Proof["Signed SIWE-style message"]
  Proof --> Session["Short-lived API session"]
  Wallet --> Chain["Community contracts"]
  Chain --> Rights["Memberships, rights, shares, obligations"]
  Session --> API["Convenience API"]
  Local["Local Aquarius Passport"] --> Wallet
```

The important split:

- **Identity:** wallet, smart account, or linked wallet set.
- **Authority:** contracts, token balances, shares, proposal state, and obligations.
- **Experience:** local app state, API cache, indexers, notifications, and search.

The app and API can make the product fast and pleasant, but they should not become the source of truth for community authority.

## Code Touchpoints

| Area | File |
|---|---|
| API auth routes | `packages/api/src/routes/auth.ts` |
| Mobile auth hook | `apps/mobile/src/hooks/useWalletAuth.ts` |
| Local Passport store | `apps/mobile/src/hooks/useWalletStore.ts` |
| Wallet connect UI | `apps/mobile/src/components/WalletConnect.tsx` |
| Agent auth enforcement | `packages/api/src/routes/agents.ts` |

## Implemented Flow

1. The user creates or imports a local dev wallet.
2. The app requests `POST /api/auth/challenge`.
3. The API returns a Sign-In with Ethereum style message with a one-time nonce and a five-minute expiration.
4. The wallet signs the message locally.
5. The app sends the signature to `POST /api/auth/verify`.
6. The API verifies the signature with `viem.verifyMessage`.
7. The API deletes the nonce so the challenge cannot be reused.
8. The API returns a 12-hour session token.
9. The app stores that session and linked wallet in a local Aquarius Passport.

The private key never goes to the API.

## Challenge Details

The challenge route accepts:

| Field | Purpose |
|---|---|
| `address` | Wallet address that will sign the message |
| `chainId` | Chain context for the signature |
| `domain` | Human-readable app domain, currently `Aquarius` |
| `uri` | App URI, currently `https://aquariusapp.eth` |
| `statement` | Sign-in statement shown inside the message |
| `resources` | Resource hints, currently defaults to `aquarius://identity` |

The API stores challenges in memory by nonce. Verification fails if the challenge is missing, expired, reused, mismatched, or signed by the wrong address.

## Session Token

The current session token is an HMAC-signed payload:

- Payload contains `sessionId`, wallet `address`, `chainId`, `issuedAt`, and `expiresAt`.
- Signature uses `AQUARIUS_AUTH_SECRET` when set.
- If `AQUARIUS_AUTH_SECRET` is not set, the API uses a process-local random secret, so sessions are invalidated when the API restarts.
- The server also keeps a session map in memory so logout can revoke a token before expiration.

This token does not grant blockchain authority. It only lets the API know, for a short window, that the caller recently proved control of a wallet.

## Local Aquarius Passport

The mobile app persists Passport state in AsyncStorage under `aquarius-wallet-passport`.

Persisted today:

- Current API session.
- Linked wallet list.
- Wallet address.
- Chain ID.
- Wallet label.
- `addedAt` and `lastSignedInAt` timestamps.

The Passport is intentionally local-first. It lets one human group multiple wallets on one device without publishing a public wallet-link graph. In production, users should be able to opt into public wallet-link attestations only when that helps them.

## Protected API Actions

Agent creation uses the wallet session to avoid spoofing the creator.

When `POST /api/agents/create` includes `creatorAddress`, the request must include:

```text
Authorization: Bearer <session token>
```

The API rejects the request unless the session wallet matches `creatorAddress`. This means a client cannot claim that another community member created or authorized an agent without signing in as that wallet first.

## API

Create a challenge:

```bash
curl -X POST http://localhost:3001/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x0000000000000000000000000000000000000001",
    "chainId": 31337,
    "domain": "Aquarius",
    "uri": "https://aquariusapp.eth"
  }'
```

Verify a signature:

```bash
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "...challenge message...",
    "signature": "0x..."
  }'
```

Check a session:

```bash
curl http://localhost:3001/api/auth/session \
  -H "Authorization: Bearer $AQUARIUS_SESSION_TOKEN"
```

## Multi-Community Context

A single wallet may hold:

- Memberships across many communities.
- Community tokens.
- Institution shares.
- Proposal voting rights.
- Credit receiving agreements.
- Credit remitting obligations.
- Agent-management rights.

Aquarius reads this from contracts and event history. The local Passport only helps the user group multiple wallets together on their device.

## Multiple Wallets

One human may reasonably control several addresses:

- Main personal wallet.
- Hardware wallet.
- Community-specific wallet.
- Treasury multisig.
- Agent-admin wallet.
- Future ERC-4337 smart account.

The first implementation stores linked wallets locally. A future public linking mode should use signed wallet-link attestations so users can choose when to reveal that multiple addresses belong together.

## Production Path

1. Add WalletConnect/Coinbase Wallet so users sign with external self-custody wallets.
2. Support ERC-1271 verification for smart contract wallets.
3. Add ERC-4337 smart accounts for passkeys, gas sponsorship, and recovery.
4. Store only public profile metadata off-chain; keep rights and obligations contract-defined.
5. Make indexers replaceable by reconstructing state from contract events.
6. Add optional encrypted backup for local Passport metadata, never raw private keys.
