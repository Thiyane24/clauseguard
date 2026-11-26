import React, { useState } from 'react';
import { Camera, CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { redactPII } from '../lib/piiRedactor';
import type { Jurisdiction } from '../lib/types';

interface PhotoScannerModalProps {
  open: boolean;
  jurisdiction: Jurisdiction;
  onClose: () => void;
  onImportScannedText: (title: string, extractedText: string) => void;
}

interface ScanResponse {
  documentTitle: string;
  visualObservations: string[];
  extractedText: string;
  piiItemsRemoved: number;
}

export function PhotoScannerModal({
  open,
  jurisdiction,
  onClose,
  onImportScannedText,
}: PhotoScannerModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);

  if (!open) return null;

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setScanResult(null);

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please upload a PNG, JPEG, or WebP photograph of the contract page.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be under 5 MB.');
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreviewUrl(dataUrl);
      const base64 = dataUrl.split(',')[1] || '';
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzePhoto = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/analyze-contract-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64,
          mimeType,
          jurisdiction,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail || 'Image analysis failed.');
      }

      const data = (await res.json()) as ScanResponse;
      setScanResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze contract photo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-scanner-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-slate-900" />
            <h2 id="photo-scanner-title" className="text-lg font-semibold text-slate-900">
              Scan Physical Contract Page
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Upload a clear photo or scan of a printed contract page. ClauseGuard extracts numbered clauses and immediately scrubs personal identifiers before importing them into your audit.
        </p>

        <label className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
          <Upload className="w-5 h-5 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            Select Contract Photo (PNG, JPEG, WebP)
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFilePick}
            className="hidden"
          />
        </label>

        {previewUrl && (
          <div className="space-y-3">
            <img
              src={previewUrl}
              alt="Uploaded contract page preview"
              referrerPolicy="no-referrer"
              className="max-h-56 w-full object-contain bg-slate-100 border border-slate-200 rounded-lg"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnalyzePhoto}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Extracting Clauses...' : 'Analyze & Scrub Photo'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {error}
          </div>
        )}

        {scanResult && (
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                {scanResult.documentTitle}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {scanResult.piiItemsRemoved} PII scrubbed
              </span>
            </div>

            {scanResult.visualObservations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">Visual Observations</p>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                  {scanResult.visualObservations.map((obs, idx) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              </div>
            )}

            <pre className="max-h-48 overflow-y-auto p-3 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap">
              {scanResult.extractedText}
            </pre>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const scrubbed = redactPII(scanResult.extractedText).redactedText;
                  onImportScannedText(scanResult.documentTitle, scrubbed);
                  onClose();
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Import into Audit Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
