import type { Card } from './card.js';
import type { Deck } from './deck.js';

export type SyncEntity = 'card' | 'deck';

export interface SyncInvalidationEvent {
  entity: SyncEntity;
  id: string;
  updated_at: string;
}

export interface SyncResponse {
  cards: Card[];
  decks: Deck[];
  cursor: string;
}

export interface ProgressBuckets {
  new: number;
  learned: number;
  due: number;
}

export const ERROR_CODES = {
  unsupported_schema_version: 'unsupported_schema_version',
  external_mode_unsupported_for_content_type: 'external_mode_unsupported_for_content_type',
  daily_budget_exceeded: 'daily_budget_exceeded',
  generation_invalid_output: 'generation_invalid_output',
  deck_not_empty: 'deck_not_empty',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
