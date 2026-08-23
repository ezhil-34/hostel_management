import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  Send,
  User as UserIcon,
  Phone,
  MapPin,
  Wrench,
  Lock,
  Clock,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { CATEGORY_LABELS } from '../lib/maintenanceMeta';
import { formatDateTime } from '../lib/datetime';

const EVENT_LABELS = {
  REPORTED: 'reported this fault',
  ACCEPTED: 'picked it up',
  RESOLVED: 'marked it fixed',
  REOPENED: 'said it is still broken',
  CLOSED: 'confirmed the fix',
  WITHDRAWN: 'withdrew it',
  REASSIGNED: 'reassigned it',
  COMMENTED: 'commented',
};

export default function MaintenanceDetailModal({
  detail,
  loading,
  canLeaveInternal,
  onClose,
  onComment,
}) {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadEnd = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose, sending]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [detail?.comments?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError('');
    setSending(true);
    try {
      await onComment({ body, isInternal });
      setBody('');
      setIsInternal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const c = detail?.request;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !sending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Maintenance request detail"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        {loading || !c ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={c.status} />
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-bold text-slate-900">{c.title}</h2>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {c.reference} · {formatDateTime(c.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">{c.reporterName}</span>
                </span>
                {c.reporterPhone && (
                  <a
                    href={`tel:${c.reporterPhone}`}
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {c.reporterPhone}
                  </a>
                )}
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" /> Room {c.roomNo}
                  {c.locationDetail && (
                    <span className="font-normal text-slate-500">· {c.locationDetail}</span>
                  )}
                </span>
                {c.assigneeName && (
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="h-3.5 w-3.5 text-slate-400" /> {c.assigneeName}
                  </span>
                )}
              </div>

              <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {c.description}
              </p>

              {c.resolutionNote && (
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-semibold text-emerald-800">Resolution</p>
                  <p className="mt-1 text-sm leading-relaxed text-emerald-900">{c.resolutionNote}</p>
                </div>
              )}

              {/* Timeline */}
              {detail.events?.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Timeline
                  </h3>
                  <ol className="space-y-1.5">
                    {detail.events.map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-xs text-slate-500">
                        <Clock className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
                        <span>
                          <span className="font-semibold text-slate-700">{e.actorName}</span>{' '}
                          {EVENT_LABELS[e.type] ?? e.type.toLowerCase()}
                          <span className="text-slate-400"> · {formatDateTime(e.createdAt)}</span>
                          {e.note && (
                            <span className="mt-0.5 block italic text-slate-500">“{e.note}”</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Thread */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Messages
                </h3>
                {detail.comments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                    No messages yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.comments.map((m) => (
                      <li
                        key={m.id}
                        className={`rounded-xl p-3 ${
                          m.isInternal
                            ? 'border border-amber-200 bg-amber-50'
                            : m.isMine
                              ? 'bg-blue-50'
                              : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="font-semibold text-slate-800">{m.authorName}</span>
                          <span className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-500">
                            {m.authorRole.replace('_', ' ').toLowerCase()}
                          </span>
                          {m.isInternal && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 font-bold text-amber-900">
                              <Lock className="h-2.5 w-2.5" /> internal
                            </span>
                          )}
                          <span className="text-slate-400">{formatDateTime(m.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {m.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div ref={threadEnd} />
              </section>
            </div>

            {['CLOSED', 'WITHDRAWN'].includes(c.status) ? (
              <p className="border-t border-slate-100 p-4 text-center text-xs font-semibold text-slate-500">
                This request is {c.status.toLowerCase()} — the thread is closed.
              </p>
            ) : (
              <form onSubmit={send} className="border-t border-slate-100 p-4">
                {error && (
                  <p role="alert" className="mb-2 text-xs font-medium text-red-600">
                    {error}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    maxLength={2000}
                    placeholder="Write a message…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full resize-none rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !body.trim()}
                    aria-label="Send message"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {canLeaveInternal && (
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-600"
                    />
                    <Lock className="h-3 w-3 text-amber-600" />
                    Internal note — the student will not see this
                  </label>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
