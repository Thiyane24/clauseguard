import { useState } from 'react';
import { Check, Copy, Download, FileImage, X } from 'lucide-react';
import type { ClauseAuditItem, Jurisdiction } from '../lib/types';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  jurisdiction: Jurisdiction;
  clauses: ClauseAuditItem[];
}

function buildMarkdownReport(
  title: string,
  jurisdiction: Jurisdiction,
  clauses: ClauseAuditItem[],
): string {
  const completed = clauses.filter((c) => c.status === 'completed');
  const highCount = completed.filter((c) => c.riskLevel === 'HIGH').length;
  const medCount = completed.filter((c) => c.riskLevel === 'MEDIUM').length;
  const lowCount = completed.filter((c) => c.riskLevel === 'LOW').length;
  const piiTotal = clauses.reduce((sum, c) => sum + c.piiItemsRemoved, 0);
  const onDevice = completed.filter((c) => c.inferenceSource === 'ON_DEVICE').length;

  const lines: string[] = [
    `# ClauseGuard Redacted Audit Report: ${title || 'Untitled Contract'}`,
    '',
    `- **Jurisdiction:** ${jurisdiction}`,
    `- **Clauses Audited:** ${completed.length} (${highCount} High · ${medCount} Medium · ${lowCount} Low)`,
    `- **PII Identifiers Scrubbed Locally:** ${piiTotal}`,
    `- **On-Device Inferences:** ${onDevice} / ${completed.length}`,
    '',
    '---',
    '',
  ];

  completed.forEach((c, idx) => {
    lines.push(`## ${idx + 1}. ${c.clauseTitle}`);
    lines.push(
      `**Risk:** ${c.riskLevel} · **Source:** ${c.inferenceSource} · **PII Masked:** ${c.piiItemsRemoved}`,
    );
    lines.push('');
    lines.push(c.plainEnglishSummary);
    if (c.redFlags.length > 0) {
      lines.push('');
      lines.push('**Red Flags:**');
      c.redFlags.forEach((flag) => lines.push(`- ${flag}`));
    }
    if (c.counterClause) {
      lines.push('');
      lines.push(`**Legal Concern:** ${c.counterClause.legal_concern}`);
      lines.push('');
      lines.push('**Suggested Counter-Clause:**');
      lines.push(`> ${c.counterClause.suggested_counter_clause}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function buildSvgSummaryExhibit(
  title: string,
  jurisdiction: Jurisdiction,
  clauses: ClauseAuditItem[],
): string {
  const completed = clauses.filter((c) => c.status === 'completed');
  const high = completed.filter((c) => c.riskLevel === 'HIGH').length;
  const med = completed.filter((c) => c.riskLevel === 'MEDIUM').length;
  const low = completed.filter((c) => c.riskLevel === 'LOW').length;
  const pii = clauses.reduce((s, c) => s + c.piiItemsRemoved, 0);
  const safeTitle =
    title.replace(/[\x00-\x1f<>&"']/g, '').trim().slice(0, 56) || 'Contract Risk Exhibit';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
  <rect width="800" height="420" fill="#F8FAFC" rx="12"/>
  <rect x="32" y="32" width="736" height="356" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="64" y="82" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#475569">CLAUSEGUARD PRIVACY-FIRST AUDIT EXHIBIT · ${jurisdiction.toUpperCase()}</text>
  <text x="64" y="118" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#0F172A">${safeTitle}</text>
  <line x1="64" y1="146" x2="736" y2="146" stroke="#E2E8F0"/>
  <text x="64" y="196" font-family="monospace" font-size="36" font-weight="700" fill="#DC2626">${high}</text>
  <text x="64" y="222" font-family="system-ui, sans-serif" font-size="13" fill="#475569">High Risk Clauses</text>
  <text x="240" y="196" font-family="monospace" font-size="36" font-weight="700" fill="#D97706">${med}</text>
  <text x="240" y="222" font-family="system-ui, sans-serif" font-size="13" fill="#475569">Medium Risk</text>
  <text x="410" y="196" font-family="monospace" font-size="36" font-weight="700" fill="#16A34A">${low}</text>
  <text x="410" y="222" font-family="system-ui, sans-serif" font-size="13" fill="#475569">Low Risk</text>
  <text x="580" y="196" font-family="monospace" font-size="36" font-weight="700" fill="#1D4ED8">${pii}</text>
  <text x="580" y="222" font-family="system-ui, sans-serif" font-size="13" fill="#475569">PII Scrubbed Locally</text>
  <rect x="64" y="266" width="672" height="84" fill="#F8FAFC" stroke="#E2E8F0" rx="8"/>
  <text x="84" y="302" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#0F172A">Zero Unredacted PII Transmitted</text>
  <text x="84" y="328" font-family="system-ui, sans-serif" font-size="13" fill="#475569">MyKad, passport, phone, email, and bank account tokens masked prior to negotiation drafting.</text>
</svg>`;
}

export function ExportModal({ open, onClose, title, jurisdiction, clauses }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const markdown = buildMarkdownReport(title, jurisdiction, clauses);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'clauseguard-audit').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    const svg = buildSvgSummaryExhibit(title, jurisdiction, clauses);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'clauseguard-exhibit').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="export-modal-title" className="text-lg font-semibold text-slate-900">
            Export Redacted Negotiation Report
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <pre className="p-4 text-xs font-mono leading-relaxed text-slate-800 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap">
            {markdown}
          </pre>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileImage className="w-3.5 h-3.5" />
            Download Risk Exhibit (.svg)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Markdown' : 'Copy Markdown'}
            </button>
            <button
              type="button"
              onClick={handleDownloadMd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download .md Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
