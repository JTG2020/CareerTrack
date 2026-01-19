
export enum EntryType {
  ACHIEVEMENT = 'achievement',
  CHALLENGE = 'challenge',
  LEARNING = 'learning'
}

export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  previous_value?: string;
  new_value?: string;
}

export interface CareerEntry {
  entry_id: string;
  thought_signature: string;
  timestamp: string;
  raw_input: string;
  category: EntryType;
  skills: string[];
  impact_summary: string;
  confidence_score: ConfidenceLevel;
  evidence_links: string[];
  refinement_state: 'pending' | 'refined';
  clarification_question?: string;
  reflection_question?: string;
  user_clarification_response?: string;
  audit_log: AuditLogEntry[];
}

export interface AppraisalSummary {
  executiveSummary: string;
  keyAchievements: string[];
  skillsAndGrowth: string;
  areasForDevelopment: string[];
  gapAnalysis: string;
}

export interface ProcessingState {
  isProcessing: boolean;
  status: string;
}
