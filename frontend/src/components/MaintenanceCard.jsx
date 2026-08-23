import React from 'react';
import {
  MapPin,
  User as UserIcon,
  Phone,
  Loader2,
  Wrench,
  MessageSquare,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDateTime } from '../lib/datetime';
import { CATEGORY_LABELS } from '../lib/maintenanceMeta';

const PRIORITY_STYLES = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

/**
 * One maintenance request. `mode` decides the footer:
 *   "mine"   — the filer: withdraw, reopen, close
 *   "queue"  — a worker: accept, resolve
 *   "admin"  — warden/admin: read-only summary plus reassign
 */
export default function MaintenanceCard({
  request: c,
  mode = 'mine',
  busy = false,
  onOpen,
  onWithdraw,
  onAccept,
  onResolve,
  onReopen,
  onClose,
}) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        c.hasUnreadUpdate ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {CATEGORY_LABELS[c.category] ?? c.category}
            </span>
            <span
              className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                PRIORITY_STYLES[c.priority] ?? PRIORITY_STYLES.MEDIUM
              }`}
            >
              {c.priority}
            </span>
            {c.hasUnreadUpdate && (
              <span className="rounded-lg bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                Update
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-1.5 text-left text-sm font-bold text-slate-900 hover:text-blue-700"
          >
            {c.title}
            <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5 text-slate-400" />
          </button>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
            {c.reference} · {formatDateTime(c.createdAt)}
          </p>
        </div>
        <StatusBadge status={c.status} />
      </header>

      {mode !== 'mine' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-800">{c.reporterName}</span>
          {c.reporterRollNumber && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-500">{c.reporterRollNumber}</span>
            </>
          )}
          {c.reporterPhone && (
            <>
              <span className="text-slate-300">·</span>
              <a href={`tel:${c.reporterPhone}`} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                <Phone className="h-3 w-3" /> {c.reporterPhone}
              </a>
            </>
          )}
        </div>
      )}

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">{c.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
          <MapPin className="h-3 w-3 text-slate-400" /> Room {c.roomNo}
          {c.locationDetail && <span className="font-normal text-slate-500">· {c.locationDetail}</span>}
        </span>
        {c.assigneeName && (
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-3 w-3 text-slate-400" /> {c.assigneeName}
          </span>
        )}
        {c.reopenCount > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
            <RotateCcw className="h-3 w-3" /> Reopened {c.reopenCount}×
          </span>
        )}
      </div>

      {c.resolutionNote && (
        <p className="mt-3 flex gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span>
            <span className="font-semibold">Resolution: </span>
            {c.resolutionNote}
          </span>
        </p>
      )}

      <footer className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Open
        </button>

        {mode === 'mine' && c.canWithdraw && (
          <ActionButton busy={busy} onClick={onWithdraw} variant="ghost">
            Withdraw
          </ActionButton>
        )}
        {mode === 'mine' && c.canReopen && (
          <ActionButton busy={busy} onClick={onReopen} variant="amber">
            Not fixed
          </ActionButton>
        )}
        {mode === 'mine' && c.canClose && (
          <ActionButton busy={busy} onClick={onClose} variant="emerald">
            Confirm fixed
          </ActionButton>
        )}

        {mode === 'queue' && c.canAccept && (
          <ActionButton busy={busy} onClick={onAccept} variant="blue">
            Accept
          </ActionButton>
        )}
        {mode === 'queue' && c.canResolve && (
          <ActionButton busy={busy} onClick={onResolve} variant="emerald">
            Mark resolved
          </ActionButton>
        )}
      </footer>
    </article>
  );
}

function ActionButton({ busy, onClick, variant, children }) {
  const styles = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    amber: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
    ghost: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 ${styles}`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
