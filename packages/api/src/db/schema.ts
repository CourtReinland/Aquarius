import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  agentId: text('agent_id').primaryKey(),
  communityAddress: varchar('community_address', { length: 42 }).notNull(),
  communityName: text('community_name'),
  creatorAddress: varchar('creator_address', { length: 42 }),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  metadataUri: text('metadata_uri').notNull(),
  keyStorage: text('key_storage').notNull(),
  walletPolicy: jsonb('wallet_policy').notNull(),
  promptHash: text('prompt_hash').notNull(),
  memoryPolicy: jsonb('memory_policy').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const agentPassports = pgTable('agent_passports', {
  agentId: text('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  schemaVersion: text('schema_version').notNull(),
  passport: jsonb('passport').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const agentRuntimeConfigs = pgTable('agent_runtime_configs', {
  agentId: text('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  promptTemplate: text('prompt_template').notNull(),
  encryptedPrivateKey: jsonb('encrypted_private_key'),
  runtimeConfig: jsonb('runtime_config').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const agentCapabilities = pgTable('agent_capabilities', {
  agentId: text('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  permissionClass: text('permission_class').notNull(),
  capabilities: jsonb('capabilities').notNull(),
  permissionPolicyUri: text('permission_policy_uri'),
  permissionPolicyHash: text('permission_policy_hash'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const agentLineage = pgTable('agent_lineage', {
  agentId: text('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  originMode: text('origin_mode').notNull(),
  parentAgentId: text('parent_agent_id'),
  templateId: text('template_id'),
  lineageHash: text('lineage_hash'),
});

export const agentEconomics = pgTable('agent_economics', {
  agentId: text('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  hireable: boolean('hireable').notNull().default(false),
  cloneable: boolean('cloneable').notNull().default(false),
  license: text('license'),
  feeRecipient: varchar('fee_recipient', { length: 42 }),
  hirePrice: text('hire_price'),
  clonePrice: text('clone_price'),
  revenueSplitBps: integer('revenue_split_bps'),
  feeMode: text('fee_mode').notNull().default('off-chain'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const agentEvents = pgTable('agent_events', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  actorAddress: varchar('actor_address', { length: 42 }),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const agentSigningRequests = pgTable('agent_signing_requests', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  targetAddress: varchar('target_address', { length: 42 }),
  valueEth: text('value_eth').notNull(),
  risk: text('risk').notNull(),
  status: text('status').notNull(),
  humanApprovalRequired: boolean('human_approval_required').notNull().default(true),
  approvedBy: varchar('approved_by', { length: 42 }),
  transactionHash: text('transaction_hash'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const agentMemoryRecords = pgTable('agent_memory_records', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  visibility: text('visibility').notNull(),
  summary: text('summary').notNull(),
  sourceEventId: text('source_event_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const agentContractWatchers = pgTable('agent_contract_watchers', {
  agentId: text('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  status: text('status').notNull().default('reserved'),
  lastTransactionHash: text('last_transaction_hash'),
  lastEventName: text('last_event_name'),
  lastBlockNumber: integer('last_block_number'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
