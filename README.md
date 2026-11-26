# ClauseGuard

**Zero-Leakage Hybrid AI Contract Intelligence** built for `#BuildHybridAI 2026`.

[![Live Demo](https://img.shields.io/badge/Live_Demo-clauseguard--l5dq.onrender.com-0F172A?style=for-the-badge)](https://clauseguard-l5dq.onrender.com)
[![YouTube Demo](https://img.shields.io/badge/YouTube_Demo-Watch_2--Min_Walkthrough-DC2626?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/ME4XC5E5vb8)
[![Built With](https://img.shields.io/badge/Built_With-Gemini_Nano_%2B_Firebase_AI_Logic-10B981?style=for-the-badge)](#system-architecture)

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
