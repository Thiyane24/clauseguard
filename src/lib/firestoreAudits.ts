import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { redactPII } from './piiRedactor';
import type { ClauseAuditItem, Jurisdiction, SavedAuditSummary } from './types';

const LOCAL_FALLBACK_KEY = 'clauseguard_local_audits_v1';

interface LocalStoredAudit {
  summary: SavedAuditSummary;
  clauses: ClauseAuditItem[];
}

function readLocalAudits(userId: string): LocalStoredAudit[] {
  try {
    const raw = sessionStorage.getItem(`${LOCAL_FALLBACK_KEY}_${userId}`);
    if (!raw) return [];
    return JSON.parse(raw) as LocalStoredAudit[];
  } catch {
    return [];
  }
}

function writeLocalAudits(userId: string, items: LocalStoredAudit[]): void {
  try {
    sessionStorage.setItem(`${LOCAL_FALLBACK_KEY}_${userId}`, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'item';
}

function getTimestampMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts && typeof ts === 'object' && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  if (typeof ts === 'number') {
    return ts;
  }
  return 0;
}

export async function upsertUserProfile(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  // Unverified email/password accounts wait for email verification before writing to Firestore
  if (!user.isAnonymous && user.email && !user.emailVerified) {
    return;
  }

  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = (
    user.displayName ||
    user.email?.split('@')[0] ||
    (user.isAnonymous ? 'Guest Reviewer' : 'ClauseGuard User')
  ).slice(0, 120);

  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        ...(user.email ? { email: user.email.slice(0, 254) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        ...(user.email ? { email: user.email.slice(0, 254) } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAuditToFirestore(params: {
  title: string;
  jurisdiction: Jurisdiction;
  clauses: ClauseAuditItem[];
}): Promise<{ auditId: string; storageMode: 'firestore' | 'session' }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to save redacted audits to your workspace.');
  }

  const completed = params.clauses.filter((c) => c.status === 'completed');
  if (completed.length === 0) {
    throw new Error('Run an audit on at least one clause before saving.');
  }

  const auditId = sanitizeId(`audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const auditPath = `audits/${auditId}`;

  const highRiskCount = completed.filter((c) => c.riskLevel === 'HIGH').length;
  const mediumRiskCount = completed.filter((c) => c.riskLevel === 'MEDIUM').length;
  const lowRiskCount = completed.filter((c) => c.riskLevel === 'LOW').length;
  const piiItemsRemoved = params.clauses.reduce((sum, c) => sum + c.piiItemsRemoved, 0);
  const onDeviceCount = completed.filter((c) => c.inferenceSource === 'ON_DEVICE').length;
  const inCloudCount = completed.filter((c) => c.inferenceSource === 'IN_CLOUD').length;
  const safeAuditTitle =
    redactPII(params.title.trim()).redactedText.slice(0, 200) || 'Untitled Contract Audit';

  const summary: SavedAuditSummary = {
    id: auditId,
    userId: user.uid,
    title: safeAuditTitle,
    jurisdiction: params.jurisdiction,
    totalClauses: completed.length,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    piiItemsRemoved,
    onDeviceCount,
    inCloudCount,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Unverified email accounts use encrypted session fallback until email verification completes
  if (!user.isAnonymous && user.email && !user.emailVerified) {
    const existing = readLocalAudits(user.uid);
    writeLocalAudits(user.uid, [{ summary, clauses: completed }, ...existing]);
    return { auditId, storageMode: 'session' };
  }

  try {
    const batch = writeBatch(db);
    const auditRef = doc(db, 'audits', auditId);

    batch.set(auditRef, {
      id: auditId,
      userId: user.uid,
      title: safeAuditTitle,
      jurisdiction: params.jurisdiction,
      totalClauses: completed.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      piiItemsRemoved,
      onDeviceCount,
      inCloudCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const clause of completed.slice(0, 100)) {
      const clauseId = sanitizeId(clause.clauseId);
      const clauseRef = doc(db, 'audits', auditId, 'clauses', clauseId);
      const safeRedacted = redactPII(clause.redactedText).redactedText.slice(0, 12000);
      const safeClauseTitle = redactPII(clause.clauseTitle).redactedText.slice(0, 240);
      const safeSummary = redactPII(clause.plainEnglishSummary).redactedText.slice(0, 2000);

      const payload: Record<string, unknown> = {
        id: clauseId,
        auditId,
        userId: user.uid,
        clauseTitle: safeClauseTitle || 'Audited Clause',
        redactedText: safeRedacted,
        riskLevel: clause.riskLevel,
        plainEnglishSummary: safeSummary || 'Reviewed clause obligations.',
        redFlags: clause.redFlags
          .slice(0, 20)
          .map((f) => redactPII(f).redactedText.slice(0, 500)),
        inferenceSource: clause.inferenceSource,
        piiItemsRemoved: clause.piiItemsRemoved,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (clause.counterClause) {
        payload.legalConcern = redactPII(clause.counterClause.legal_concern)
          .redactedText.slice(0, 2000);
        payload.suggestedCounterClause = redactPII(clause.counterClause.suggested_counter_clause)
          .redactedText.slice(0, 12000);
      }
      batch.set(clauseRef, payload);
    }

    await batch.commit();
    return { auditId, storageMode: 'firestore' };
  } catch (error) {
    // Graceful fallback to local session if offline or rules reject unverified token
    if (error instanceof Error && error.message.toLowerCase().includes('offline')) {
      const existing = readLocalAudits(user.uid);
      writeLocalAudits(user.uid, [{ summary, clauses: completed }, ...existing]);
      return { auditId, storageMode: 'session' };
    }
    handleFirestoreError(error, OperationType.WRITE, auditPath);
  }
}

export async function listUserAudits(): Promise<SavedAuditSummary[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const localItems = readLocalAudits(user.uid).map((i) => i.summary);
  if (!user.isAnonymous && user.email && !user.emailVerified) {
    return localItems;
  }

  const path = 'audits';
  try {
    const q = query(collection(db, 'audits'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    const cloudItems = snap.docs.map((d) => d.data() as SavedAuditSummary);
    const merged = [...cloudItems, ...localItems];
    return merged.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
  } catch (error) {
    if (localItems.length > 0) return localItems;
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function loadAuditClauses(auditId: string): Promise<ClauseAuditItem[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const localMatch = readLocalAudits(user.uid).find((i) => i.summary.id === auditId);
  if (localMatch) return localMatch.clauses;

  const path = `audits/${auditId}/clauses`;
  try {
    const q = query(
      collection(db, 'audits', auditId, 'clauses'),
      where('userId', '==', user.uid),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, idx) => {
      const data = d.data() as Record<string, unknown>;
      const hasCounter =
        typeof data.suggestedCounterClause === 'string' &&
        data.suggestedCounterClause.length > 0;
      const riskLevel = (data.riskLevel as ClauseAuditItem['riskLevel']) ?? 'MEDIUM';
      const redactedText = String(data.redactedText ?? '');
      const piiItemsRemoved = Number(data.piiItemsRemoved ?? 0);

      return {
        clauseId: String(data.id ?? `clause-${idx + 1}`),
        clauseNumber: String(idx + 1),
        rawTitle: String(data.clauseTitle ?? `Clause ${idx + 1}`),
        rawText: redactedText,
        redactedText,
        piiItemsRemoved,
        redactionBreakdown: {
          mykad: 0,
          passport: 0,
          phone: 0,
          email: 0,
          bankAccount: 0,
          card: 0,
          regId: 0,
          address: 0,
        },
        status: 'completed',
        clauseTitle: String(data.clauseTitle ?? `Clause ${idx + 1}`),
        riskLevel,
        plainEnglishSummary: String(data.plainEnglishSummary ?? ''),
        redFlags: Array.isArray(data.redFlags) ? data.redFlags.map(String) : [],
        inferenceSource:
          data.inferenceSource === 'ON_DEVICE' ? 'ON_DEVICE' : 'IN_CLOUD',
        counterClause: hasCounter
          ? {
              clause_id: String(data.id ?? `clause-${idx + 1}`),
              redacted_text: redactedText,
              pii_items_removed: piiItemsRemoved,
              risk_level: riskLevel,
              legal_concern: String(data.legalConcern ?? ''),
              suggested_counter_clause: String(data.suggestedCounterClause ?? ''),
              inference_source: 'CLOUD_GEMINI',
            }
          : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteAuditFromFirestore(auditId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const localItems = readLocalAudits(user.uid);
  if (localItems.some((i) => i.summary.id === auditId)) {
    writeLocalAudits(
      user.uid,
      localItems.filter((i) => i.summary.id !== auditId),
    );
    return;
  }

  const path = `audits/${auditId}`;
  try {
    const clausesSnap = await getDocs(
      query(
        collection(db, 'audits', auditId, 'clauses'),
        where('userId', '==', user.uid),
      ),
    );
    const batch = writeBatch(db);
    clausesSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    batch.delete(doc(db, 'audits', auditId));
    await batch.commit();
  } catch (error) {
    try {
      await deleteDoc(doc(db, 'audits', auditId));
    } catch {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}
