import type { EnrichmentMode } from './card.js';
import type { SchemaVersion } from './schema-version.js';

export interface Deck {
  id: string;
  owner_id: string;
  name: string;
  topic: string | null;
  target_language: string | null;
  explanation_style: string | null;
  default_enrichment_mode: EnrichmentMode;
  schema_version: SchemaVersion;
  created_at: string;
  updated_at: string;
}

export interface CreateDeckInput {
  id: string;
  name: string;
  topic?: string | null;
  target_language?: string | null;
  explanation_style?: string | null;
  default_enrichment_mode?: EnrichmentMode;
  schema_version: SchemaVersion;
}

export interface UpdateDeckInput {
  name?: string;
  topic?: string | null;
  target_language?: string | null;
  explanation_style?: string | null;
  default_enrichment_mode?: EnrichmentMode;
  schema_version: SchemaVersion;
  updated_at: string;
}

export const UNTAGGED_GROUP = 'Untagged' as const;

export interface DeckGroup {
  topic: string;
  decks: Deck[];
}
