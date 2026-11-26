import { useState } from 'react';
import { FolderOpen, Search, Trash2 } from 'lucide-react';
import type { SavedAuditSummary } from '../lib/types';

interface SavedAuditsPanelProps {
  audits: SavedAuditSummary[];
  loading: boolean;
  isSignedIn: boolean;
  onSignIn: () => void;
  onLoadAudit: (audit: SavedAuditSummary) => void;
  onDeleteAudit: (auditId: string) => void;
}

export function SavedAuditsPanel({
  audits,
  loading,
  isSignedIn,
  onSignIn,
  onLoadAudit,
  onDeleteAudit,
}: SavedAuditsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isSignedIn) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Sign in to access saved redacted audits
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          ClauseGuard stores only scrubbed clause summaries and counter-clauses in your private Firestore workspace. Unredacted PII never leaves your device.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          Sign In
        </button>
      </section>
    );
  }

  const filtered = audits.filter((a) =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.jurisdiction.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Saved Contract Audits</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Redacted clause assessments persisted under your authenticated workspace.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter saved audits..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 rounded-lg">
          <p className="text-sm font-medium text-slate-700">No saved audits found</p>
          <p className="text-xs text-slate-500">
            Run a hybrid contract audit in the workspace and click Save Redacted Audit.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-4">Document</th>
                <th className="py-2.5 px-3">Jurisdiction</th>
                <th className="py-2.5 px-3 text-right">Clauses</th>
                <th className="py-2.5 px-3 text-right">High Risk</th>
                <th className="py-2.5 px-3 text-right">PII Scrubbed</th>
                <th className="py-2.5 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((audit) => (
                <tr key={audit.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-slate-900">{audit.title}</td>
                  <td className="py-3 px-3 text-slate-600">{audit.jurisdiction}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {audit.totalClauses}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-red-800 font-semibold">
                    {audit.highRiskCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-800">
                    {audit.piiItemsRemoved}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onLoadAudit(audit)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAudit(audit.id)}
                        aria-label={`Delete ${audit.title}`}
                        className="p-1.5 text-slate-500 hover:text-red-800 rounded-md hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
