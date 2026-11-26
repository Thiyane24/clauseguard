import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { BookmarkCheck, Download, Loader2, ShieldAlert } from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { ClauseCard } from './components/ClauseCard';
import { ContractInputPanel } from './components/ContractInputPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExportModal } from './components/ExportModal';
import { PhotoScannerModal } from './components/PhotoScannerModal';
import { SavedAuditsPanel } from './components/SavedAuditsPanel';
import { TelemetryHeader } from './components/TelemetryHeader';
import { TopBar, type ActiveSection } from './components/TopBar';
import { splitContractIntoClauses } from './lib/clauseSplitter';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  deleteAuditFromFirestore,
  listUserAudits,
  loadAuditClauses,
  saveAuditToFirestore,
  upsertUserProfile,
} from './lib/firestoreAudits';
import {
  auditClauseHybrid,
  checkNanoAvailability,
  downloadNanoModel,
  requestCounterClause,
} from './lib/hybridAi';
import { extractPdfTextLocally } from './lib/pdfExtractor';
import { redactPII } from './lib/piiRedactor';
import {
  SAMPLE_CONTRACT_TITLE,
  SAMPLE_MALAYSIAN_TENANCY_CONTRACT,
} from './lib/sampleContract';
import type {
  ClauseAuditItem,
  Jurisdiction,
  NanoAvailability,
  RiskLevel,
  SavedAuditSummary,
} from './lib/types';

type RiskFilter = 'ALL' | RiskLevel;

function ClauseGuardWorkspace() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('workspace');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [nanoAvailability, setNanoAvailability] = useState<NanoAvailability>('unsupported');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const [title, setTitle] = useState<string>(SAMPLE_CONTRACT_TITLE);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>('Malaysia');
  const [rawText, setRawText] = useState<string>(SAMPLE_MALAYSIAN_TENANCY_CONTRACT);
  const [clauses, setClauses] = useState<ClauseAuditItem[]>([]);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');

  const [isAuditing, setIsAuditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const [savedAudits, setSavedAudits] = useState<SavedAuditSummary[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const inFlightCounterClausesRef = useRef<Set<string>>(new Set());

  const refreshSavedAudits = useCallback(async () => {
    if (!auth.currentUser) {
      setSavedAudits([]);
      return;
    }
    setSavedLoading(true);
    try {
      const list = await listUserAudits();
      setSavedAudits(list);
    } catch (err) {
      console.error('Failed to list saved audits:', err);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    testFirestoreConnection().catch(console.error);
    checkNanoAvailability()
      .then(setNanoAvailability)
      .catch(() => setNanoAvailability('unsupported'));

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        await upsertUserProfile().catch((err) => {
          console.warn('Profile sync notice:', err);
        });
        await refreshSavedAudits();
      } else {
        setSavedAudits([]);
      }
    });

    return () => unsub();
  }, [refreshSavedAudits]);

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOutUser();
      setActiveSection('workspace');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDownloadNano = async () => {
    setNanoAvailability('downloading');
    setDownloadProgress(0);
    setBannerError(null);
    try {
      const updated = await downloadNanoModel((ratio) => setDownloadProgress(ratio));
      setNanoAvailability(updated);
      setDownloadProgress(null);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Unable to initialize on-device Gemini Nano download.',
      );
      const latest = await checkNanoAvailability();
      setNanoAvailability(latest);
      setDownloadProgress(null);
    }
  };

  const handlePdfExtract = async (file: File) => {
    setPdfLoading(true);
    setBannerError(null);
    try {
      const { text, pageCount } = await extractPdfTextLocally(file);
      if (!text) {
        setBannerError('No readable text found in that PDF. Try scanning a photo of the pages instead.');
        return;
      }
      setTitle(file.name.replace(/\.pdf$/i, ''));
      setRawText(text);
      setBannerSuccess(`Extracted ${pageCount} PDF page${pageCount === 1 ? '' : 's'} locally in browser.`);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to parse PDF locally.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleLoadSample = () => {
    setTitle(SAMPLE_CONTRACT_TITLE);
    setJurisdiction('Malaysia');
    setRawText(SAMPLE_MALAYSIAN_TENANCY_CONTRACT);
    setClauses([]);
    setBannerError(null);
    setBannerSuccess(null);
  };

  const handleClear = () => {
    setRawText('');
    setClauses([]);
    setBannerError(null);
    setBannerSuccess(null);
  };

  const handleRunAudit = async () => {
    setBannerError(null);
    setBannerSuccess(null);
    const parsed = splitContractIntoClauses(rawText);
    if (parsed.length === 0) {
      setBannerError('Please enter or upload contract text containing at least one clause.');
      return;
    }

    const initialItems: ClauseAuditItem[] = parsed.map((p) => ({
      ...p,
      status: 'pending',
      clauseTitle: p.rawTitle,
      riskLevel: 'MEDIUM',
      plainEnglishSummary: '',
      redFlags: [],
      inferenceSource: 'IN_CLOUD',
    }));

    setClauses(initialItems);
    setIsAuditing(true);
    setRiskFilter('ALL');

    for (const item of initialItems) {
      setClauses((prev) =>
        prev.map((c) => (c.clauseId === item.clauseId ? { ...c, status: 'analyzing' } : c)),
      );

      try {
        const result = await auditClauseHybrid({
          clauseId: item.clauseId,
          fallbackTitle: item.rawTitle,
          redactedText: item.redactedText,
          jurisdiction,
        });

        setClauses((prev) =>
          prev.map((c) =>
            c.clauseId === item.clauseId
              ? {
                  ...c,
                  status: 'completed',
                  clauseTitle: result.clauseTitle,
                  riskLevel: result.riskLevel,
                  plainEnglishSummary: result.plainEnglishSummary,
                  redFlags: result.redFlags,
                  inferenceSource: result.inferenceSource,
                  latencyMs: result.latencyMs,
                }
              : c,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Audit failed for clause.';
        setClauses((prev) =>
          prev.map((c) =>
            c.clauseId === item.clauseId
              ? {
                  ...c,
                  status: 'error',
                  errorMessage: message,
                }
              : c,
          ),
        );
      }
    }

    setIsAuditing(false);
  };

  const handleDraftCounterClause = async (clauseId: string) => {
    if (inFlightCounterClausesRef.current.has(clauseId)) return;
    const target = clauses.find((c) => c.clauseId === clauseId);
    if (!target || target.counterClauseLoading) return;

    inFlightCounterClausesRef.current.add(clauseId);
    setClauses((prev) =>
      prev.map((c) =>
        c.clauseId === clauseId
          ? { ...c, counterClauseLoading: true, counterClauseError: undefined }
          : c,
      ),
    );

    try {
      const counter = await requestCounterClause({
        clauseId: target.clauseId,
        redactedText: target.redactedText,
        jurisdiction,
      });

      setClauses((prev) =>
        prev.map((c) =>
          c.clauseId === clauseId
            ? { ...c, counterClause: counter, counterClauseLoading: false }
            : c,
        ),
      );
    } catch (err) {
      setClauses((prev) =>
        prev.map((c) =>
          c.clauseId === clauseId
            ? {
                ...c,
                counterClauseLoading: false,
                counterClauseError:
                  err instanceof Error ? err.message : 'Failed to draft counter-clause.',
              }
            : c,
        ),
      );
    } finally {
      inFlightCounterClausesRef.current.delete(clauseId);
    }
  };

  const handleSaveAudit = async () => {
    setBannerError(null);
    setBannerSuccess(null);
    setSavingToCloud(true);
    try {
      const result = await saveAuditToFirestore({
        title,
        jurisdiction,
        clauses,
      });
      await refreshSavedAudits();
      setBannerSuccess(
        result.storageMode === 'firestore'
          ? 'Redacted audit saved securely to Firestore.'
          : 'Redacted audit saved to your active session (verify email to sync to Firestore).',
      );
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to save audit.');
    } finally {
      setSavingToCloud(false);
    }
  };

  const handleLoadSavedAudit = async (audit: SavedAuditSummary) => {
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const loadedClauses = await loadAuditClauses(audit.id);
      setTitle(audit.title);
      setJurisdiction(audit.jurisdiction);
      setClauses(loadedClauses);
      setRawText(loadedClauses.map((c) => c.redactedText).join('\n\n'));
      setActiveSection('workspace');
      setBannerSuccess(`Loaded redacted audit "${audit.title}".`);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to load saved audit.');
    }
  };

  const handleDeleteSavedAudit = async (auditId: string) => {
    setBannerError(null);
    try {
      await deleteAuditFromFirestore(auditId);
      setSavedAudits((prev) => prev.filter((a) => a.id !== auditId));
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to delete audit.');
    }
  };

  const livePiiTotal = useMemo(() => {
    if (clauses.length > 0) {
      return clauses.reduce((sum, c) => sum + c.piiItemsRemoved, 0);
    }
    return redactPII(rawText).piiItemsRemoved;
  }, [clauses, rawText]);

  const filteredClauses = useMemo(() => {
    if (riskFilter === 'ALL') return clauses;
    return clauses.filter((c) => c.riskLevel === riskFilter);
  }, [clauses, riskFilter]);

  const counts = useMemo(() => {
    const completed = clauses.filter((c) => c.status === 'completed');
    return {
      all: clauses.length,
      high: completed.filter((c) => c.riskLevel === 'HIGH').length,
      medium: completed.filter((c) => c.riskLevel === 'MEDIUM').length,
      low: completed.filter((c) => c.riskLevel === 'LOW').length,
    };
  }, [clauses]);

  const handleNavigate = (section: ActiveSection) => {
    if (section === 'scanner') {
      setScannerOpen(true);
      return;
    }
    setActiveSection(section);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
          Initializing ClauseGuard workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onOpenExport={() => setExportOpen(true)}
        user={user}
        authLoading={authLoading}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        <TelemetryHeader
          nanoAvailability={nanoAvailability}
          downloadProgress={downloadProgress}
          onDownloadNano={handleDownloadNano}
          clauses={clauses}
          piiTotal={livePiiTotal}
        />

        {bannerError && (
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-900"
          >
            <ShieldAlert className="w-5 h-5 text-red-800 shrink-0 mt-0.5" />
            <div className="flex-1">{bannerError}</div>
          </div>
        )}

        {bannerSuccess && (
          <div
            role="status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900"
          >
            {bannerSuccess}
          </div>
        )}

        {activeSection === 'saved' ? (
          <SavedAuditsPanel
            audits={savedAudits}
            loading={savedLoading}
            isSignedIn={Boolean(user)}
            onSignIn={() => signInWithGoogle()}
            onLoadAudit={handleLoadSavedAudit}
            onDeleteAudit={handleDeleteSavedAudit}
          />
        ) : (
          <div className="space-y-6">
            <ContractInputPanel
              title={title}
              onTitleChange={setTitle}
              jurisdiction={jurisdiction}
              onJurisdictionChange={setJurisdiction}
              rawText={rawText}
              onRawTextChange={setRawText}
              onLoadSample={handleLoadSample}
              onOpenPhotoScanner={() => setScannerOpen(true)}
              onRunAudit={handleRunAudit}
              onClear={handleClear}
              isAuditing={isAuditing}
              onPdfExtract={handlePdfExtract}
              pdfLoading={pdfLoading}
            />

            {clauses.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg border border-slate-200">
                    {(
                      [
                        { id: 'ALL', label: `All (${counts.all})` },
                        { id: 'HIGH', label: `High Risk (${counts.high})` },
                        { id: 'MEDIUM', label: `Medium Risk (${counts.medium})` },
                        { id: 'LOW', label: `Low Risk (${counts.low})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRiskFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          riskFilter === tab.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAudit}
                      disabled={savingToCloud || isAuditing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {savingToCloud ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-800" />
                      )}
                      {savingToCloud ? 'Saving...' : 'Save Redacted Audit'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Report
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filteredClauses.map((clause, index) => (
                    <ClauseCard
                      key={clause.clauseId}
                      clause={clause}
                      index={index}
                      onDraftCounterClause={handleDraftCounterClause}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>ClauseGuard · Zero-Leakage Hybrid Contract Intelligence</span>
          <span>
            Unredacted MyKad, passport, phone, email, bank, and address records never leave your browser.
          </span>
        </div>
      </footer>

      <PhotoScannerModal
        open={scannerOpen}
        jurisdiction={jurisdiction}
        onClose={() => setScannerOpen(false)}
        onImportScannedText={(scannedTitle, extractedText) => {
          setTitle(scannedTitle);
          setRawText(extractedText);
          setClauses([]);
          setActiveSection('workspace');
        }}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={title}
        jurisdiction={jurisdiction}
        clauses={clauses}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ClauseGuardWorkspace />
    </ErrorBoundary>
  );
}
