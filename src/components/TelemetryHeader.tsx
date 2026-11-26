import { useEffect, useState } from 'react';
import { Cpu, Download, ShieldCheck, Wallet, Wifi, WifiOff } from 'lucide-react';
import type { ClauseAuditItem, NanoAvailability } from '../lib/types';

interface TelemetryHeaderProps {
  nanoAvailability: NanoAvailability;
  downloadProgress: number | null;
  onDownloadNano: () => void;
  clauses: ClauseAuditItem[];
  piiTotal: number;
}

export function TelemetryHeader({
  nanoAvailability,
  downloadProgress,
  onDownloadNano,
  clauses,
  piiTotal,
}: TelemetryHeaderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const completed = clauses.filter((c) => c.status === 'completed');
  const onDeviceCount = completed.filter((c) => c.inferenceSource === 'ON_DEVICE').length;
  const inCloudCount = completed.filter((c) => c.inferenceSource === 'IN_CLOUD').length;
  const counterClauseCount = completed.filter((c) => Boolean(c.counterClause)).length;
  const estimatedCloudBaseline = completed.length * 0.004;
  const estimatedActualSpend = inCloudCount * 0.002 + counterClauseCount * 0.004;
  const estimatedSavings = Math.max(0, estimatedCloudBaseline - inCloudCount * 0.002);

  const nanoLabel = (() => {
    switch (nanoAvailability) {
      case 'available':
        return 'Gemini Nano Ready';
      case 'downloadable':
        return 'Model Downloadable';
      case 'downloading':
        return downloadProgress !== null
          ? `Downloading ${Math.round(downloadProgress * 100)}%`
          : 'Downloading Model';
      case 'unavailable':
        return 'Hardware Fallback';
      case 'unsupported':
      default:
        return 'Cloud Fallback Active';
    }
  })();

  return (
    <section
      aria-label="Hybrid compute and privacy telemetry"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">On-Device Engine</span>
          <Cpu className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
            {nanoLabel}
          </span>
          {nanoAvailability === 'downloadable' && (
            <button
              type="button"
              onClick={onDownloadNano}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Get Model
            </button>
          )}
        </div>
        {nanoAvailability === 'downloading' && downloadProgress !== null && (
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.round(downloadProgress * 100))}%` }}
            />
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Connectivity</span>
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-800 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-800 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md border whitespace-nowrap ${
              isOnline
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-amber-800 bg-amber-50 border-amber-200'
            }`}
          >
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Hybrid Inference Split</span>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {completed.length}/{clauses.length}
          </span>
        </div>
        <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
          <span className="text-base font-semibold text-emerald-800">
            {onDeviceCount} Local
          </span>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-medium text-slate-700">{inCloudCount} Cloud</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Local PII Shield</span>
          <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
            {piiTotal}
          </span>
          <span className="text-xs text-slate-500">entities masked</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Compute Cost Meter</span>
          <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
          <span className="text-lg font-semibold text-slate-900">
            ${onDeviceCount > 0 && inCloudCount === 0 && counterClauseCount === 0
              ? '0.000'
              : estimatedActualSpend.toFixed(3)}
          </span>
          <span className="text-xs text-emerald-800 font-medium">
            {onDeviceCount > 0
              ? `$${estimatedSavings.toFixed(3)} saved`
              : '$0.00 local'}
          </span>
        </div>
      </div>
    </section>
  );
}
