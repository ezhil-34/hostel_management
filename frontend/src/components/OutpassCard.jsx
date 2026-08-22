import React from 'react';
import { Calendar, Clock, MapPin, User as UserIcon, Home, MessageSquare, Loader2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDateTime } from '../lib/datetime';

/**
 * One outpass. `mode` decides the footer:
 *   "mine"   — the owner can cancel while PENDING or APPROVED
 *   "review" — a warden/admin can approve or reject a PENDING pass
 */
export default function OutpassCard({ outpass, mode = 'mine', busy = false, onCancel, onApprove, onReject }) {
  // An expired pass is already dead — nothing left to cancel or approve.
  const canCancel = ['PENDING', 'APPROVED'].includes(outpass.status) && !outpass.isExpired;
  const canReview = outpass.status === 'PENDING' && !outpass.isExpired;
  const showFooter = mode === 'mine' ? canCancel : canReview;

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        outpass.isOverdue ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'
      } ${outpass.isExpired ? 'opacity-70' : ''}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            {outpass.destination}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{outpass.reference}</p>
        </div>
        <StatusBadge
          status={outpass.status}
          overdue={outpass.isOverdue}
          expired={outpass.isExpired}
          overdueByMinutes={outpass.overdueByMinutes}
        />
      </header>

      {mode === 'review' && outpass.user && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-800">{outpass.user.name}</span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-slate-500">{outpass.user.rollNumber}</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Home className="h-3 w-3" /> {outpass.roomNo}
          </span>
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-semibold text-slate-500">Leaves</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-medium text-slate-800">
            <Calendar className="h-3 w-3 text-slate-400" />
            {formatDateTime(outpass.leaveAt)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Returns</dt>
          <dd
            className={`mt-0.5 flex items-center gap-1 font-medium ${
              outpass.isOverdue ? 'text-red-700' : 'text-slate-800'
            }`}
          >
            <Clock className="h-3 w-3 text-slate-400" />
            {formatDateTime(outpass.returnAt)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-500">Reason: </span>
        {outpass.reason}
      </p>

      {(outpass.exitedAt || outpass.returnedAt) && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {outpass.exitedAt && (
            <span>
              <span className="font-semibold text-slate-500">Out: </span>
              {formatDateTime(outpass.exitedAt)}
            </span>
          )}
          {outpass.returnedAt && (
            <span>
              <span className="font-semibold text-slate-500">In: </span>
              {formatDateTime(outpass.returnedAt)}
            </span>
          )}
        </p>
      )}

      {outpass.reviewNote && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            <span className="font-semibold text-slate-500">
              {outpass.reviewer?.name ?? 'Warden'}:{' '}
            </span>
            {outpass.reviewNote}
          </span>
        </p>
      )}

      {showFooter && (
        <footer className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {mode === 'mine' ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Cancel pass
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
