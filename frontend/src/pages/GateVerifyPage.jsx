import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  DoorOpen,
  DoorClosed,
  AlertTriangle,
  User as UserIcon,
  Home,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { outpassApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../lib/datetime';

const GATE_ROLES = ['SECURITY', 'WARDEN', 'ADMIN'];

/**
 * What a gate guard sees after scanning a pass QR. The token in the URL is a
 * bearer capability, so this page renders nothing useful without a gate-role
 * session — the API refuses it too. Photographing someone's pass gets you a
 * sign-in screen.
 */
export default function GateVerifyPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const isGuard = GATE_ROLES.includes(user?.role);

  // A non-guard never fetches, so start them already settled rather than
  // flipping `loading` from inside an effect.
  const [state, setState] = useState(() => ({
    loading: GATE_ROLES.includes(user?.role),
    error: '',
    outpass: null,
    nextAction: null,
    blockedReason: null,
  }));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  /** Re-reads the pass. `signal` lets the mount effect drop a late response. */
  const load = useCallback(
    async (isCancelled = () => false) => {
      try {
        const data = await outpassApi.verify(token);
        if (!isCancelled()) setState({ loading: false, error: '', ...data });
      } catch (err) {
        if (!isCancelled()) {
          setState({
            loading: false,
            error: err.message,
            outpass: null,
            nextAction: null,
            blockedReason: null,
          });
        }
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isGuard) return undefined;

    let cancelled = false;
    (async () => {
      await load(() => cancelled);
    })();

    return () => {
      cancelled = true;
    };
  }, [isGuard, load]);

  const act = async (action) => {
    const isExit = action === 'EXIT';
    const student = state.outpass.user;

    const confirmed = await confirm({
      title: isExit ? 'Check this student out?' : 'Check this student back in?',
      message: isExit
        ? 'This records the time they left the hostel.'
        : 'This closes the pass and retires the QR code.',
      confirmLabel: isExit ? 'Mark Exit' : 'Mark Return',
      tone: isExit ? 'primary' : 'primary',
      details: {
        Student: `${student.name} (${student.rollNumber})`,
        Room: student.roomNo ?? state.outpass.roomNo,
        Destination: state.outpass.destination,
      },
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = isExit
        ? await outpassApi.markExit(token)
        : await outpassApi.markReturn(token);

      toast.success(isExit ? 'Checked out' : 'Checked in', result.message);

      if (isExit) {
        setState({ loading: false, error: '', blockedReason: null, ...result });
      } else {
        // The token is retired on return, so there is nothing left to re-read.
        setDone(result.outpass);
      }
    } catch (err) {
      toast.error('Gate action failed', err.message);
      await load();
    } finally {
      setBusy(false);
    }
  };

  // --- not a guard ---------------------------------------------------------
  if (!isGuard) {
    return (
      <Shell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Gate access only</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          You are signed in as <span className="font-semibold">{user?.name}</span>
          {user?.role ? ` (${user.role.toLowerCase()})` : ''}. Checking students in and out needs a
          security, warden or admin account.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </Shell>
    );
  }

  if (state.loading) {
    return (
      <Shell>
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-slate-500">Reading pass…</p>
      </Shell>
    );
  }

  // --- return completed ----------------------------------------------------
  if (done) {
    return (
      <Shell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">{done.user.name} is back in</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Pass {done.reference} is closed
          {done.returnedLate ? ' — they returned late.' : ' and on time.'}
        </p>
        <p className="mt-4 text-xs text-slate-400">
          This QR code will no longer scan. Ready for the next student.
        </p>
      </Shell>
    );
  }

  // --- invalid token -------------------------------------------------------
  if (state.error) {
    return (
      <Shell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Pass not valid</h1>
        <p className="mt-1.5 text-sm text-slate-600">{state.error}</p>
        <p className="mt-4 text-xs text-slate-400">
          A pass stops scanning once it is cancelled, rejected, or already closed.
        </p>
      </Shell>
    );
  }

  // --- the pass ------------------------------------------------------------
  const { outpass, nextAction } = state;
  const student = outpass.user;
  const isExit = nextAction === 'EXIT';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Gate verification · signed in as {user.name}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className={`p-5 text-white ${
              outpass.isOverdue
                ? 'bg-gradient-to-r from-red-600 to-red-700'
                : 'bg-gradient-to-r from-blue-600 to-blue-700'
            }`}
          >
            <StatusBadge
              status={outpass.status}
              overdue={outpass.isOverdue}
              expired={outpass.isExpired}
              overdueByMinutes={outpass.overdueByMinutes}
            />
            <h1 className="mt-2 text-xl font-bold">{student.name}</h1>
            <p className="font-mono text-sm text-white/80">{student.rollNumber}</p>

            {outpass.isOverdue && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Past the return time — report this to the warden.
              </p>
            )}
          </div>

          <dl className="divide-y divide-slate-100">
            <Row Icon={Home} label="Room" value={student.roomNo ?? outpass.roomNo} />
            <Row Icon={Phone} label="Phone" value={student.phone ?? '—'} />
            <Row Icon={MapPin} label="Destination" value={outpass.destination} />
            <Row Icon={Clock} label="Leaves" value={formatDateTime(outpass.leaveAt)} />
            <Row
              Icon={Clock}
              label="Returns by"
              value={formatDateTime(outpass.returnAt)}
              danger={outpass.isOverdue}
            />
            {outpass.exitedAt && (
              <Row Icon={DoorOpen} label="Checked out" value={formatDateTime(outpass.exitedAt)} />
            )}
            <Row Icon={UserIcon} label="Reference" value={outpass.reference} mono />
          </dl>

          <div className="border-t border-slate-100 bg-slate-50 p-5">
            <p className="mb-3 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-500">Reason: </span>
              {outpass.reason}
            </p>

            {nextAction ? (
              <button
                type="button"
                onClick={() => act(nextAction)}
                disabled={busy}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-60 ${
                  isExit
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isExit ? (
                  <DoorOpen className="h-5 w-5" />
                ) : (
                  <DoorClosed className="h-5 w-5" />
                )}
                {isExit ? 'Mark Exit' : 'Mark Return'}
              </button>
            ) : (
              <p className="rounded-xl bg-white px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                {state.blockedReason ??
                  `No gate action available for a ${outpass.status.toLowerCase()} pass.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ Icon, label, value, mono = false, danger = false }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-sm font-medium ${mono ? 'font-mono text-xs' : ''} ${
          danger ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="flex flex-col items-center">{children}</div>
      </div>
    </div>
  );
}
