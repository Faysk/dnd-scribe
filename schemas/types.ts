export type SessionStatus =
  | 'planned'
  | 'recording'
  | 'uploaded'
  | 'processing'
  | 'ready_for_review'
  | 'reviewing'
  | 'approved'
  | 'published'
  | 'archived'
  | 'failed';

export type SegmentType =
  | 'dm_narration'
  | 'in_character'
  | 'player_action'
  | 'mechanics'
  | 'roll_result'
  | 'table_planning'
  | 'lore_discussion'
  | 'ooc_chatter'
  | 'joke'
  | 'break'
  | 'technical'
  | 'sensitive_private'
  | 'candidate_quote'
  | 'candidate_canon'
  | 'candidate_outtake';

export type CanonStatus =
  | 'candidate'
  | 'approved_canon'
  | 'rejected'
  | 'interpretation'
  | 'possible_hook'
  | 'retcon_pending'
  | 'private'
  | 'published';

export type Visibility =
  | 'private_master'
  | 'private_players'
  | 'review_only'
  | 'public_campaign'
  | 'public_web';

export interface TranscriptSegment {
  id: string;
  session_id: string;
  speaker_profile_id?: string | null;
  participant_id?: string | null;
  character_name?: string | null;
  source_file_id?: string | null;
  start_ms: number;
  end_ms: number;
  text: string;
  raw_confidence?: number | null;
}

export interface SegmentClassification {
  segment_id: string;
  segment_type: SegmentType;
  canon_relevance: 'none' | 'low' | 'medium' | 'high';
  confidence: number;
  needs_review: boolean;
  reason: string;
}

export interface CanonCandidate {
  id: string;
  session_id: string;
  title: string;
  claim: string;
  candidate_type: string;
  status: CanonStatus;
  confidence?: number | null;
  related_entity_ids?: string[];
  source_segment_ids?: string[];
  source_roll20_event_ids?: string[];
  reviewer_notes?: string | null;
}

export interface Roll20Event {
  id: string;
  session_id: string;
  event_type: string;
  roll20_who?: string | null;
  character_name?: string | null;
  approx_start_ms?: number | null;
  text?: string | null;
  payload?: Record<string, unknown>;
  raw_line?: string | null;
}
