import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  Schema,
} from 'firebase/ai';
import { auth, firebaseApp, getAppCheckHeader } from './firebase';
import { redactPII } from './piiRedactor';
import type {
  AuditInferenceSource,
  CounterClauseResult,
  Jurisdiction,
  NanoAvailability,
  RiskLevel,
} from './types';

export const clauseAuditSchema = Schema.object({
  properties: {
    clauseTitle: Schema.string(),
    riskLevel: Schema.enumString({ enum: ['LOW', 'MEDIUM', 'HIGH'] }),
    plainEnglishSummary: Schema.string(),
    redFlags: Schema.array({ items: Schema.string() }),
  },
});

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const hybridClauseModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: {
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: clauseAuditSchema,
    },
  },
});

export interface ClauseAuditResponse {
  clauseTitle: string;
  riskLevel: RiskLevel;
  plainEnglishSummary: string;
  redFlags: string[];
  inferenceSource: AuditInferenceSource;
  latencyMs: number;
}

interface ChromeLanguageModelMonitor {
  addEventListener: (
    eventType: 'downloadprogress',
    listener: (e: { loaded: number }) => void,
  ) => void;
}

interface ChromeLanguageModelSession {
  prompt: (
    input: string,
    options?: { responseConstraint?: Record<string, unknown> },
  ) => Promise<string>;
  clone?: () => Promise<ChromeLanguageModelSession>;
  destroy: () => void;
}

interface ChromeLanguageModelApi {
  availability: (options?: {
    expectedInputs?: Array<{ type: 'text'; languages: string[] }>;
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
  }) => Promise<string>;
  create: (options?: {
    expectedInputs?: Array<{ type: 'text'; languages: string[] }>;
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
    monitor?: (m: ChromeLanguageModelMonitor) => void;
  }) => Promise<ChromeLanguageModelSession>;
}

const NANO_LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

const NANO_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    clauseTitle: { type: 'string' },
    riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    plainEnglishSummary: { type: 'string' },
    redFlags: { type: 'array', items: { type: 'string' } },
  },
  required: ['clauseTitle', 'riskLevel', 'plainEnglishSummary', 'redFlags'],
};

// Clauses up to this length run locally on Gemini Nano ($0.00); denser clauses offload to Cloud Flash
const ON_DEVICE_MAX_CHARS = 220;
const ON_DEVICE_TIMEOUT_MS = 12_000;
const MAX_ON_DEVICE_CLAUSES_PER_AUDIT = 3;

let baseNanoSession: ChromeLanguageModelSession | null = null;
let nanoQueue: Promise<unknown> = Promise.resolve();
let localClausesDispatched = 0;

export function resetLocalAuditBudget(): void {
  localClausesDispatched = 0;
}

function getChromeLanguageModel(): ChromeLanguageModelApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { LanguageModel?: ChromeLanguageModelApi }).LanguageModel;
}

async function getNanoSession(): Promise<ChromeLanguageModelSession> {
  const lm = getChromeLanguageModel();
  if (!lm) {
    throw new Error('Chrome LanguageModel unavailable');
  }
  if (!baseNanoSession) {
    baseNanoSession = await lm.create(NANO_LANGUAGE_OPTIONS);
  }
  return baseNanoSession;
}

function runOnDeviceSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = nanoQueue.then(task, task);
  nanoQueue = next.catch(() => {});
  return next;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('On-device inference timeout')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function checkNanoAvailability(): Promise<NanoAvailability> {
  try {
    const lm = getChromeLanguageModel();
    if (!lm) {
      return 'unsupported';
    }
    const status = await lm.availability(NANO_LANGUAGE_OPTIONS);
    if (
      status === 'available' ||
      status === 'downloadable' ||
      status === 'downloading' ||
      status === 'unavailable'
    ) {
      return status;
    }
    return 'unavailable';
  } catch {
    return 'unsupported';
  }
}

export async function downloadNanoModel(
  onProgress: (progressRatio: number) => void,
): Promise<NanoAvailability> {
  const lm = getChromeLanguageModel();
  if (!lm) {
    throw new Error('Chrome Built-in AI (window.LanguageModel) is not supported in this browser.');
  }

  const session = await lm.create({
    ...NANO_LANGUAGE_OPTIONS,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        onProgress(e.loaded);
      });
    },
  });
  if (baseNanoSession) {
    baseNanoSession.destroy();
  }
  baseNanoSession = session;
  return checkNanoAvailability();
}

function normalizeAuditJson(
  parsed: Partial<{
    clauseTitle: string;
    riskLevel: string;
    plainEnglishSummary: string;
    redFlags: unknown[];
  }>,
  fallbackTitle: string,
): Omit<ClauseAuditResponse, 'inferenceSource' | 'latencyMs'> {
  const riskRaw = String(parsed.riskLevel ?? 'MEDIUM').toUpperCase();
  const riskLevel: RiskLevel =
    riskRaw === 'HIGH' || riskRaw === 'LOW' || riskRaw === 'MEDIUM' ? riskRaw : 'MEDIUM';

  const redFlags = Array.isArray(parsed.redFlags)
    ? parsed.redFlags
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
        .slice(0, 8)
    : [];

  return {
    clauseTitle:
      typeof parsed.clauseTitle === 'string' && parsed.clauseTitle.trim().length > 0
        ? parsed.clauseTitle.trim()
        : fallbackTitle,
    riskLevel,
    plainEnglishSummary:
      typeof parsed.plainEnglishSummary === 'string' && parsed.plainEnglishSummary.trim().length > 0
        ? parsed.plainEnglishSummary.trim()
        : 'Reviewed clause obligations and potential consumer/tenant exposure.',
    redFlags,
  };
}

function parseJsonResponse(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const appCheckHeaders = await getAppCheckHeader();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...appCheckHeaders,
  };
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      // Proceed without token in development mode when user is signed out
    }
  }
  return headers;
}

async function auditClauseOnDevice(params: {
  fallbackTitle: string;
  safeClauseText: string;
  jurisdiction: Jurisdiction;
}): Promise<Omit<ClauseAuditResponse, 'latencyMs'>> {
  const compactPrompt = [
    `Audit this ${params.jurisdiction} contract clause. Reply with compact JSON only:`,
    `{"clauseTitle":"2-4 word title","riskLevel":"LOW|MEDIUM|HIGH","plainEnglishSummary":"1 concise sentence explaining the risk or obligation","redFlags":["up to 2 short risk phrases, or empty if LOW"]}`,
    `Clause:\n${params.safeClauseText}`,
  ].join('\n');

  const rawJson = await withTimeout(
    runOnDeviceSerialized(async () => {
      const base = await getNanoSession();
      const session = base.clone ? await base.clone() : base;
      try {
        try {
          return await session.prompt(compactPrompt, {
            responseConstraint: NANO_JSON_SCHEMA,
          });
        } catch {
          return await session.prompt(compactPrompt);
        }
      } finally {
        if (session !== base) {
          session.destroy();
        }
      }
    }),
    ON_DEVICE_TIMEOUT_MS,
  );

  const parsed = parseJsonResponse(rawJson);
  if (
    typeof parsed.plainEnglishSummary !== 'string' ||
    parsed.plainEnglishSummary.trim().length < 12
  ) {
    throw new Error('On-device model returned incomplete summary; escalating to cloud');
  }

  const normalized = normalizeAuditJson(parsed, params.fallbackTitle);
  return {
    ...normalized,
    inferenceSource: 'ON_DEVICE',
  };
}

export async function auditClauseHybrid(params: {
  clauseId: string;
  fallbackTitle: string;
  redactedText: string;
  jurisdiction: Jurisdiction;
}): Promise<ClauseAuditResponse> {
  const start = performance.now();
  const safeClauseText = redactPII(params.redactedText).redactedText;

  // Complexity-aware routing: run up to 3 routine/short clauses locally on Gemini Nano ($0.00)
  // and offload long or excess clauses in parallel to Cloud Gemini Flash with a 12s timeout guard.
  const nanoStatus = await checkNanoAvailability();
  if (
    nanoStatus === 'available' &&
    safeClauseText.length <= ON_DEVICE_MAX_CHARS &&
    localClausesDispatched < MAX_ON_DEVICE_CLAUSES_PER_AUDIT
  ) {
    localClausesDispatched += 1;
    try {
      const localResult = await auditClauseOnDevice({
        fallbackTitle: params.fallbackTitle,
        safeClauseText,
        jurisdiction: params.jurisdiction,
      });
      return {
        ...localResult,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch {
      // Fall through to cloud model if local inference times out or returns incomplete JSON
    }
  }

  const prompt = [
    `You are ClauseGuard, a strict legal contract risk auditor for ${params.jurisdiction} law.`,
    'Analyze the following REDACTED contract clause and output JSON matching the schema.',
    'Identify unfair penalties, unilateral termination/eviction, waived statutory rights, hidden indemnities, or excessive lock-ins.',
    'If the clause is balanced and standard, mark riskLevel as LOW and keep redFlags empty.',
    `Clause text:\n${safeClauseText}`,
  ].join('\n\n');

  try {
    // Single-turn generateContent() only (startChat is unsupported on-device)
    const result = await hybridClauseModel.generateContent(prompt);
    const rawJson = result.response.text();
    const parsed = parseJsonResponse(rawJson);
    const normalized = normalizeAuditJson(parsed, params.fallbackTitle);
    const source: AuditInferenceSource =
      result.response.inferenceSource === InferenceSource.ON_DEVICE
        ? 'ON_DEVICE'
        : 'IN_CLOUD';

    return {
      ...normalized,
      inferenceSource: source,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (hybridErr) {
    // Fallback to ClauseGuard server-side Gemini endpoint when client Firebase AI Logic API is unavailable
    const headers = await getAuthHeaders();
    const res = await fetch('/api/v1/audit-clause', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clause_id: params.clauseId,
        redacted_text: safeClauseText,
        jurisdiction: params.jurisdiction,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg =
        (errBody as { detail?: string; error?: string }).detail ||
        (errBody as { error?: string }).error ||
        (hybridErr instanceof Error ? hybridErr.message : 'Clause audit failed');
      throw new Error(msg);
    }

    const data = (await res.json()) as {
      clauseTitle: string;
      riskLevel: RiskLevel;
      plainEnglishSummary: string;
      redFlags: string[];
    };
    const normalized = normalizeAuditJson(data, params.fallbackTitle);
    return {
      ...normalized,
      inferenceSource: 'IN_CLOUD',
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

const inFlightCounterRequests = new Map<string, Promise<CounterClauseResult>>();

export async function requestCounterClause(params: {
  clauseId: string;
  redactedText: string;
  jurisdiction: Jurisdiction;
}): Promise<CounterClauseResult> {
  const existing = inFlightCounterRequests.get(params.clauseId);
  if (existing) {
    return existing;
  }

  const requestPromise = (async () => {
    const headers = await getAuthHeaders();
    // Privacy invariant: re-run redactPII so unredacted text can never leave the client
    const safeClauseText = redactPII(params.redactedText).redactedText;
    const res = await fetch('/api/v1/counter-clause', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clause_id: params.clauseId,
        raw_text: safeClauseText,
        jurisdiction: params.jurisdiction,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg =
        (errBody as { detail?: string; error?: string }).detail ||
        (errBody as { error?: string }).error ||
        `Counter-clause request failed (${res.status})`;
      throw new Error(msg);
    }

    return (await res.json()) as CounterClauseResult;
  })();

  inFlightCounterRequests.set(params.clauseId, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightCounterRequests.delete(params.clauseId);
  }
}