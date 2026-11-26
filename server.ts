import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_DEV = process.env.NODE_ENV !== 'production';
const ENV_MODE = process.env.ENV || (IS_DEV ? 'development' : 'production');
const GEMINI_CLOUD_MODEL = process.env.GEMINI_CLOUD_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODELS = [
  ...new Set([
    GEMINI_CLOUD_MODEL,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.8-flash',
  ]),
];

async function generateWithFallback(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
) {
  let lastError: unknown;
  let sleptOn429 = false;
  for (const model of FALLBACK_MODELS) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (err: unknown) {
      lastError = err;
      const msg = String((err as { message?: string })?.message || err);
      if (msg.includes('429') && !sleptOn429) {
        sleptOn429 = true;
        await new Promise((r) => setTimeout(r, 200));
      }
      // Any API error (503, 404, 429, 400, etc.) → try next model
      continue;
    }
  }
  throw lastError;
}

let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'fifth-core-q4cnq';
try {
  const cfgRaw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
  const cfg = JSON.parse(cfgRaw) as { projectId?: string };
  if (!process.env.FIREBASE_PROJECT_ID && cfg.projectId) firebaseProjectId = cfg.projectId;
} catch {
  // Fallback to default project ID if config file is absent
}

const ALLOWED_JURISDICTIONS = new Set([
  'Malaysia',
  'Singapore',
  'United Kingdom',
  'United States',
  'General',
]);

const SAFE_CLAUSE_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_BASE64_RE = /^[A-Za-z0-9+/=\r\n]+$/;

// Server-side deterministic PII scrubber (mirrors src/lib/piiRedactor.ts & backend/app/redactor.py)
function scrubPiiServer(input: string): { redactedText: string; piiItemsRemoved: number } {
  let count = 0;
  let text = input;

  const replaceAndCount = (pattern: RegExp, replacement: string) => {
    text = text.replace(pattern, () => {
      count += 1;
      return replacement;
    });
  };

  replaceAndCount(/\b\d{6}-\d{2}-\d{4}\b/g, '[MYKAD_REDACTED]');
  replaceAndCount(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL_REDACTED]');
  replaceAndCount(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD_REDACTED]');

  text = text.replace(
    /\b((?:(?:Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|UOB|OCBC|HSBC|Bank)\s+)?(?:Account|Acct|A\/C|Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|UOB|OCBC|HSBC|Bank)\s*(?:No\.?|Number|#)?\s*:?\s*)(\d[\d\s-]{8,18}\d)\b/gi,
    (_m, prefix: string) => {
      count += 1;
      return `${prefix}[BANK_ACCT_REDACTED]`;
    },
  );

  text = text.replace(
    /\b(?:Passport(?:\s*(?:No\.?|Number|#))?\s*:?\s*)([A-Z]{1,2}\d{7,8})\b/gi,
    (full) => {
      count += 1;
      return full.replace(/[A-Z]{1,2}\d{7,8}/i, '[PASSPORT_REDACTED]');
    },
  );

  replaceAndCount(/\b[AHK]\d{7,8}\b/g, '[PASSPORT_REDACTED]');
  replaceAndCount(/\b(?:\d{6}-[A-Z]|20\d{10})\b/g, '[REG_ID_REDACTED]');
  replaceAndCount(
    /(?:\+?6?01[0-9][-\s]?\d{3,4}[-\s]?\d{4}|\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{3,4}[-\s]?\d{3,4}|(?:\b0[3-9])[-\s]?\d{7,8}\b)/g,
    '[PHONE_REDACTED]',
  );

  return { redactedText: text, piiItemsRemoved: count };
}

// Cached Google public x509 certificates for verifying Firebase ID tokens without IAM
let cachedCerts: Record<string, string> = {};
let certsExpiry = 0;

async function fetchFirebaseCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpiry && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  );
  if (!resp.ok) {
    throw new Error('Unable to fetch Firebase verification certificates.');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await resp.json()) as Record<string, string>;
  certsExpiry = Date.now() + maxAgeSec * 1000;
  return cachedCerts;
}

async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed bearer token.');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token algorithm or key ID.');
  }
  if (payload.aud !== firebaseProjectId) {
    throw new Error('Token audience mismatch.');
  }
  if (payload.iss !== `https://securetoken.google.com/${firebaseProjectId}`) {
    throw new Error('Token issuer mismatch.');
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.sub || !payload.exp || payload.exp <= nowSec) {
    throw new Error('Token expired or missing subject.');
  }
  if (typeof payload.iat === 'number' && payload.iat > nowSec + 300) {
    throw new Error('Token issued-at time is invalid.');
  }
  if (payload.email && payload.email_verified !== true) {
    throw new Error('Email address must be verified.');
  }

  const certs = await fetchFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Unknown token signing key.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const signatureValid = verifier.verify(cert, Buffer.from(sigB64, 'base64url'));
  if (!signatureValid) {
    throw new Error('Invalid token signature.');
  }

  return { uid: payload.sub, email: payload.email };
}

async function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization') || '';
  const appCheckHeader = req.header('x-firebase-appcheck');

  if (ENV_MODE !== 'development' && !appCheckHeader) {
    res.status(401).json({ detail: 'Missing X-Firebase-AppCheck header.' });
    return;
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      await verifyFirebaseIdToken(token);
      next();
      return;
    } catch (err) {
      res.status(401).json({
        detail: err instanceof Error ? err.message : 'Invalid Firebase Auth token.',
      });
      return;
    }
  }

  if (ENV_MODE === 'development') {
    next();
    return;
  }

  res.status(401).json({ detail: 'Missing Firebase Auth Bearer token.' });
}

function isAllowedOrigin(originHeader: string | undefined, requestHost: string | undefined): boolean {
  if (!originHeader || !requestHost) return false;
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.host === requestHost) return true;
    if (
      ENV_MODE === 'development' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeRiskLevel(raw: unknown): 'LOW' | 'MEDIUM' | 'HIGH' {
  const upper = String(raw ?? 'MEDIUM').toUpperCase();
  if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') return upper;
  return 'MEDIUM';
}

let cachedGenAiClient: GoogleGenAI | null = null;
let cachedGenAiApiKey: string | null = null;

function getGenAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your key in Settings > Secrets to run cloud Gemini features.',
    );
  }
  if (!cachedGenAiClient || cachedGenAiApiKey !== apiKey) {
    cachedGenAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedGenAiApiKey = apiKey;
  }
  return cachedGenAiClient;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8mb' }));

  // Baseline security headers (iframe-compatible)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Strict origin-matched CORS (no substring matching, no wildcard)
  app.use((req, res, next) => {
    const origin = req.header('origin');
    const host = req.header('x-forwarded-host') || req.header('host');
    if (origin && isAllowedOrigin(origin, host)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'clauseguard-api',
      env: ENV_MODE,
      model: GEMINI_CLOUD_MODEL,
    });
  });

  app.post('/api/v1/audit-clause', securityMiddleware, async (req, res) => {
    try {
      const { clause_id, redacted_text, jurisdiction = 'Malaysia' } = req.body as {
        clause_id?: unknown;
        redacted_text?: unknown;
        jurisdiction?: unknown;
      };

      if (typeof clause_id !== 'string' || !SAFE_CLAUSE_ID_RE.test(clause_id)) {
        res.status(400).json({ detail: 'Invalid clause_id format.' });
        return;
      }
      if (typeof redacted_text !== 'string' || redacted_text.trim().length < 5 || redacted_text.length > 15000) {
        res.status(400).json({ detail: 'redacted_text must be between 5 and 15,000 characters.' });
        return;
      }
      const safeJurisdiction =
        typeof jurisdiction === 'string' && ALLOWED_JURISDICTIONS.has(jurisdiction)
          ? jurisdiction
          : 'Malaysia';

      const scrubbed = scrubPiiServer(redacted_text);
      const ai = getGenAiClient();

      const response = await generateWithFallback(ai, {
        contents: [
          `Analyze this redacted contract clause under ${safeJurisdiction} legal principles.`,
          `Clause ID: ${clause_id}`,
          `Redacted Clause Text:\n${scrubbed.redactedText}`,
        ].join('\n\n'),
        config: {
          systemInstruction:
            'You are ClauseGuard, an objective legal contract risk auditor. Assess risk accurately (LOW, MEDIUM, HIGH), provide a concise plain-English summary, and list concrete red flags if unfair or predatory.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clauseTitle: { type: Type.STRING },
              riskLevel: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
              plainEnglishSummary: { type: Type.STRING },
              redFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['clauseTitle', 'riskLevel', 'plainEnglishSummary', 'redFlags'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw) as {
        clauseTitle?: unknown;
        riskLevel?: unknown;
        plainEnglishSummary?: unknown;
        redFlags?: unknown;
      };

      const safeSummary = scrubPiiServer(String(parsed.plainEnglishSummary ?? '')).redactedText.slice(0, 2000);
      const safeTitle = scrubPiiServer(String(parsed.clauseTitle ?? 'Reviewed Clause')).redactedText.slice(0, 240);
      const safeFlags = Array.isArray(parsed.redFlags)
        ? parsed.redFlags
            .slice(0, 20)
            .map((f) => scrubPiiServer(String(f)).redactedText.slice(0, 500))
            .filter(Boolean)
        : [];

      res.json({
        clauseTitle: safeTitle || 'Reviewed Clause',
        riskLevel: normalizeRiskLevel(parsed.riskLevel),
        plainEnglishSummary: safeSummary || 'Reviewed clause obligations.',
        redFlags: safeFlags,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud clause audit failed.';
      res.status(502).json({ detail: message });
    }
  });

  app.post('/api/v1/counter-clause', securityMiddleware, async (req, res) => {
    try {
      const { clause_id, raw_text, jurisdiction = 'Malaysia' } = req.body as {
        clause_id?: unknown;
        raw_text?: unknown;
        jurisdiction?: unknown;
      };

      if (typeof clause_id !== 'string' || !SAFE_CLAUSE_ID_RE.test(clause_id)) {
        res.status(400).json({ detail: 'Invalid clause_id format.' });
        return;
      }
      if (typeof raw_text !== 'string' || raw_text.trim().length < 5 || raw_text.length > 15000) {
        res.status(400).json({ detail: 'raw_text must be between 5 and 15,000 characters.' });
        return;
      }
      const safeJurisdiction =
        typeof jurisdiction === 'string' && ALLOWED_JURISDICTIONS.has(jurisdiction)
          ? jurisdiction
          : 'Malaysia';

      const scrubbed = scrubPiiServer(raw_text);
      const ai = getGenAiClient();

      const response = await generateWithFallback(ai, {
        contents: [
          `Jurisdiction: ${safeJurisdiction}`,
          `Clause ID: ${clause_id}`,
          `Redacted Clause Text:\n${scrubbed.redactedText}`,
          'State the core legal concern in 1-2 sentences and draft a concise, balanced, enforceable counter-clause preserving legitimate commercial protections without predatory penalties or waived statutory rights.',
        ].join('\n\n'),
        config: {
          systemInstruction:
            'You are senior commercial and tenancy legal counsel. Return concise, direct legal redlines: a brief legal concern and a balanced, enforceable counter-clause. Preserve any [REDACTED] placeholders verbatim.',
          temperature: 0.2,
          maxOutputTokens: 650,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              risk_level: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
              legal_concern: { type: Type.STRING },
              suggested_counter_clause: { type: Type.STRING },
            },
            required: ['risk_level', 'legal_concern', 'suggested_counter_clause'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw) as {
        risk_level?: unknown;
        legal_concern?: unknown;
        suggested_counter_clause?: unknown;
      };

      const safeConcern = scrubPiiServer(
        String(
          parsed.legal_concern ??
            'Clause contains asymmetric obligations that warrant balanced negotiation.',
        ),
      ).redactedText.slice(0, 2000);

      const safeCounter = scrubPiiServer(
        String(parsed.suggested_counter_clause ?? scrubbed.redactedText),
      ).redactedText.slice(0, 12000);

      res.json({
        clause_id,
        redacted_text: scrubbed.redactedText,
        pii_items_removed: scrubbed.piiItemsRemoved,
        risk_level: normalizeRiskLevel(parsed.risk_level),
        legal_concern: safeConcern,
        suggested_counter_clause: safeCounter,
        inference_source: 'CLOUD_GEMINI',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Counter-clause generation failed.';
      res.status(502).json({ detail: message });
    }
  });

  app.post('/api/v1/analyze-contract-image', securityMiddleware, async (req, res) => {
    try {
      const { imageBase64, mimeType, jurisdiction = 'Malaysia' } = req.body as {
        imageBase64?: unknown;
        mimeType?: unknown;
        jurisdiction?: unknown;
      };

      if (
        typeof imageBase64 !== 'string' ||
        imageBase64.length < 32 ||
        imageBase64.length > 7_500_000 ||
        !VALID_BASE64_RE.test(imageBase64)
      ) {
        res.status(400).json({ detail: 'Valid base64 image data under 5.5MB is required.' });
        return;
      }
      const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
      if (typeof mimeType !== 'string' || !allowedMimes.has(mimeType)) {
        res.status(400).json({ detail: 'Supported image formats: PNG, JPEG, or WebP.' });
        return;
      }
      const safeJurisdiction =
        typeof jurisdiction === 'string' && ALLOWED_JURISDICTIONS.has(jurisdiction)
          ? jurisdiction
          : 'Malaysia';

      const ai = getGenAiClient();
      const response = await generateWithFallback(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: [
                `Inspect this photographed or scanned contract page under ${safeJurisdiction} law.`,
                'Transcribe the visible clauses cleanly in numbered format (e.g. "1. TITLE: ...") and immediately mask any personal identifiers (MyKad, passport, phone numbers, email addresses, bank account numbers) with [MYKAD_REDACTED], [PHONE_REDACTED], [EMAIL_REDACTED], or [BANK_ACCT_REDACTED].',
                'Also summarize the document title and key visual observations (e.g. missing signatures, handwritten edits, fine print).',
              ].join(' '),
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentTitle: { type: Type.STRING },
              visualObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              extractedText: { type: Type.STRING },
            },
            required: ['documentTitle', 'visualObservations', 'extractedText'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw) as {
        documentTitle?: unknown;
        visualObservations?: unknown;
        extractedText?: unknown;
      };

      const scrubbed = scrubPiiServer(String(parsed.extractedText ?? ''));
      const safeDocTitle = scrubPiiServer(
        String(parsed.documentTitle || 'Scanned Contract Page'),
      ).redactedText.slice(0, 200);
      const safeObservations = Array.isArray(parsed.visualObservations)
        ? parsed.visualObservations
            .slice(0, 20)
            .map((o) => scrubPiiServer(String(o)).redactedText.slice(0, 500))
            .filter(Boolean)
        : [];

      res.json({
        documentTitle: safeDocTitle,
        visualObservations: safeObservations,
        extractedText: scrubbed.redactedText,
        piiItemsRemoved: scrubbed.piiItemsRemoved,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Contract image analysis failed.';
      res.status(502).json({ detail: message });
    }
  });

  if (IS_DEV) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClauseGuard server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ClauseGuard server:', err);
  process.exit(1);
});