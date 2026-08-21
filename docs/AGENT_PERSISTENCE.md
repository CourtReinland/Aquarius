# Aquarius Agent Persistence

Phase 2 introduces a durable Agent Foundry storage boundary.

## Runtime Store

When `DATABASE_URL` is set, Agent Foundry reads and writes through Drizzle/Postgres (`packages/api/src/db/agent-store.ts`). Encrypted key material is stored as AES-256-GCM ciphertext and is never logged or returned on public routes.

When `DATABASE_URL` is unset, the API keeps the JSON/in-memory bridge so local/dev and tests still work.

Default JSON file:

```bash
packages/api/data/agents.json
```

Override with:

```bash
AGENT_STORE_FILE=/path/to/agents.json pnpm --filter @aquarius/api dev
```

## Production Database Shape

The Postgres/Drizzle schema lives in:

```bash
packages/api/src/db/schema.ts
packages/api/drizzle/0001_agent_persistence.sql
packages/api/drizzle.config.ts
```

Tables:

- `agents`
- `agent_passports`
- `agent_runtime_configs`
- `agent_capabilities`
- `agent_lineage`
- `agent_economics`
- `auth_challenges` (wallet login nonces; durable when `DATABASE_URL` is set)
- `auth_sessions` (HMAC session revocation/lookup; durable when `DATABASE_URL` is set)

The schema separates public passport data from private runtime config:

- Public: `agent_passports.passport`
- Private: `agent_runtime_configs.prompt_template`, `encrypted_private_key`, `runtime_config`

Auth sessions use the same `DATABASE_URL` / Drizzle client as Agent Foundry. When `DATABASE_URL` is unset, the API keeps the in-memory auth fallback and the JSON agent bridge so local vitest and secret-less dev still work.

Remaining key work is KMS, Lit Protocol, or ERC-4337 — encrypted-at-rest in Postgres is not KMS.

## Migration Path

1. Run Postgres locally or in the deployed API environment.
2. Set `DATABASE_URL`.
3. Apply `packages/api/drizzle/0001_agent_persistence.sql`, `packages/api/drizzle/0002_auth_sessions.sql`, and `packages/api/drizzle/0003_indexer.sql`.
4. Restart the API. Create/list/card use the Drizzle store automatically.

The HTTP API shape does not change between the JSON bridge and Postgres.
