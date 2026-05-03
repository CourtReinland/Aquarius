# Aquarius Agent Persistence

Phase 2 introduces a durable Agent Foundry storage boundary.

## Current Runtime Store

The API now writes created agents to a JSON store so public passports and cards can survive route/app reinitialization during local development.

Default file:

```bash
packages/api/src/data/agents.json
```

Override with:

```bash
AGENT_STORE_FILE=/path/to/agents.json pnpm --filter @aquarius/api dev
```

This is a bridge store, not the final production database.

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

The schema separates public passport data from private runtime config:

- Public: `agent_passports.passport`
- Private: `agent_runtime_configs.prompt_template`, `encrypted_private_key`, `runtime_config`

## Migration Path

1. Run Postgres locally or in the deployed API environment.
2. Set `DATABASE_URL`.
3. Apply `packages/api/drizzle/0001_agent_persistence.sql`.
4. Replace the JSON bridge store with a Drizzle-backed implementation behind the same route boundary.

The HTTP API shape should not need to change when moving from the JSON bridge store to Postgres.
