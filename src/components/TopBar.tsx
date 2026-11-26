import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';

export type ActiveSection = 'workspace' | 'scanner' | 'saved';

interface TopBarProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  onOpenExport: () => void;
  user: User;
  authLoading: boolean;
  onSignOut: () => void;
}

function getInitials(user: User): string {
  if (user.isAnonymous) return 'GR';
  const name = user.displayName || user.email || 'CG';
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TopBar({
  activeSection,
  onNavigate,
  onOpenExport,
  user,
  authLoading,
  onSignOut,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = user.isAnonymous
    ? 'Guest Session'
    : user.displayName || user.email || 'Workspace User';

  const secondaryLabel = user.isAnonymous
    ? 'Anonymous Reviewer'
    : user.email || 'Authenticated Account';

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('workspace')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900 rounded"
        >
          ClauseGuard
        </button>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onNavigate('workspace')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-slate-900 ${
              activeSection === 'workspace'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : ''
            }`}
          >
            Audit Workspace
          </button>
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-slate-900 ${
              activeSection === 'scanner'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : ''
            }`}
          >
            Photo Scan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('saved')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-slate-900 ${
              activeSection === 'saved'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : ''
            }`}
          >
            Saved Audits
          </button>
          <button
            type="button"
            onClick={onOpenExport}
            className="py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-slate-900"
          >
            Export Report
          </button>
        </nav>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayLabel}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-md object-cover border border-slate-200"
              />
            ) : (
              <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center">
                {getInitials(user)}
              </span>
            )}
            <span className="max-w-[140px] truncate">{displayLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-sm py-2 z-40"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 truncate">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{displayLabel}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate pl-5">
                  {secondaryLabel}
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                disabled={authLoading}
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="w-full px-4 py-2 text-left text-xs font-medium text-red-800 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
