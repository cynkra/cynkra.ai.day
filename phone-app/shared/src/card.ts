import type { SchemaVersion } from './schema-version.js';

export const CONTENT_TYPES = ['text', 'formula', 'code'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const ENRICHMENT_MODES = ['manual', 'external', 'llm'] as const;
export type EnrichmentMode = (typeof ENRICHMENT_MODES)[number];

export const CARD_STATUSES = ['draft', 'enriching', 'ready', 'failed'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const SRS_STATES = ['new', 'learning', 'review', 'relearning'] as const;
export type SrsState = (typeof SRS_STATES)[number];

export const REVIEW_GRADES = ['Again', 'Hard', 'Good', 'Easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

export interface Card {
  id: string;
  owner_id: string;
  deck_id: string;
  source_text: string;
  source_url: string | null;
  content_type: ContentType;
  enrichment_mode: EnrichmentMode;
  translation: string | null;
  explanation: string | null;
  status: CardStatus;
  last_error: string | null;
  stability: number | null;
  difficulty: number | null;
  srs_state: SrsState;
  step: number;
  last_reviewed_at: string | null;
  next_due_at: string | null;
  schema_version: SchemaVersion;
  created_at: string;
  updated_at: string;
}

export interface CreateCardInput {
  id: string;
  deck_id?: string;
  source_text: string;
  source_url?: string | null;
  content_type: ContentType;
  enrichment_mode?: EnrichmentMode;
  translation?: string | null;
  explanation?: string | null;
  status?: Extract<CardStatus, 'draft' | 'enriching' | 'ready'>;
  schema_version: SchemaVersion;
}

export interface UpdateCardInput {
  deck_id?: string;
  source_text?: string;
  source_url?: string | null;
  translation?: string | null;
  explanation?: string | null;
  enrichment_mode?: EnrichmentMode;
  status?: CardStatus;
  schema_version: SchemaVersion;
  updated_at: string;
}
