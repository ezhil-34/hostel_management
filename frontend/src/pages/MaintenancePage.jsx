import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Inbox,
  MessageSquare,
  ClipboardList,
  RefreshCw,
  ServerCrash,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { maintenanceApi, ApiRequestError } from '../lib/api';
import MaintenanceCard from '../components/MaintenanceCard';
import { CATEGORY_LABELS } from '../lib/maintenanceMeta';
import MaintenanceFormModal from '../components/MaintenanceFormModal';
import MaintenanceDetailModal from '../components/MaintenanceDetailModal';
import NotePromptModal from '../components/NotePromptModal';

const WORKER_ROLES = ['MAINTENANCE_WORKER'];
const OVERSIGHT_ROLES = ['WARDEN', 'ADMIN'];

const STATUS_FILTERS = ['ALL', 'OPEN', 'ACCEPTED', 'RESOLVED', 'CLOSED', 'WITHDRAWN'];

export default function MaintenancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const isWorker = WORKER_ROLES.includes(user?.role);
  const isOversight = OVERSIGHT_ROLES.includes(user?.role);
  const canLeaveInternal = isWorker || isOversight;

  /**
   * Land everyone on the tab that is about their job. Wardens and admins
   * almost never file faults themselves, so defaulting them to "My Requests"
   * showed an empty page that reads as a broken feature. ProtectedRoute blocks
   * until the session has loaded, so `user` is populated when this runs.
   */
  const [tab, setTab] = useState(() => {
    if (isWorker) return 'queue';
    if (isOversight) return 'all';
    return 'mine';
  });
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');

  const [mine, setMine] = useState([]);
  const [queue, setQueue] = useState([]);
  const [all, setAll] = useState([]);
  const [counts, setCounts] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  /**
   * The job awaiting a written note, and which action wants it. Resolve and
   * reopen both need a sentence before they can go through; this drives the
   * NotePromptModal that asks for it.
   */
  const [notePrompt, setNotePrompt] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // --- loading -------------------------------------------------------------

  const load = useCallback(async () => {
    const filters = { status, category };
    const [own, work, admin] = await Promise.all([
      maintenanceApi.list(filters),
      isWorker || isOversight ? maintenanceApi.queue(filters) : Promise.resolve({ requests: [] }),
      isOversight ? maintenanceApi.listAll(filters) : Promise.resolve({ requests: [], counts: {} }),
    ]);
    setMine(own.requests);
    setQueue(work.requests);
    setAll(admin.requests);
    setCounts(admin.counts ?? {});
  }, [status, category, isWorker, isOversight]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) setLoadError('');
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not reach the maintenance service. Is it running?',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const unreadCount = useMemo(() => mine.filter((c) => c.hasUnreadUpdate).length, [mine]);
  const openCount = useMemo(() => queue.filter((c) => c.status === 'OPEN').length, [queue]);

  // --- actions -------------------------------------------------------------

  const handleCreate = async (payload) => {
    const { request, message, snapshotUnavailable } = await maintenanceApi.create(payload);
    setFormOpen(false);
    await load();
    toast.success('Reported', message);
    if (snapshotUnavailable) {
      toast.warning(
        'Logged without your details',
        'The profile service was unreachable, so your name and phone are missing. The request itself is safe.',
      );
    }
    return request;
  };

  const openDetail = async (request) => {
    setDetailLoading(true);
    setDetail({ request, comments: [], events: [] });
    try {
      const data = await maintenanceApi.get(request.id);
      setDetail(data);
      // Opening clears the badge server-side; reflect that here.
      if (request.hasUnreadUpdate) await load();
    } catch (err) {
      toast.error('Could not open', err.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleComment = async (payload) => {
    const { comment } = await maintenanceApi.comment(detail.request.id, payload);
    setDetail((d) => ({ ...d, comments: [...d.comments, comment] }));
  };

  /** Every mutation funnels through here so busy state and reload are uniform. */
  const run = async (request, action, { success, failure }) => {
    setBusyId(request.id);
    try {
      const result = await action();
      await load();
      if (detail?.request?.id === request.id) {
        const fresh = await maintenanceApi.get(request.id);
        setDetail(fresh);
      }
      toast.success(success, result?.message);
    } catch (err) {
      toast.error(failure, err.message);
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Completes whichever action asked for a written note. The dialog closes
   * only on success, so a failure leaves what was typed on screen to retry
   * rather than throwing the note away.
   */
  const handleNoteSubmit = async (text) => {
    const { request, submit, success, failure } = notePrompt;
    setBusyId(request.id);
    try {
      const result = await submit(text);
      await load();
      if (detail?.request?.id === request.id) setDetail(await maintenanceApi.get(request.id));
      toast.success(success, result?.message);
      setNotePrompt(null);
    } catch (err) {
      toast.error(failure, err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (c) => {
    const confirmed = await confirm({
      title: 'Take this job?',
      message: 'It becomes yours to fix, and nobody else can pick it up.',
      confirmLabel: 'Accept',
      tone: 'primary',
      details: {
        Job: c.title,
        Trade: CATEGORY_LABELS[c.category],
        Where: `Room ${c.roomNo}${c.locationDetail ? ` · ${c.locationDetail}` : ''}`,
      },
    });
    if (!confirmed) return;
    await run(c, () => maintenanceApi.accept(c.id), {
      success: 'Job accepted',
      failure: 'Could not accept',
    });
  };

  const handleResolve = (c) =>
    setNotePrompt({
      request: c,
      title: 'Mark this job resolved?',
      description: 'Your note is what the student sees, so say what you actually did.',
      label: 'What did you do to fix it?',
      placeholder: 'e.g. Replaced the worn washer and reseated the spindle. Ran the tap for five minutes with no drip.',
      confirmLabel: 'Mark resolved',
      tone: 'emerald',
      details: { Job: c.title, Reference: c.reference },
      submit: (note) => maintenanceApi.resolve(c.id, { resolutionNote: note }),
      success: 'Marked resolved',
      failure: 'Could not resolve',
    });

  const handleWithdraw = async (c) => {
    const confirmed = await confirm({
      title: 'Withdraw this request?',
      message: 'It leaves the queue and cannot be reinstated — you would need to report it again.',
      confirmLabel: 'Withdraw',
      cancelLabel: 'Keep it',
      tone: 'danger',
      details: { Job: c.title, Reference: c.reference },
    });
    if (!confirmed) return;
    await run(c, () => maintenanceApi.withdraw(c.id), {
      success: 'Request withdrawn',
      failure: 'Could not withdraw',
    });
  };

  const handleReopen = (c) =>
    setNotePrompt({
      request: c,
      title: 'Reopen this job?',
      description: `It goes straight back to ${c.assigneeName ?? 'the worker who handled it'}, who already knows the job.`,
      label: 'What is still wrong?',
      placeholder: 'e.g. The tap is quieter but still drips overnight — there was a small puddle again this morning.',
      confirmLabel: 'Reopen',
      tone: 'amber',
      details: { Job: c.title, Reference: c.reference },
      submit: (reason) => maintenanceApi.reopen(c.id, { reason }),
      success: 'Reopened',
      failure: 'Could not reopen',
    });

  const handleClose = async (c) => {
    const confirmed = await confirm({
      title: 'Confirm this is fixed?',
      message: 'The request closes for good. Reopen it instead if the fault is still there.',
      confirmLabel: 'Yes, it is fixed',
      tone: 'primary',
      details: { Job: c.title, 'Fixed by': c.assigneeName ?? '—' },
    });
    if (!confirmed) return;
    await run(c, () => maintenanceApi.close(c.id), {
      success: 'Thanks for confirming',
      failure: 'Could not close',
    });
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
          <ServerCrash className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-3 text-sm font-semibold text-red-700">{loadError}</p>
          <p className="mt-1 text-xs text-slate-500">
            Maintenance runs as its own service. The rest of the app is unaffected.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link
              to="/"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'mine', label: 'My Requests', Icon: MessageSquare, count: unreadCount },
    ...(isWorker || isOversight
      ? [{ id: 'queue', label: 'Work Queue', Icon: Inbox, count: openCount }]
      : []),
    ...(isOversight ? [{ id: 'all', label: 'All Requests', Icon: ClipboardList }] : []),
  ];

  const visible = tab === 'mine' ? mine : tab === 'queue' ? queue : all;
  const mode = tab === 'mine' ? 'mine' : tab === 'queue' ? 'queue' : 'admin';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" /> Back to Dashboard
          </Link>
          <h1 className="order-last w-full text-xl font-bold sm:order-none sm:w-auto">Maintenance</h1>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Report a Fault
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {tab === 'all' && Object.keys(counts).length > 0 && (
            <div className="ml-auto flex flex-wrap gap-1.5 text-[11px]">
              {Object.entries(counts).map(([k, v]) => (
                <span key={k} className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
                  {k.toLowerCase()}: {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            Icon={tab === 'mine' ? MessageSquare : Inbox}
            title={
              tab === 'mine'
                ? 'Nothing reported yet'
                : tab === 'queue'
                  ? 'No jobs waiting'
                  : 'Nothing logged yet'
            }
            message={
              // An empty page is the moment someone decides the feature is
              // broken, so each one says whose emptiness it is and what fills it.
              tab === 'mine'
                ? 'Report a fault and a maintenance worker will pick it up. You will see an update the moment it is fixed.'
                : tab === 'queue'
                  ? 'The open pool is clear and nothing is assigned to you. New reports show up here as soon as they are logged.'
                  : 'No fault has been reported in the hostel yet. Everything students and workers log will appear here.'
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((c) => (
              <MaintenanceCard
                key={c.id}
                request={c}
                mode={mode}
                busy={busyId === c.id}
                onOpen={() => openDetail(c)}
                onWithdraw={() => handleWithdraw(c)}
                onAccept={() => handleAccept(c)}
                onResolve={() => handleResolve(c)}
                onReopen={() => handleReopen(c)}
                onClose={() => handleClose(c)}
              />
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <MaintenanceFormModal
          defaultRoomNo={user?.roomNo ?? ''}
          onClose={() => setFormOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {detail && (
        <MaintenanceDetailModal
          detail={detail}
          loading={detailLoading}
          canLeaveInternal={canLeaveInternal && !detail.request?.isOwner}
          busy={busyId === detail.request?.id}
          onClose={() => setDetail(null)}
          onComment={handleComment}
          onWithdraw={() => handleWithdraw(detail.request)}
          onReopen={() => handleReopen(detail.request)}
          onConfirmFixed={() => handleClose(detail.request)}
          onAccept={() => handleAccept(detail.request)}
          onResolve={() => handleResolve(detail.request)}
        />
      )}

      {notePrompt && (
        <NotePromptModal
          title={notePrompt.title}
          description={notePrompt.description}
          label={notePrompt.label}
          placeholder={notePrompt.placeholder}
          confirmLabel={notePrompt.confirmLabel}
          tone={notePrompt.tone}
          details={notePrompt.details}
          submitting={busyId === notePrompt.request.id}
          onCancel={() => setNotePrompt(null)}
          onSubmit={handleNoteSubmit}
        />
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
