CREATE TABLE IF NOT EXISTS agents (
  agent_id text PRIMARY KEY,
  community_address varchar(42) NOT NULL,
  community_name text,
  creator_address varchar(42),
  wallet_address varchar(42) NOT NULL,
  metadata_uri text NOT NULL,
  key_storage text NOT NULL,
  wallet_policy jsonb NOT NULL,
  prompt_hash text NOT NULL,
  memory_policy jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_passports (
  agent_id text PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  schema_version text NOT NULL,
  passport jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runtime_configs (
  agent_id text PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  prompt_template text NOT NULL,
  encrypted_private_key jsonb,
  runtime_config jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_capabilities (
  agent_id text PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  permission_class text NOT NULL,
  capabilities jsonb NOT NULL,
  permission_policy_uri text,
  permission_policy_hash text,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_lineage (
  agent_id text PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  origin_mode text NOT NULL,
  parent_agent_id text,
  template_id text,
  lineage_hash text
);

CREATE TABLE IF NOT EXISTS agent_economics (
  agent_id text PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  hireable boolean NOT NULL DEFAULT false,
  cloneable boolean NOT NULL DEFAULT false,
  license text,
  fee_recipient varchar(42),
  hire_price text,
  clone_price text,
  revenue_split_bps integer,
  fee_mode text NOT NULL DEFAULT 'off-chain',
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  type text NOT NULL,
  actor_address varchar(42),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_signing_requests (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  action text NOT NULL,
  target_address varchar(42),
  value_eth text NOT NULL,
  risk text NOT NULL,
  status text NOT NULL,
  human_approval_required boolean NOT NULL DEFAULT true,
  approved_by varchar(42),
  transaction_hash text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_memory_records (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  type text NOT NULL,
  visibility text NOT NULL,
  summary text NOT NULL,
  source_event_id text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_contract_watchers (
  agent_id text PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved',
  last_transaction_hash text,
  last_event_name text,
  last_block_number integer,
  updated_at timestamptz NOT NULL
);
