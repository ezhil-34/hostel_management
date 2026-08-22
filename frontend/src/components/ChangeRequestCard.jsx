import React from 'react';
import { ArrowRight, Loader2, MessageSquare, User as UserIcon } from 'lucide-react';
import StatusBadge from './StatusBadge';

const formatDate = (value) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * One change request. `mode` decides the footer:
 *   "mine"   — the owner sees a Cancel button while it is pending
 *   "review" — a warden/admin sees Approve and Reject
 */
export default function ChangeRequestCard({
  request,
  label,
  mode = 'mine',
  busy = false,
  onCancel,
  onApprove,
  onReject,
}) {
  const isPending = request.status === 'PENDING';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{label ?? request.field}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
            {request.reference} · {formatDate(request.createdAt)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </header>

      {mode === 'review' && request.user && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-800">{request.user.name}</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500">{request.user.rollNumber}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-500 line-through">
          {request.oldValue || 'not set'}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
          {request.newValue}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-500">Reason: </span>
        {request.reason}
      </p>

      {request.reviewNote && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            <span className="font-semibold text-slate-500">
              {request.reviewer?.name ?? 'Reviewer'}:{' '}
            </span>
            {request.reviewNote}
          </span>
        </p>
      )}

      {isPending && (
        <footer className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {mode === 'mine' ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Cancel request
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onApprove}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Approve
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                Reject
              </button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}
