export type Jurisdiction =
  | 'Malaysia'
  | 'Singapore'
  | 'United Kingdom'
  | 'United States'
  | 'General';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type AuditInferenceSource = 'ON_DEVICE' | 'IN_CLOUD';

export type NanoAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unsupported';

export interface RedactionSummary {
  mykad: number;
  passport: number;
  phone: number;
  email: number;
  bankAccount: number;
  card: number;
  regId: number;
  address: number;
}

export interface RedactionResult {
  redactedText: string;
  piiItemsRemoved: number;
  breakdown: RedactionSummary;
}

export interface ParsedClause {
  clauseId: string;
  clauseNumber: string;
  rawTitle: string;
  rawText: string;
  redactedText: string;
  piiItemsRemoved: number;
  redactionBreakdown: RedactionSummary;
}

export interface CounterClauseResult {
  clause_id: string;
  redacted_text: string;
  pii_items_removed: number;
  risk_level: RiskLevel;
  legal_concern: string;
  suggested_counter_clause: string;
  inference_source: 'CLOUD_GEMINI';
}

export interface ClauseAuditItem extends ParsedClause {
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  clauseTitle: string;
  riskLevel: RiskLevel;
  plainEnglishSummary: string;
  redFlags: string[];
  inferenceSource: AuditInferenceSource;
  latencyMs?: number;
  errorMessage?: string;
  counterClause?: CounterClauseResult;
  counterClauseLoading?: boolean;
  counterClauseError?: string;
}

export interface SavedAuditSummary {
  id: string;
  userId: string;
  title: string;
  jurisdiction: Jurisdiction;
  totalClauses: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  piiItemsRemoved: number;
  onDeviceCount: number;
  inCloudCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}
