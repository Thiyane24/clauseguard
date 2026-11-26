import React, { useRef, useState } from 'react';
import { Camera, FileText, Play, RotateCcw, Shield, Upload } from 'lucide-react';
import { redactPII } from '../lib/piiRedactor';
import type { Jurisdiction } from '../lib/types';

interface ContractInputPanelProps {
  title: string;
  onTitleChange: (title: string) => void;
  jurisdiction: Jurisdiction;
  onJurisdictionChange: (j: Jurisdiction) => void;
  rawText: string;
  onRawTextChange: (text: string) => void;
  onLoadSample: () => void;
  onOpenPhotoScanner: () => void;
  onRunAudit: () => void;
  onClear: () => void;
  isAuditing: boolean;
  onPdfExtract: (file: File) => Promise<void>;
  pdfLoading: boolean;
}

const JURISDICTIONS: Jurisdiction[] = [
  'Malaysia',
  'Singapore',
  'United Kingdom',
  'United States',
  'General',
];

export function ContractInputPanel({
  title,
  onTitleChange,
  jurisdiction,
  onJurisdictionChange,
  rawText,
  onRawTextChange,
  onLoadSample,
  onOpenPhotoScanner,
  onRunAudit,
  onClear,
  isAuditing,
  onPdfExtract,
  pdfLoading,
}: ContractInputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'raw' | 'redacted'>('raw');

  const previewRedaction = redactPII(rawText);
  const { breakdown } = previewRedaction;

  const piiParts = [
    { label: 'MyKad', count: breakdown.mykad },
    { label: 'Passports', count: breakdown.passport },
    { label: 'Emails', count: breakdown.email },
    { label: 'Phones', count: breakdown.phone },
    { label: 'Bank Accts', count: breakdown.bankAccount },
    { label: 'Addresses', count: breakdown.address },
    { label: 'Reg IDs', count: breakdown.regId + breakdown.card },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await onPdfExtract(file);
    } else {
      const content = await file.text();
      onTitleChange(file.name.replace(/\.[^.]+$/, ''));
      onRawTextChange(content);
    }
    e.target.value = '';
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Document Workbench
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Personal identifiers are masked deterministically in your browser before any cloud transmission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            disabled={isAuditing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            Load Sample Tenancy
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAuditing || pdfLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            {pdfLoading ? 'Extracting PDF...' : 'Upload PDF / TXT'}
          </button>

          <button
            type="button"
            onClick={onOpenPhotoScanner}
            disabled={isAuditing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5 text-slate-600" />
            Scan Contract Photo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="contract-title" className="block text-xs font-medium text-slate-700 mb-1.5">
            Agreement Title
          </label>
          <input
            id="contract-title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g., Residential Tenancy Agreement"
            className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
          />
        </div>

        <div>
          <label htmlFor="jurisdiction-select" className="block text-xs font-medium text-slate-700 mb-1.5">
            Governing Jurisdiction
          </label>
          <select
            id="jurisdiction-select"
            value={jurisdiction}
            onChange={(e) => onJurisdictionChange(e.target.value as Jurisdiction)}
            className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Formal PII Shield Summary Strip & Raw/Redacted Segmented Toggle */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
              <Shield className="w-3.5 h-3.5" />
              PII Shield
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-700">
              {rawText.length.toLocaleString()} chars
            </span>
            {piiParts.map((part) => (
              <React.Fragment key={part.label}>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    part.count > 0 ? 'text-emerald-800 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {part.count} {part.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div
            role="tablist"
            aria-label="Document view mode"
            className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-lg shrink-0 self-start md:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'raw'}
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'raw'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw Input
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'redacted'}
              onClick={() => setViewMode('redacted')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'redacted'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Redacted Preview (Safe Payload)
            </button>
          </div>
        </div>

        {viewMode === 'redacted' ? (
          <pre className="w-full h-60 overflow-y-auto p-4 text-xs font-mono leading-relaxed text-slate-800 bg-slate-50 border border-slate-300 rounded-lg whitespace-pre-wrap">
            {previewRedaction.redactedText || 'No contract text entered yet.'}
          </pre>
        ) : (
          <textarea
            id="contract-raw-input"
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value)}
            rows={10}
            placeholder="Paste tenancy, employment, or commercial agreement clauses here, upload a PDF locally, or scan a contract photo..."
            className="w-full h-60 resize-none p-4 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onClear}
          disabled={isAuditing || !rawText}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear Document
        </button>

        <button
          type="button"
          onClick={onRunAudit}
          disabled={isAuditing || rawText.trim().length < 20}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {isAuditing ? 'Auditing Clauses...' : 'Run Hybrid Audit'}
        </button>
      </div>
    </section>
  );
}
