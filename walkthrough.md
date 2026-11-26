# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 7

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| CORS Origin Bypass | `server.ts` | 203 | Origin validation used substring `origin.includes(host)` and prefix `startsWith('http://localhost:')`, allowing lookalike domains (`example.com.attacker.evil`). | High | Fixed | Replaced with `isAllowedOrigin()` using strict `URL` parsing and exact `parsed.host === requestHost` comparison. |
| Returning User Profile Permission Lockout | `src/lib/firestoreAudits.ts` | 36 | `upsertUserProfile()` used `setDoc(..., { createdAt: serverTimestamp() }, { merge: true })` on every login, mutating `createdAt` and failing Firestore's immutable `createdAt` rule on subsequent logins. | High | Fixed | Checked `getDoc()` first; calls `setDoc()` only on initial profile creation and `updateDoc()` (without `createdAt`) on subsequent logins. |
| Missing Email Verification & Token IAT Checks | `server.ts`, `backend/app/security.py` | 132 | Firebase ID token verification accepted tokens without verifying `email_verified === true` or checking `iat` freshness. | High | Fixed | Enforced `payload.email_verified === true` when an email claim is present and validated token `iat` and `exp` bounds. |
| Unindexed Firestore List Query | `src/lib/firestoreAudits.ts` | 127 | `listUserAudits()` combined `where('userId', '==', uid)` with `orderBy('createdAt', 'desc')`, requiring a manual composite index that fails on newly provisioned databases. | Medium | Fixed | Queried strictly by `userId` and sorted saved audits client-side by `createdAt` timestamp descending. |
| Unvalidated LLM Output & PII Echo Risk | `server.ts`, `backend/app/main.py` | 258 | Structured responses from Gemini were forwarded directly without server-side PII scrubbing or strict field clamping. | Medium | Fixed | Normalized `riskLevel` enums, bounded array/string sizes, and ran `scrubPiiServer` / `scrub_pii` over generated text fields. |
| Production Start Script Defaulting to Dev Auth Mode | `package.json` | 8 | `npm start` invoked `tsx server.ts` without `NODE_ENV=production`, leaving production startup in development auth-relaxation mode unless explicitly overridden. | Medium | Fixed | Updated `start` script to `NODE_ENV=production tsx server.ts` so production fails closed unless `ENV=development` is set. |
| Weak Identifier & SVG Title Sanitization | `server.ts`, `backend/app/schemas.py`, `src/components/ExportModal.tsx` | 240 | `clause_id` lacked character allowlist validation and SVG exhibit export left single quotes and control characters unfiltered. | Low | Fixed | Enforced `^[a-zA-Z0-9_-]+$` on `clause_id` and stripped control characters and quotes from exported SVG exhibit titles. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `server.ts`, `backend/app/gemini_cloud.py` | `GEMINI_API_KEY` is read exclusively on the server via `process.env` / `Settings` and never bundled into client code. |
| Client & Server PII Scrubbing | `src/lib/piiRedactor.ts`, `src/lib/hybridAi.ts`, `server.ts`, `backend/app/redactor.py` | Deterministic regex masking scrubs MyKad, passports, phones, emails, bank accounts, cards, and registration IDs before cloud calls and again on the server. |
| Database Access Control | `firestore.rules` | Enforces verified Google sign-in (`email_verified == true`), strict `userId == request.auth.uid` ownership, master-gate parent checks on clause subcollections, and bounded field validation. |
| Transitive Dependency Audit | `bun.lock` | `bun audit` identified 2 transitive advisories inside `firebase` (`@grpc/grpc-js <1.13.6`, used only in Node gRPC contexts); `firebase` is already pinned at latest (`13.4.0`). |

---

## PoC Verification

### 1. Substring CORS Origin Bypass on API Endpoints

#### Summary
| Field | Value |
|---|---|
| Issue Type | Permissive CORS Origin Validation |
| Impact | High |
| Affected File | `server.ts:183` |
| Test Scenario | Request with `Host: clauseguard.example.com` and forged `Origin: https://clauseguard.example.com.attacker.test` |

#### How It Was Fixed
Replaced substring checks (`origin.includes(host)`) with strict URL parsing (`new URL(origin)`) requiring `http:`/`https:` protocol and exact `parsed.host === requestHost` equality.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request enters CORS middleware (`server.ts:224`) with forged `Origin` header. | Enters `isAllowedOrigin(origin, host)` |
| 2 | `new URL(origin)` parses `parsed.host` as `clauseguard.example.com.attacker.test` (`server.ts:186`). | Exact check `parsed.host === requestHost` evaluates `false` |
| 3 | Response omits `Access-Control-Allow-Origin` header. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Lookalike subdomains and suffix-appended attacker origins can no longer obtain CORS access headers.

---

### 2. Returning User Sign-In Firestore Permission Failure

#### Summary
| Field | Value |
|---|---|
| Issue Type | Immutable Timestamp Mutation on Profile Sync |
| Impact | High |
| Affected File | `src/lib/firestoreAudits.ts:26` |
| Test Scenario | Authenticated user signs in a second time after `users/{uid}` already exists in Firestore. |

#### How It Was Fixed
`upsertUserProfile()` now reads `getDoc(userRef)` first; it executes `setDoc` with `createdAt` only when the profile does not exist, and executes `updateDoc` modifying only `['displayName', 'email', 'updatedAt']` on returning sign-ins.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `onAuthStateChanged` invokes `upsertUserProfile()` (`src/App.tsx:79`). | Checks `getDoc(userRef)` |
| 2 | Existing profile detected (`src/lib/firestoreAudits.ts:47`); `updateDoc` sends only `displayName`, `email`, and `updatedAt`. | Matches `affectedKeys().hasOnly(['displayName', 'email', 'updatedAt'])` and preserves `createdAt` |
| 3 | Firestore security rules validate `incoming().createdAt == existing().createdAt` and permit write. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Returning users sync profile updates cleanly without triggering Firestore permission denials.

---

### 3. Unverified Email Bearer Token & Invalid Clause ID Rejection

#### Summary
| Field | Value |
|---|---|
| Issue Type | Token Claim Enforcement & Input Validation |
| Impact | High |
| Affected File | `server.ts:135` & `server.ts:251` |
| Test Scenario | `POST /api/v1/counter-clause` with `clause_id: "../etc/passwd"` or a Firebase token lacking `email_verified: true`. |

#### How It Was Fixed
`verifyFirebaseIdToken()` rejects tokens where `email` is present without `email_verified === true` or where `iat` is invalid, and all API routes validate `clause_id` against `^[a-zA-Z0-9_-]{1,128}$`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request with unverified email token or invalid `clause_id` hits `securityMiddleware` / route handler. | Enters validation |
| 2 | `verifyFirebaseIdToken()` checks `payload.email_verified !== true` (`server.ts:138`) or `SAFE_CLAUSE_ID_RE.test(clause_id)` (`server.ts:251`). | Rejects request with HTTP `401` / `400` |
| 3 | Upstream Gemini call is never invoked. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Unverified email tokens and malformed clause identifiers are blocked before reaching model inference.
