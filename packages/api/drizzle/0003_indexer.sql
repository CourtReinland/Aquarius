CREATE TABLE IF NOT EXISTS indexer_cursors (
  id text PRIMARY KEY,
  last_block integer NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS indexed_communities (
  address varchar(42) PRIMARY KEY,
  name text NOT NULL,
  founders jsonb NOT NULL,
  deployed_at_block integer NOT NULL,
  deployed_at_timestamp integer,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS indexed_communities_deployed_at_block_idx
  ON indexed_communities (deployed_at_block);

CREATE TABLE IF NOT EXISTS indexed_events (
  id text PRIMARY KEY,
  event_name text NOT NULL,
  contract_address varchar(42) NOT NULL,
  community_address varchar(42),
  block_number integer NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  args jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS indexed_events_block_number_idx
  ON indexed_events (block_number);

CREATE INDEX IF NOT EXISTS indexed_events_event_name_idx
  ON indexed_events (event_name);

CREATE INDEX IF NOT EXISTS indexed_events_community_address_idx
  ON indexed_events (community_address);
