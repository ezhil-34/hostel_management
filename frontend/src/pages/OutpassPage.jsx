import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  Loader2,
  Inbox,
  Ticket,
  X,
  AlertTriangle,
  QrCode as QrIcon,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { outpassApi } from '../lib/api';
import OutpassCard from '../components/OutpassCard';
import OutpassFormModal from '../components/OutpassFormModal';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../lib/datetime';

const REVIEWER_ROLES = ['WARDEN', 'ADMIN'];

export default function OutpassPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const canReview = REVIEWER_ROLES.includes(user?.role);

  const [mine, setMine] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('mine');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // --- loading -------------------------------------------------------------

  const load = useCallback(async () => {
    const [own, review] = await Promise.all([
      outpassApi.list(),
      canReview ? outpassApi.listForReview() : Promise.resolve({ outpasses: [] }),
    ]);
    setMine(own.outpasses);
    setQueue(review.outpasses);
  }, [canReview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load your outpasses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // The pass worth showing at the top: the one that is live or about to be.
  // An expired approved pass is not it — its QR no longer works.
  const activePass = useMemo(
    () =>
      mine.find((o) => o.status === 'ACTIVE' || (o.status === 'APPROVED' && !o.isExpired)) ?? null,
    [mine],
  );

  // Mirrors the server's rule: an expired PENDING/APPROVED pass is dead and no
  // longer occupies the slot, but an ACTIVE one blocks however late it is.
  const hasOpenPass = useMemo(
    () =>
      mine.some(
        (o) =>
          o.status === 'ACTIVE' ||
          (['PENDING', 'APPROVED'].includes(o.status) && !o.isExpired),
      ),
    [mine],
  );

  const visibleQueue = useMemo(
    () => (onlyOverdue ? queue.filter((o) => o.isOverdue) : queue),
    [queue, onlyOverdue],
  );

  const pendingCount = queue.filter((o) => o.status === 'PENDING').length;
  const overdueCount = queue.filter((o) => o.isOverdue).length;

  // --- actions -------------------------------------------------------------

  const handleCreate = async (payload) => {
    const { outpass, message } = await outpassApi.create(payload);
    setFormOpen(false);
    await load();
    toast.success('Request submitted', message);
    return outpass;
  };

  const handleCancel = async (outpass) => {
    const confirmed = await confirm({
      title: 'Cancel this outpass?',
      message:
        outpass.status === 'APPROVED'
          ? 'The QR code will stop working immediately and cannot be restored.'
          : 'It will be withdrawn from the warden queue.',
      confirmLabel: 'Cancel pass',
      cancelLabel: 'Keep it',
      tone: 'danger',
      details: {
        Destination: outpass.destination,
        Leaves: formatDateTime(outpass.leaveAt),
        Reference: outpass.reference,
      },
    });
    if (!confirmed) return;

    setBusyId(outpass.id);
    try {
      const { message } = await outpassApi.cancel(outpass.id);
      await load();
      toast.info('Outpass cancelled', message);
    } catch (err) {
      toast.error('Could not cancel', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReview = async (outpass, decision) => {
    const approving = decision === 'APPROVED';

    const confirmed = await confirm({
      title: approving ? 'Approve this outpass?' : 'Reject this outpass?',
      message: approving
        ? 'A QR code will be issued that the gate can scan to check the student out.'
        : 'The student will see the rejection and can raise a new request.',
      confirmLabel: approving ? 'Approve' : 'Reject',
      tone: approving ? 'primary' : 'danger',
      details: {
        Student: `${outpass.user.name} (${outpass.user.rollNumber})`,
        Destination: outpass.destination,
        Window: `${formatDateTime(outpass.leaveAt)} → ${formatDateTime(outpass.returnAt)}`,
      },
    });
    if (!confirmed) return;

    setBusyId(outpass.id);
    try {
      const { message } = await outpassApi.review(outpass.id, { decision });
      await load();
      if (approving) toast.success('Outpass approved', message);
      else toast.info('Outpass rejected', message);
    } catch (err) {
      toast.error(approving ? 'Could not approve' : 'Could not reject', err.message);
    } finally {
      setBusyId(null);
    }
  };

  // --- render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'mine', label: 'My Passes', Icon: Ticket },
    ...(canReview
      ? [{ id: 'review', label: 'Approvals', Icon: Inbox, count: pendingCount + overdueCount }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" /> Back to Dashboard
          </Link>
          <h1 className="order-last w-full text-xl font-bold sm:order-none sm:w-auto">
            Outpass Management
          </h1>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={hasOpenPass}
            title={hasOpenPass ? 'You already have an open pass' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Request Outpass
          </button>
        </div>

        {TABS.length > 1 && (
          <nav className="mx-auto max-w-5xl overflow-x-auto px-4 sm:px-6">
            <div className="flex gap-1">
              {TABS.map(({ id, label, Icon, count }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                    tab === id
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* ------------------------------------------------------- My Passes */}
        {tab === 'mine' && (
          <>
            {activePass && (
              <section
                className={`mb-8 rounded-2xl p-6 text-white shadow-md ${
                  activePass.isOverdue
                    ? 'bg-gradient-to-r from-red-600 to-red-700'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700'
                }`}
              >
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                  <div className="min-w-0 text-center md:text-left">
                    <StatusBadge
                      status={activePass.status}
                      overdue={activePass.isOverdue}
                      overdueByMinutes={activePass.overdueByMinutes}
                    />
                    <h2 className="mt-2 text-2xl font-bold">{activePass.destination}</h2>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-white/80 md:justify-start">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> {formatDateTime(activePass.leaveAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" /> back by {formatDateTime(activePass.returnAt)}
                      </span>
                    </div>
                    {activePass.isOverdue && (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        You are past your return time — check in at the gate.
                      </p>
                    )}
                  </div>

                  {activePass.qrUrl ? (
                    <button
                      type="button"
                      onClick={() => setQrOpen(true)}
                      className="flex shrink-0 cursor-pointer flex-col items-center rounded-2xl bg-white p-3 shadow-lg transition-transform hover:scale-105"
                    >
                      <QRCode value={activePass.qrUrl} size={112} level="M" />
                      <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-900">
                        <QrIcon className="h-3 w-3 text-blue-600" /> Show at gate
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {activePass.reference}
                      </span>
                    </button>
                  ) : (
                    <div className="shrink-0 rounded-2xl bg-white/10 p-6 text-center text-xs">
                      Waiting for approval
                    </div>
                  )}
                </div>
              </section>
            )}

            <h3 className="mb-4 text-lg font-bold text-slate-800">
              {activePass ? 'All your passes' : 'Your passes'}
            </h3>

            {mine.length === 0 ? (
              <EmptyState
                Icon={Ticket}
                title="No outpasses yet"
                message="Request one and a warden will review it. Once approved you get a QR code to show at the gate."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {mine.map((o) => (
                  <OutpassCard
                    key={o.id}
                    outpass={o}
                    mode="mine"
                    busy={busyId === o.id}
                    onCancel={() => handleCancel(o)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------------- Approvals */}
        {tab === 'review' && canReview && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">Review queue</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyOverdue}
                  onChange={(e) => setOnlyOverdue(e.target.checked)}
                  className="h-3.5 w-3.5 accent-red-600"
                />
                Overdue only
                {overdueCount > 0 && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                    {overdueCount}
                  </span>
                )}
              </label>
            </div>

            {visibleQueue.length === 0 ? (
              <EmptyState
                Icon={Inbox}
                title={onlyOverdue ? 'Nobody is overdue' : 'Queue is empty'}
                message={
                  onlyOverdue
                    ? 'Every student who is out is still within their return window.'
                    : 'Outpass requests from students will appear here for review.'
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleQueue.map((o) => (
                  <OutpassCard
                    key={o.id}
                    outpass={o}
                    mode="review"
                    busy={busyId === o.id}
                    onApprove={() => handleReview(o, 'APPROVED')}
                    onReject={() => handleReview(o, 'REJECTED')}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {formOpen && (
        <OutpassFormModal
          defaultRoomNo={user?.roomNo ?? ''}
          onClose={() => setFormOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* Enlarged QR for the gate to scan */}
      {qrOpen && activePass?.qrUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Outpass QR code"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <StatusBadge status={activePass.status} overdue={activePass.isOverdue} />
            <h2 className="mt-2 text-lg font-bold text-slate-900">{activePass.destination}</h2>
            <p className="font-mono text-xs text-slate-400">{activePass.reference}</p>

            <div className="my-5 flex justify-center">
              <QRCode value={activePass.qrUrl} size={220} level="M" />
            </div>

            <p className="text-xs text-slate-500">
              The gate scans this to check you {activePass.status === 'ACTIVE' ? 'back in' : 'out'}.
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Back by {formatDateTime(activePass.returnAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ Icon, title, message }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{message}</p>
    </div>
  );
}
