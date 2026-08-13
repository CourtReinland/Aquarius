CREATE TABLE IF NOT EXISTS auth_challenges (
  nonce text PRIMARY KEY,
  address varchar(42) NOT NULL,
  chain_id integer NOT NULL,
  message text NOT NULL,
  issued_at timestamptz NOT NULL,
  expiration_time timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_challenges_expiration_time_idx
  ON auth_challenges (expiration_time);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  address varchar(42) NOT NULL,
  chain_id integer NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
  ON auth_sessions (expires_at);
