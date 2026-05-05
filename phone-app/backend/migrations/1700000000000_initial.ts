import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createExtension('citext', { ifNotExists: true });

  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'citext', unique: true },
    display_name: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createType('auth_provider', ['apple', 'google', 'passkey', 'magic_link']);

  pgm.createTable('auth_methods', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    provider: { type: 'auth_provider', notNull: true },
    provider_subject: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('auth_methods', 'auth_methods_provider_subject_unique', {
    unique: ['provider', 'provider_subject'],
  });
  pgm.createIndex('auth_methods', 'user_id');

  pgm.createTable('passkey_credentials', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    credential_id: { type: 'bytea', notNull: true, unique: true },
    public_key: { type: 'bytea', notNull: true },
    counter: { type: 'bigint', notNull: true, default: 0 },
    transports: { type: 'text[]' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    last_used_at: { type: 'timestamptz' },
  });
  pgm.createIndex('passkey_credentials', 'user_id');

  pgm.createTable('magic_link_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    token_hash: { type: 'bytea', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    consumed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('magic_link_tokens', 'user_id');

  pgm.createType('enrichment_mode', ['manual', 'external', 'llm']);
  pgm.createType('content_type', ['text', 'formula', 'code']);
  pgm.createType('card_status', ['draft', 'enriching', 'ready', 'failed']);
  pgm.createType('srs_state', ['new', 'learning', 'review', 'relearning']);

  pgm.createTable('decks', {
    id: { type: 'uuid', primaryKey: true },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    topic: { type: 'text' },
    target_language: { type: 'text' },
    explanation_style: { type: 'text' },
    default_enrichment_mode: {
      type: 'enrichment_mode',
      notNull: true,
      default: 'llm',
    },
    schema_version: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('decks', ['owner_id', 'topic']);

  pgm.createTable('cards', {
    id: { type: 'uuid', primaryKey: true },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    deck_id: {
      type: 'uuid',
      notNull: true,
      references: '"decks"(id)',
      onDelete: 'RESTRICT',
    },
    source_text: { type: 'text', notNull: true },
    source_url: { type: 'text' },
    content_type: { type: 'content_type', notNull: true },
    enrichment_mode: { type: 'enrichment_mode', notNull: true, default: 'llm' },
    translation: { type: 'text' },
    explanation: { type: 'text' },
    status: { type: 'card_status', notNull: true, default: 'draft' },
    last_error: { type: 'text' },
    stability: { type: 'double precision' },
    difficulty: { type: 'double precision' },
    srs_state: { type: 'srs_state', notNull: true, default: 'new' },
    step: { type: 'integer', notNull: true, default: 0 },
    last_reviewed_at: { type: 'timestamptz' },
    next_due_at: { type: 'timestamptz' },
    schema_version: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('cards', ['owner_id', 'updated_at']);
  pgm.createIndex('cards', ['owner_id', 'deck_id']);
  pgm.createIndex('cards', ['owner_id', 'next_due_at']);

  pgm.createTable('llm_usage', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    purpose: { type: 'text', notNull: true },
    input_tokens: { type: 'integer', notNull: true, default: 0 },
    output_tokens: { type: 'integer', notNull: true, default: 0 },
    occurred_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('llm_usage', ['user_id', 'occurred_at']);

  pgm.createTable('external_usage', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    provider: { type: 'text', notNull: true },
    purpose: { type: 'text', notNull: true },
    occurred_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('external_usage', ['user_id', 'occurred_at']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('external_usage');
  pgm.dropTable('llm_usage');
  pgm.dropTable('cards');
  pgm.dropTable('decks');
  pgm.dropType('srs_state');
  pgm.dropType('card_status');
  pgm.dropType('content_type');
  pgm.dropType('enrichment_mode');
  pgm.dropTable('magic_link_tokens');
  pgm.dropTable('passkey_credentials');
  pgm.dropTable('auth_methods');
  pgm.dropType('auth_provider');
  pgm.dropTable('users');
}
