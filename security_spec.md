# ClauseGuard Firestore Security Specification

## 1. Data Invariants
1. **Owner Isolation**: Every `users/{userId}` document is readable and writable solely by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **Audit Ownership**: Every `audits/{auditId}` document requires `userId == request.auth.uid`, valid ID format (`^[a-zA-Z0-9_\-]+$`), bounded string sizes, and `createdAt == request.time` / `updatedAt == request.time`.
3. **Master Gate on Clauses**: Every `audits/{auditId}/clauses/{clauseId}` subcollection operation fetches the parent `/audits/{auditId}` document via `get()` and enforces `parent.data.userId == request.auth.uid` plus `incoming().auditId == auditId` and `incoming().userId == request.auth.uid`.
4. **Immutable Ownership & Timestamps**: `userId`, `id`, `auditId`, and `createdAt` cannot be modified after creation.
5. **No Shadow Fields**: `keys().hasAll(...)` and `keys().hasOnly(...)` block unapproved properties on create, and `affectedKeys().hasOnly(...)` restricts update mutations.
6. **Secure List Queries**: `allow list` on `/audits` enforces `resource.data.userId == request.auth.uid`, and `allow list` on `/audits/{auditId}/clauses` enforces `resource.data.userId == request.auth.uid` without `get()` inside `list`.

## 2. Adversarial Payload Matrix ("Dirty Dozen")
1. **Unauthenticated read on `/users/{uid}`**: `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified email write on `/users/{uid}`**: `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-user PII read on `/users/{otherUid}`**: `request.auth.uid != otherUid` -> `PERMISSION_DENIED`.
4. **Identity spoofing on `/audits/{auditId}`**: `userId: "victim-uid"` -> `PERMISSION_DENIED`.
5. **Shadow field injection on `/audits/{auditId}`**: extra key `isAdmin: true` -> `PERMISSION_DENIED`.
6. **ID poisoning on `/audits/{invalid$id}`**: document ID > 128 chars or invalid characters -> `PERMISSION_DENIED`.
7. **Timestamp spoofing on `/audits/{auditId}`**: `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
8. **Orphaned clause write on `/audits/{nonExistent}/clauses/{id}`**: parent audit does not exist or belongs to another user -> `PERMISSION_DENIED`.
9. **Array overflow on `redFlags`**: `redFlags.size() > 20` -> `PERMISSION_DENIED`.
10. **Oversized clause payload (Denial of Wallet)**: `redactedText.size() > 12000` -> `PERMISSION_DENIED`.
11. **Immutable field mutation on update**: changing `userId` or `createdAt` during update -> `PERMISSION_DENIED`.
12. **Blanket list query scraping on `/audits`**: querying audits without `where('userId', '==', auth.uid)` -> `PERMISSION_DENIED`.
