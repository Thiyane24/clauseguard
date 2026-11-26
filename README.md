# ClauseGuard

**Privacy-First Hybrid AI Legal Contract Auditor** built for `#BuildHybridAI 2026`.

ClauseGuard helps tenants, freelancers, founders, and SME legal/procurement teams audit high-stakes contracts (tenancy agreements, NDAs, employment letters, and vendor SOWs) without leaking personally identifiable information (PII) to external cloud servers. Sensitive identifiers are deterministically masked **in the browser before any AI inference**, routine clause risk auditing runs **on-device via Gemini Nano (`PREFER_ON_DEVICE`)** when available, and **cloud Gemini models** handle redline counter-clause drafting and photographed document OCR on redacted text only.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Key Features](#key-features)
4. [System Architecture](#system-architecture)
5. [Repository Structure](#repository-structure)
6. [Data Model & Security](#data-model--security)
7. [API Reference](#api-reference)
8. [Getting Started](#getting-started)
9. [Testing & Verification](#testing--verification)
10. [Deployment Guide](#deployment-guide)
11. [Future Enhancements](#future-enhancements)

---

## The Problem

1. **PII & Confidentiality Leakage:** Standard AI contract tools upload raw PDFs or pasted agreements directly to third-party cloud APIs—exposing Malaysian MyKad numbers (`XXXXXX-XX-XXXX`), passport numbers, bank account numbers, phone numbers, email addresses, SSM company registration IDs, and residential addresses.
2. **Prohibitive Cloud Inference Costs:** Sending every single clause of a 30-page contract to large cloud LLMs drives up token costs and latency, even when 70%+ of clauses are routine boilerplate.
3. **Connectivity & Offline Friction:** Legal reviewers frequently inspect tenancy or vendor contracts on the go, in basements, or in restricted corporate networks where uninterrupted cloud access is unreliable.
4. **Actionability Gap:** Traditional contract analyzers highlight problems without giving users balanced, jurisdiction-aware redline counter-clauses they can actually send back in negotiations.

---

## The Solution

ClauseGuard applies a **Split-Compute Hybrid AI** architecture backed by a **Zero-Leakage Privacy Invariant**:

1. **Client-Side PII Shield First:** Before any clause touches local or cloud AI, deterministic regex redactors strip MyKad ICs, passports, credit/debit cards, bank account numbers, phone numbers, emails, SSM/registration IDs, and street addresses in the browser—and re-verify scrubbing server-side as defense-in-depth.
2. **On-Device First via Firebase AI Logic:** Clause risk classification, plain-English summaries, and red-flag extraction run via `getGenerativeModel(..., { mode: InferenceMode.PREFER_ON_DEVICE })` with single-turn `generateContent()` and strict JSON schema output. When Chrome Built-in AI (`window.LanguageModel` / Gemini Nano) is available, clauses run locally at **$0 marginal API cost** and work even offline.
3. **Graceful Cloud Escalation:** When a browser lacks Gemini Nano or when the user explicitly requests a formal redline counter-clause or physical page photo scan, requests pass **only redacted text** over authenticated routes to server-side Gemini models.
4. **Negotiation-Ready Output:** Users get side-by-side **Original vs. Recommended Fair Clause** redlines tailored to their chosen jurisdiction (`Malaysia`, `Singapore`, `United Kingdom`, `United States`, or `General`), plus downloadable Markdown and SVG/printable audit exhibits.

---

## Key Features

- **Document Workbench & Dual Preview:** Paste contract text, load the built-in Malaysian Tenancy sample, extract PDF text locally in-browser via `pdfjs-dist`, or toggle between **Raw Input** and **Redacted Preview** with a live per-category PII breakdown (`MyKad`, `Passport`, `Phone`, `Email`, `Bank Acct`, `Card`, `Reg ID`, `Address`).
- **Physical Contract Photo Scanner:** Capture or upload PNG/JPEG/WebP photos of printed contract pages (`PhotoScannerModal`) for structured clause transcription with immediate PII masking.
- **Live Telemetry Header:** Real-time visibility into Gemini Nano status (`Available`, `Downloadable` with progress trigger via `LanguageModel.create()`, `Unavailable`, `Unsupported`), **Online/Offline** network status, **On-Device vs. Cloud** inference split, PII items scrubbed, and estimated cloud cost savings.
- **Clause Risk Cards & Counter-Clause Redlining:** Severity badges (`HIGH`, `MEDIUM`, `LOW`), explicit provenance pills (`ON_DEVICE` vs. `IN_CLOUD`), latency tracking, red-flag bullets, and one-click server-assisted **Draft Counter-Clause** generation.
- **Corporate Auth & Cloud Persistence:** Split-screen `AuthGate` supporting **Google Sign-In**, **Email & Password** (with verification workflow), and **Guest Reviewer** (anonymous session), persisting redacted audits in **Firebase Firestore**.
- **Audit Export:** Export structured Markdown legal review reports and printable/SVG risk summary exhibits (`ExportModal`).

---

## System Architecture

### Split-Compute Flow

```text
+-----------------------------------------------------------------------------------+
|                        Browser Client (React 19 + Vite + TS)                      |
|                                                                                   |
|  [PDF via pdfjs-dist] / [Paste Text] / [Photo Upload]                             |
|           |                                                                       |
|           v                                                                       |
|  [Deterministic PII Redactor (src/lib/piiRedactor.ts)]                            |
|     Masks MyKad, Passport, Bank Acct, Card, Phone, Email, Reg ID, Address         |
|           |                                                                       |
|           v                                                                       |
|  [Clause Splitter (src/lib/clauseSplitter.ts)] -> Numbered Clause Cards           |
|           |                                                                       |
|           +---> [Firebase AI Logic: InferenceMode.PREFER_ON_DEVICE]               |
|           |        |-- Chrome Built-in Gemini Nano (window.LanguageModel)         |
|           |        |   -> ON_DEVICE provenance, $0 cost, offline-ready            |
|           |        |-- Fallback: inCloudParams / /api/v1/audit-clause             |
|           |                                                                       |
|           +---> [Saved Audits & Profiles (Firestore SDK + Security Rules)]        |
+-----------------------------------------------------------------------------------+
                                     |
                     HTTPS + Firebase ID Token (Bearer)
                     (Redacted text / base64 image only)
                                     v
+-----------------------------------------------------------------------------------+
|               Backend API (Node/Express server.ts  OR  Python FastAPI)            |
|                                                                                   |
|  - Firebase ID Token RSA verification + email_verified / anonymous checks         |
|  - Strict host-matched CORS + security headers                                    |
|  - Defense-in-depth server PII scrubbing (scrubPiiServer / redactor.py)           |
|                                                                                   |
|  Routes:                                                                          |
|   * GET  /health                                                                  |
|   * POST /api/v1/audit-clause            -> Gemini cloud clause audit fallback    |
|   * POST /api/v1/counter-clause          -> Balanced counter-clause drafting      |
|   * POST /api/v1/analyze-contract-image  -> Photo OCR + PII redaction             |
+-----------------------------------------------------------------------------------+
```

### Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion |
| **On-Device & Hybrid AI** | Firebase SDK (`firebase/ai`, `InferenceMode.PREFER_ON_DEVICE`), Chrome `window.LanguageModel` (Gemini Nano) |
| **Client Document Parsing** | `pdfjs-dist` (local PDF text extraction without server upload) |
| **Primary App Server** | Node.js + Express (`server.ts`) + `@google/genai` (`gemini-4-hydrogen`) |
| **Parallel Python Microservice** | Python 3.12, FastAPI, Pydantic v2, `firebase-admin`, `google-genai`, `pytest` (`backend/`) |
| **Auth & Persistence** | Firebase Authentication (Google, Email/Password, Anonymous) + Cloud Firestore |

---

## Repository Structure

```text
.
├── server.ts                         # Express + Vite full-stack server (port 3000) & Gemini API proxy
├── index.html                        # App HTML entry point & OpenGraph metadata
├── package.json                      # Scripts (dev, start, build, lint) & Node dependencies
├── metadata.json                     # App metadata & server-side Gemini capability declaration
├── firebase-applet-config.json       # Firebase web app & Firestore database configuration
├── firebase-blueprint.json           # Canonical Firestore entity schemas & collection layout
├── firestore.rules                   # Owner-scoped, verified-user Firestore security rules
├── eslint.config.js                  # Security-rules ESLint configuration
├── security_spec.md                  # Threat model, invariants, and security verification spec
├── walkthrough.md                    # Security audit & PoC verification notes
├── .env.example                      # Root server environment template (no secrets)
├── src/
│   ├── App.tsx                       # Main ClauseGuard workspace & audit orchestration
│   ├── index.css                     # Executive Legal-Tech Tailwind v4 theme & typography
│   ├── components/
│   │   ├── AuthGate.tsx              # Split-screen corporate Sign In / Sign Up / Guest access
│   │   ├── TopBar.tsx                # Workspace navigation, user account menu, email verification
│   │   ├── TelemetryHeader.tsx       # Nano availability/download, network status, split & cost meter
│   │   ├── ContractInputPanel.tsx    # Document workbench, PDF upload, raw vs. redacted preview
│   │   ├── ClauseCard.tsx            # Risk badge, provenance pill, red flags, counter-clause diff
│   │   ├── PhotoScannerModal.tsx     # Physical contract image upload & OCR transcription modal
│   │   ├── ExportModal.tsx           # Markdown report & SVG/printable exhibit exporter
│   │   ├── SavedAuditsPanel.tsx      # Firestore saved audit history viewer & loader
│   │   └── ErrorBoundary.tsx         # React fault-isolation boundary
│   └── lib/
│       ├── firebase.ts               # Firebase Auth & Firestore client initialization
│       ├── firestoreAudits.ts        # Firestore CRUD + unverified-email sessionStorage fallback
│       ├── hybridAi.ts               # PREFER_ON_DEVICE model, Nano checks, & API client
│       ├── piiRedactor.ts            # Deterministic client-side PII masking & breakdown counter
│       ├── clauseSplitter.ts         # Numbered section parser for legal agreements
│       ├── pdfExtractor.ts           # Local browser-only PDF text extractor via pdfjs-dist
│       ├── sampleContract.ts         # Built-in Malaysian tenancy agreement test fixture
│       └── types.ts                  # Shared TypeScript domain interfaces
└── backend/                          # Standalone Python 3.12 FastAPI backend repository
    ├── Dockerfile                    # Container image definition for FastAPI service
    ├── requirements.txt              # FastAPI, Pydantic, firebase-admin, google-genai, pytest
    ├── .env.example                  # FastAPI environment template
    ├── app/
    │   ├── config.py                 # Pydantic Settings configuration
    │   ├── main.py                   # FastAPI app (/health, /api/v1/counter-clause)
    │   ├── redactor.py               # Server-side deterministic PII scrubber
    │   ├── security.py               # Firebase Auth & App Check verification dependency
    │   ├── gemini_cloud.py           # Structured JSON counter-clause generator via google-genai
    │   └── schemas.py                # Pydantic v2 request/response models
    └── tests/
        ├── test_redactor.py          # Deterministic PII masking unit tests
        └── test_api.py               # FastAPI security & endpoint integration tests
```

---

## Data Model & Security

### Firestore Collections (`firebase-blueprint.json`)

- **`/users/{userId}` (`UserProfile`)**: Owner-only profile storing `uid`, `displayName`, optional `email`, `createdAt`, and `updatedAt`.
- **`/audits/{auditId}` (`ContractAudit`)**: Audit session metadata (`userId`, `title`, `jurisdiction`, clause risk counts, `piiItemsRemoved`, `onDeviceCount`, `inCloudCount`, timestamps).
- **`/audits/{auditId}/clauses/{clauseId}` (`AuditedClause`)**: Strictly **redacted** clause text (`redactedText`), `riskLevel`, `plainEnglishSummary`, `redFlags`, `inferenceSource`, `legalConcern`, and `suggestedCounterClause`.

### Security & Privacy Controls

- **Unredacted Text Never Leaves the Browser:** `auditClauseHybrid()` and `requestCounterClause()` both re-run `redactPII()` immediately before serialization, and `server.ts` / `backend/app/main.py` scrub inputs and outputs a second time.
- **Verified Authentication & Access Control:**
  - `server.ts` verifies Firebase ID tokens via Google's cached x509 certificates (`aud`, `iss`, `sub`, `exp`, `iat`) and enforces `email_verified` (or anonymous guest session) in production.
  - `firestore.rules` restricts reads and writes strictly to `request.auth.uid == userId` (or `resource.data.userId`), prevents immutable field tampering (`createdAt`, `userId`), and validates field sizes/enums.
  - Unverified email/password accounts automatically fall back to local `sessionStorage` until email verification is completed.
- **No Hardcoded Secrets:** `GEMINI_API_KEY` is never committed to `.env` or source files; it is injected at runtime via environment secrets.

---

## API Reference

All `POST` endpoints require `Authorization: Bearer <firebase-id-token>` (with `ENV=development` allowing local testing where configured).

| Method & Path | Purpose | Server |
| :--- | :--- | :--- |
| `GET /health` | Service health and runtime mode check | `server.ts` & `backend/app/main.py` |
| `POST /api/v1/audit-clause` | Cloud fallback for structured clause risk audit when on-device inference is unavailable | `server.ts` |
| `POST /api/v1/counter-clause` | Generates a balanced, jurisdiction-aware redline counter-clause from redacted text | `server.ts` & `backend/app/main.py` |
| `POST /api/v1/analyze-contract-image` | Extracts and immediately masks clauses from photographed contract pages (PNG/JPEG/WebP, <5.5MB) | `server.ts` |

---

## Getting Started

### Prerequisites

- **Node.js 20+** (or Bun) and **npm**
- **Google Chrome** with Built-in AI flags enabled (optional, for local Gemini Nano `ON_DEVICE` testing; otherwise the app gracefully uses cloud fallback)
- **Gemini API Key** configured in your environment secrets (`GEMINI_API_KEY`)
- **Python 3.12+** (optional, if running the standalone `backend/` FastAPI service)

### 1. Configure Environment Variables

Root `.env.example` (non-secret defaults can be placed in `.env`, while `GEMINI_API_KEY` should be set in your secret manager / AI Studio **Settings > Secrets**):

```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"
PORT=3000
NODE_ENV="development"
ENV="development"
GEMINI_CLOUD_MODEL="gemini-4-hydrogen"
FIREBASE_PROJECT_ID="fifth-core-q4cnq"
FIRESTORE_DATABASE_ID="ai-studio-08f7a945-2d04-41c5-9050-766e990ad306"
CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
```

### 2. Install & Run Full-Stack App (Port 3000)

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### 3. Production Build & Start

```bash
npm run build
npm run start
```

### 4. Standalone Python FastAPI Backend (Optional)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Testing & Verification

- **TypeScript Check:**
  ```bash
  npm run lint
  ```
- **Production Bundle Check:**
  ```bash
  npm run build
  ```
- **Firestore Security Rules Lint:**
  ```bash
  npx eslint firestore.rules
  ```
- **Python Backend Unit & API Tests:**
  ```bash
  cd backend
  pytest
  ```

---

## Deployment Guide

### Deploying to GitHub

- `.gitignore` excludes `node_modules/`, `dist/`, `.env*` (preserving `.env.example`), and logs.
- Never commit `.env` or API keys to your repository; configure `GEMINI_API_KEY` and production Firebase/App Check settings in your hosting environment.

### Enabling Email Verification & Auth Providers

1. Open the **Firebase Console** for project `fifth-core-q4cnq` -> **Authentication -> Sign-in method**.
2. Ensure **Email/Password**, **Google**, and **Anonymous** providers are enabled.
3. Add your production Cloud Run / custom domain to **Authentication -> Settings -> Authorized domains** so Google sign-in popups and verification links resolve properly.

---

## Future Enhancements

1. **DOCX Tracked-Changes Redline Export:** Export accepted counter-clauses directly into `.docx` documents with Word-compatible `<w:ins>` / `<w:del>` tracked revisions so legal counterparties can review changes natively.
2. **Offline Encrypted Queue & Sync:** Persist in-progress offline Gemini Nano audits in encrypted browser storage (`IndexedDB` + WebCrypto) and automatically sync redacted summaries to Firestore once connectivity returns.
3. **Custom Corporate Playbooks & Risk Rubrics:** Allow procurement and legal teams to define organization-specific red-flag policies (e.g., maximum liability caps, governing law requirements, notice periods) applied during on-device and cloud audits.
4. **Cross-Clause Consistency & Multi-Language Support:** Detect contradictions across separate sections (e.g., Term vs. Termination Notice) and add native bilingual **Bahasa Melayu / English** clause normalization for Malaysian tenancy and statutory contracts.
5. **Client-Side NER Enhancement:** Supplement deterministic regex PII masking with a lightweight local WebAssembly/ONNX Named-Entity Recognition (NER) pass to mask free-form personal names and bespoke entity references before cloud escalation.
6. **Production Firebase App Check Enforcement:** Enforce strict reCAPTCHA Enterprise / App Check attestation tokens across all `server.ts` and FastAPI endpoints alongside `ENV=production`.
