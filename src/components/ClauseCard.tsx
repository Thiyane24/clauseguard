import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileWarning,
  Loader2,
  Scale,
} from 'lucide-react';
import type { ClauseAuditItem, RiskLevel } from '../lib/types';

interface ClauseCardProps {
  clause: ClauseAuditItem;
  index: number;
  onDraftCounterClause: (clauseId: string) => void;
}

function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  if (riskLevel === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-md whitespace-nowrap">
        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
        HIGH RISK
      </span>
    );
  }
  if (riskLevel === 'MEDIUM') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        MEDIUM RISK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      LOW RISK
    </span>
  );
}

export function ClauseCard({ clause, index, onDraftCounterClause }: ClauseCardProps) {
  const [showRedacted, setShowRedacted] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCounter = async () => {
    if (!clause.counterClause) return;
    await navigator.clipboard.writeText(clause.counterClause.suggested_counter_clause);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (clause.status === 'analyzing' || clause.status === 'pending') {
    return (
      <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span aria-hidden="true">·</span>
            <span>{clause.rawTitle}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {clause.status === 'analyzing' ? 'Auditing clause...' : 'Queued'}
          </span>
        </div>
        <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
        <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
      </article>
    );
  }

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
          <span className="font-mono tabular-nums font-semibold text-slate-800">
            Clause {String(index + 1).padStart(2, '0')}
          </span>
          <RiskBadge riskLevel={clause.riskLevel} />
          <span
            className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-medium whitespace-nowrap ${
              clause.inferenceSource === 'ON_DEVICE'
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-slate-700 bg-slate-100 border-slate-200'
            }`}
          >
            {clause.inferenceSource === 'ON_DEVICE' ? 'ON_DEVICE' : 'IN_CLOUD'}
          </span>
          <span className="font-mono tabular-nums text-slate-500">
            {clause.piiItemsRemoved} PII masked
          </span>
          {typeof clause.latencyMs === 'number' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500">
                {clause.latencyMs}ms
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDraftCounterClause(clause.clauseId)}
          disabled={Boolean(clause.counterClauseLoading)}
          aria-busy={Boolean(clause.counterClauseLoading)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          {clause.counterClauseLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Drafting Redline...
            </>
          ) : (
            <>
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              {clause.counterClause
                ? 'Regenerate Counter-Clause'
                : 'Draft Counter-Clause (Cloud)'}
            </>
          )}
        </button>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">{clause.clauseTitle}</h3>
        {clause.errorMessage ? (
          <p className="text-sm text-red-800 mt-1.5">{clause.errorMessage}</p>
        ) : (
          <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
            {clause.plainEnglishSummary}
          </p>
        )}
      </div>

      {clause.redFlags.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {clause.redFlags.map((flag, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <FileWarning className="w-3.5 h-3.5 text-red-800 mt-0.5 shrink-0" />
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      )}

      {!clause.counterClause && (
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowRedacted((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showRedacted ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Hide Redacted Clause Source
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Inspect Redacted Clause Source
              </>
            )}
          </button>

          {showRedacted && (
            <pre className="mt-3 p-3.5 text-xs font-mono leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap">
              {clause.redactedText}
            </pre>
          )}
        </div>
      )}

      {clause.counterClauseError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
          {clause.counterClauseError}
        </div>
      )}

      {clause.counterClause && (
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                Redline Comparison
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                {clause.counterClause.inference_source}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500">
                {clause.counterClause.pii_items_removed} server PII scrubbed
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCounter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-800" />
                  Copied Clause
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Clause
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
            <span className="font-semibold text-amber-900">Legal Concern: </span>
            {clause.counterClause.legal_concern}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">
                Original Clause (Redacted)
              </div>
              <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono leading-relaxed text-slate-700 whitespace-pre-wrap h-full">
                {clause.redactedText}
              </pre>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-emerald-800">
                Recommended Fair Clause
              </div>
              <pre className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs font-mono leading-relaxed text-slate-900 whitespace-pre-wrap h-full">
                {clause.counterClause.suggested_counter_clause}
              </pre>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
