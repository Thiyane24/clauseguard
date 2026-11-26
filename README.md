# ClauseGuard

**Zero-Leakage Hybrid AI Contract Intelligence** built for `#BuildHybridAI 2026`.

ClauseGuard helps freelancers, tenants, founders, and SME legal/procurement teams audit high-stakes contracts (tenancy agreements, software NDAs, employment letters, and vendor SOWs) without exposing personally identifiable information (PII) to external cloud servers. Sensitive identifiers are deterministically masked **in the browser before any AI inference**, routine clauses run **on-device via Chrome Built-in AI (Gemini Nano / `PREFER_ON_DEVICE`)** at `$0.00` marginal cost, and **Cloud Gemini Flash** handles complex multi-condition clauses, counter-clause redlines, and physical contract photo OCR on redacted text only.

---

## Table of Contents

1. [Live Demo & Video Walkthrough](#live-demo--video-walkthrough)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Key Features](#key-features)
5. [System Architecture](#system-architecture)
6. [Repository Structure](#repository-structure)
7. [Data Model & Security](#data-model--security)
8. [API Reference](#api-reference)
9. [Getting Started](#getting-started)
10. [Testing & Verification](#testing--verification)
11. [Deployment Guide (Render & Firebase)](#deployment-guide-render--firebase)
12. [Future Enhancements](#future-enhancements)

---

## Live Demo & Video Walkthrough

- **Demo Video (2-Minute Walkthrough):** [https://youtu.be/ME4XC5E5vb8](https://youtu.be/ME4XC5E5vb8)
- **Live Web Application:** [https://clauseguard-l5dq.onrender.com](https://clauseguard-l5dq.onrender.com)
- **Authentication:** Sign in with **Google**, **Email & Password**, or click **Continue as Guest Reviewer (Anonymous Session)** for instant one-click access.
- **30-Second Judge Verification Flow:**
=======
- **Production Web App:** [https://clauseguard-l5dq.onrender.com](https://clauseguard-l5dq.onrender.com)
- **2-Minute Video Demo (`#BuildHybridAI 2026`):** [https://youtu.be/ME4XC5E5vb8](https://youtu.be/ME4XC5E5vb8)
- **Authentication:** Sign in with **Google**, **Email & Password**, or click **Continue as Guest Reviewer (Anonymous Session)** for instant one-click access.
- **30-Second Verification Flow:**
  1. Click **Load Sample Tenancy** (or upload a contract PDF/TXT) and select a governing jurisdiction (`Malaysia`, `Singapore`, `United Kingdom`, `United States`, or `General`).
  2. Toggle between **Raw Input** and **Redacted Preview (Safe Payload)** to verify local masking of MyKad ICs, bank accounts, phone numbers, emails, and addresses before any network call.
  3. Click **Run Hybrid Audit** to inspect `ON_DEVICE` vs. `IN_CLOUD` inference provenance pills, per-clause latency, and `$0.00` local compute savings.
  4. Click **Draft Counter-Clause (Cloud)** on any `HIGH` or `MEDIUM` risk clause to generate a balanced, jurisdiction-grounded redline diff, then click **Save Redacted Audit** or **Export Report**.

---

## The Problem

1. **PII & Confidentiality Leakage:** Standard AI contract tools upload raw PDFs or pasted agreements directly to third-party cloud APIs—exposing Malaysian MyKad numbers (`XXXXXX-XX-XXXX`), passport numbers, bank account numbers, phone numbers, email addresses, SSM company registration IDs, and residential addresses.
2. **Prohibitive Cloud Inference Costs & Latency:** Sending every single clause of a 30-page agreement to large cloud LLMs drives up token costs and latency, even when routine boilerplate clauses can be evaluated locally in milliseconds.
3. **Connectivity & Offline Friction:** Tenants, freelancers, and legal reviewers frequently inspect agreements on the go or in restricted networks where uninterrupted cloud connectivity is unreliable.
4. **Actionability Gap:** Traditional contract analyzers flag risks without providing balanced, jurisdiction-aware counter-clauses users can immediately copy into negotiations.

---

## The Solution

ClauseGuard implements a **Split-Compute Hybrid AI** pipeline governed by a **Zero-Leakage Privacy Invariant**:

1. **Client-Side PII Shield First:** Before any clause touches local or cloud AI, deterministic regex redactors strip MyKad ICs, passports, credit/debit cards, bank account numbers, phone numbers, emails, SSM/registration IDs, and street addresses in the browser—and re-verify scrubbing server-side as defense-in-depth.
2. **Complexity-Aware On-Device Routing (`PREFER_ON_DEVICE`):** Clause risk classification, plain-English summaries, and red-flag extraction run via Firebase AI Logic (`InferenceMode.PREFER_ON_DEVICE`) and Chrome Built-in AI (`window.LanguageModel` / Gemini Nano) with strict JSON schema output and a 12-second timeout guard—executing routine clauses locally at **$0.00 marginal API cost** while working even offline.
3. **Graceful Cloud Escalation:** Dense multi-condition clauses, browsers without Gemini Nano, redline counter-clause drafting, and physical contract photo scans escalate seamlessly over authenticated routes to Cloud Gemini Flash using **redacted payloads only**.
4. **Negotiation-Ready Output:** Users receive side-by-side **Original Clause (Redacted)** vs. **Recommended Fair Clause** redlines tailored to local statutory protections (such as Section 28 of the Malaysian Contracts Act 1950), plus downloadable Markdown reports and SVG/printable audit exhibits.

---

## Key Features

- **Document Workbench & Dual Preview:** Paste contract text, load the built-in Malaysian Tenancy fixture, extract PDF text locally in-browser via `pdfjs-dist`, or toggle between **Raw Input** and **Redacted Preview** with a live per-category PII breakdown (`MyKad`, `Passport`, `Phone`, `Email`, `Bank Acct`, `Card`, `Reg ID`, `Address`).
- **Physical Contract Photo Scanner:** Capture or upload PNG/JPEG/WebP photos of printed contract pages (`PhotoScannerModal`) for structured clause transcription with immediate PII masking.
- **Live Telemetry Header:** Real-time visibility into Gemini Nano status (`Available`, `Downloadable` with progress trigger via `LanguageModel.create()`, `Unavailable`, `Unsupported`), **Online/Offline** network status, **On-Device vs. Cloud** inference split, PII entities masked, and compute cost breakdown.
- **Clause Risk Cards & Counter-Clause Redlining:** Severity badges (`HIGH`, `MEDIUM`, `LOW`), explicit provenance pills (`ON_DEVICE` vs. `IN_CLOUD`), latency tracking, red-flag bullets, and one-click **Draft Counter-Clause (Cloud)** generation with one-click copy.
- **Corporate Auth & Cloud Persistence:** Responsive `AuthGate` supporting **Google Sign-In** (with automatic mobile/Safari redirect fallback), **Email & Password**, and **Guest Reviewer** sessions, persisting strictly redacted audits in **Firebase Firestore**.
- **Audit Export:** Export structured Markdown legal review reports and printable/SVG risk summary exhibits (`ExportModal`).

---

## System Architecture

### Split-Compute Flow

```text
+-----------------------------------------------------------------------------------+
|                        Browser Client (React 19 + Vite 8 + TS)                    |
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
|           +---> [Complexity-Aware Hybrid Router (src/lib/hybridAi.ts)]            |
|           |        |-- Chrome Built-in Gemini Nano (window.LanguageModel)         |
|           |        |   -> ON_DEVICE provenance, $0.00 cost, offline-ready         |
|           |        |-- Firebase AI Logic (InferenceMode.PREFER_ON_DEVICE)         |
|           |        |-- Fallback: /api/v1/audit-clause (Cloud Gemini Flash)        |
|           |                                                                       |
|           +---> [Saved Audits & Profiles (Firestore SDK + Security Rules)]        |
+-----------------------------------------------------------------------------------+
                                     |
             HTTPS + Firebase ID Token + App Check Header
                    (Redacted text / base64 image only)
                                     v
+-----------------------------------------------------------------------------------+
|          Backend API (Node.js Express server.ts / Python FastAPI)                 |
|                                                                                   |
|  - Firebase ID Token verification + Firebase App Check validation                 |
|  - Host-matched CORS + COOP popup-safe security headers                           |
|  - Defense-in-depth server PII scrubbing (scrubPiiServer / redactor.py)           |
|                                                                                   |
|  Routes:                                                                          |
|   * GET  /health                          -> Service health & runtime telemetry   |
|   * POST /api/v1/audit-clause             -> Gemini cloud clause audit fallback   |
|   * POST /api/v1/counter-clause           -> Balanced counter-clause drafting     |
|   * POST /api/v1/analyze-contract-image   -> Photo OCR + PII redaction            |
+-----------------------------------------------------------------------------------+
```

### Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion |
| **On-Device & Hybrid AI** | Chrome Built-in AI (`window.LanguageModel` / Gemini Nano), Firebase AI Logic (`firebase/ai`, `InferenceMode.PREFER_ON_DEVICE`) |
| **Client Document Parsing** | `pdfjs-dist` (local browser-only PDF text extraction without server upload) |
| **Primary Full-Stack Server** | Node.js + Express (`server.ts`) + `@google/genai` (`gemini-3.5-flash` / `gemini-2.5-flash-lite` rolling fallback) |
| **Parallel Python Microservice** | Python 3.12, FastAPI, Pydantic v2, `firebase-admin`, `google-genai`, `pytest` (`backend/`) |
| **Auth, Security & Persistence** | Firebase Authentication (Google, Email/Password, Anonymous), Firebase App Check, Cloud Firestore |

---

## Repository Structure

```text
.
├── server.ts                         # Express + Vite production/dev server & Gemini API proxy
├── render.yaml                       # Render single-service deployment blueprint
├── index.html                        # App HTML entry point & OpenGraph metadata
├── package.json                      # Scripts (dev, start, build, lint) & Node dependencies
├── metadata.json                     # App metadata & server-side Gemini capability declaration
├── firebase-applet-config.json       # Firebase web app & Firestore database configuration
├── firebase-blueprint.json           # Canonical Firestore entity schemas & collection layout
├── firestore.rules                   # Owner-scoped Firestore security rules
├── eslint.config.js                  # Security-rules ESLint configuration
├── security_spec.md                  # Threat model, invariants, and security verification spec
├── .env.example                      # Root server environment template (no secrets)
├── src/
│   ├── App.tsx                       # Main ClauseGuard workspace & audit orchestration
│   ├── index.css                     # Executive Legal-Tech Tailwind v4 theme & typography
│   ├── components/
│   │   ├── AuthGate.tsx              # Split-screen Sign In / Sign Up / Guest Reviewer gate
│   │   ├── TopBar.tsx                # Workspace navigation, user account menu, email verification
│   │   ├── TelemetryHeader.tsx       # Nano availability/download, network status, split & cost meter
│   │   ├── ContractInputPanel.tsx    # Document workbench, PDF upload, raw vs. redacted preview
│   │   ├── ClauseCard.tsx            # Risk badge, provenance pill, red flags, counter-clause diff
│   │   ├── PhotoScannerModal.tsx     # Physical contract image upload & OCR transcription modal
│   │   ├── ExportModal.tsx           # Markdown report & SVG/printable exhibit exporter
│   │   ├── SavedAuditsPanel.tsx      # Firestore saved audit history viewer & loader
│   │   └── ErrorBoundary.tsx         # React fault-isolation boundary
│   └── lib/
│       ├── firebase.ts               # Firebase Auth (popup + redirect fallback), App Check & Firestore
│       ├── firestoreAudits.ts        # Firestore CRUD + local sessionStorage fallback
│       ├── hybridAi.ts               # Nano availability, timeout-guarded local routing & cloud fallback
│       ├── piiRedactor.ts            # Deterministic client-side PII masking & breakdown counter
│       ├── clauseSplitter.ts         # Numbered section parser for legal agreements
│       ├── pdfExtractor.ts           # Local browser-only PDF text extractor via pdfjs-dist
│       ├── sampleContract.ts         # Built-in Malaysian tenancy agreement test fixture
│       └── types.ts                  # Shared TypeScript domain interfaces
└── backend/                          # Standalone Python 3.12 FastAPI backend service
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
  - `server.ts` verifies Firebase ID tokens (`aud`, `iss`, `sub`, `exp`, `iat`) and supports Firebase App Check headers (`X-Firebase-AppCheck`).
  - `firestore.rules` restricts document reads and writes to authenticated users (`request.auth != null`) and owner-scoped user profiles.
- **Zero Hardcoded Secrets:** `GEMINI_API_KEY` is never committed to source control; it is injected strictly at runtime via environment variables.

---

## API Reference

All `POST` endpoints accept `Authorization: Bearer <firebase-id-token>` and `X-Firebase-AppCheck` headers.

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
- **Google Chrome** with Built-in AI flags enabled (`#prompt-api-for-gemini-nano`) for local `ON_DEVICE` Gemini Nano inference (otherwise the app automatically uses Cloud Gemini Flash fallback)
- **Gemini API Key** configured in `.env` (`GEMINI_API_KEY`)
- **Python 3.12+** (optional, if running the standalone `backend/` FastAPI service)

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your `GEMINI_API_KEY`:

```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
PORT=3000
NODE_ENV="development"
ENV="development"
GEMINI_CLOUD_MODEL="gemini-3.5-flash"
FIREBASE_PROJECT_ID="project2-8e03b"
FIRESTORE_DATABASE_ID="(default)"
CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
```

### 2. Install & Run Full-Stack App (Port 3000)

```bash
npm install --legacy-peer-deps
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
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Testing & Verification

- **TypeScript Type Check:**
  ```bash
  npm run lint
  ```
- **Production Bundle Build:**
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

## Deployment Guide (Render & Firebase)

### 1. Render Web Service (`render.yaml`)

- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Start Command:** `npm run start`
- **Required Environment Variables:**
  - `GEMINI_API_KEY`
  - `GEMINI_CLOUD_MODEL` = `gemini-3.5-flash`
  - `FIREBASE_PROJECT_ID` = `project2-8e03b`
  - `FIRESTORE_DATABASE_ID` = `(default)`
  - `NODE_ENV` = `production`

### 2. Firebase Console Configuration (`project2-8e03b`)

1. Open **Authentication → Sign-in method** and ensure **Google**, **Email/Password**, and **Anonymous** providers are enabled.
2. Add your Render domain (`clauseguard-l5dq.onrender.com`) under **Authentication → Settings → Authorized domains**.
3. Publish `firestore.rules` under **Firestore Database → Rules** on the `(default)` database.

---

## Future Enhancements

1. **DOCX Tracked-Changes Redline Export:** Export accepted counter-clauses directly into `.docx` files with Word-compatible `<w:ins>` / `<w:del>` tracked revisions so legal counterparties can review changes natively.
2. **Offline Encrypted Queue & Sync:** Persist in-progress offline Gemini Nano audits in encrypted browser storage (`IndexedDB` + WebCrypto) and automatically sync redacted summaries to Firestore once connectivity returns.
3. **Custom Corporate Playbooks & Risk Rubrics:** Allow procurement and legal teams to define organization-specific red-flag policies (e.g., maximum liability caps, governing law requirements, notice periods) applied during on-device and cloud audits.
4. **Cross-Clause Consistency & Multi-Language Support:** Detect contradictions across separate sections (e.g., Term vs. Termination Notice) and add native bilingual **Bahasa Melayu / English** clause normalization for Malaysian tenancy and statutory contracts.
5. **Client-Side NER Enhancement:** Supplement deterministic regex PII masking with a lightweight local WebAssembly/ONNX Named-Entity Recognition (NER) pass to mask free-form personal names and bespoke entity references before cloud escalation.
=======
