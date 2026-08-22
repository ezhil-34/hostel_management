import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Lock,
  Loader2,
  Save,
  ShieldCheck,
  KeyRound,
  Inbox,
  FileClock,
  UserCog,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { profileApi, authApi, ApiRequestError } from '../lib/api';
import ChangeRequestCard from '../components/ChangeRequestCard';
import RequestChangeModal from '../components/RequestChangeModal';

const ROLE_LABELS = {
  STUDENT: 'Student',
  WARDEN: 'Warden',
  ADMIN: 'Administrator',
  STAFF: 'Staff',
};

export default function ProfilePage() {
  // The page renders from the server's profile payload, not the cached user —
  // it carries the field policy alongside the values.
  const { logout, setUserData } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('details');

  // Details form
  const [form, setForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Requests
  const [myRequests, setMyRequests] = useState([]);
  const [queue, setQueue] = useState([]);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [requestModalField, setRequestModalField] = useState(null);

  // Password
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const canReview = profile?.permissions?.canReview ?? false;

  // --- loading -------------------------------------------------------------

  const loadProfile = useCallback(async () => {
    const data = await profileApi.get();
    setProfile(data);
    setForm(
      Object.fromEntries(
        data.fields.filter((f) => f.editable).map((f) => [f.field, data.user[f.field] ?? '']),
      ),
    );
    return data;
  }, []);

  const loadRequests = useCallback(async (reviewer) => {
    const [mine, all] = await Promise.all([
      profileApi.listMyRequests(),
      reviewer ? profileApi.listAllRequests() : Promise.resolve({ requests: [] }),
    ]);
    setMyRequests(mine.requests);
    setQueue(all.requests);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await loadProfile();
        if (cancelled) return;
        await loadRequests(data.permissions.canReview);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load your profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile, loadRequests]);

  const refresh = useCallback(async () => {
    const data = await loadProfile();
    await loadRequests(data.permissions.canReview);
    return data;
  }, [loadProfile, loadRequests]);

  // --- field grouping ------------------------------------------------------

  const editableFields = useMemo(
    () => profile?.fields.filter((f) => f.editable) ?? [],
    [profile],
  );
  const lockedFields = useMemo(
    () => profile?.fields.filter((f) => !f.editable) ?? [],
    [profile],
  );

  const pendingByField = useMemo(
    () =>
      Object.fromEntries(
        myRequests.filter((r) => r.status === 'PENDING').map((r) => [r.field, r]),
      ),
    [myRequests],
  );

  const fieldLabel = useCallback(
    (name) => profile?.fields.find((f) => f.field === name)?.label ?? name,
    [profile],
  );

  const isDirty = useMemo(
    () => editableFields.some((f) => (form[f.field] ?? '') !== (profile?.user[f.field] ?? '')),
    [editableFields, form, profile],
  );

  // --- actions -------------------------------------------------------------

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setFieldErrors({});

    const changed = Object.fromEntries(
      editableFields
        .filter((f) => (form[f.field] ?? '') !== (profile.user[f.field] ?? ''))
        .map((f) => [f.field, form[f.field]]),
    );

    if (Object.keys(changed).length === 0) {
      toast.info('Nothing to save', 'You have not changed anything yet.');
      return;
    }

    setSavingProfile(true);
    try {
      const { user: updated } = await profileApi.update(changed);
      setProfile((p) => ({ ...p, user: updated }));
      setUserData(updated);
      toast.success(
        'Profile updated',
        `${Object.keys(changed).map(fieldLabel).join(', ')} saved.`,
      );
    } catch (err) {
      setFieldErrors(err instanceof ApiRequestError ? err.fieldErrors : {});
      toast.error('Could not save', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateRequest = async (payload) => {
    const { request, message } = await profileApi.createRequest(payload);
    setMyRequests((current) => [request, ...current]);
    setRequestModalField(null);
    toast.success('Request submitted', message);
    if (canReview) await loadRequests(true);
  };

  const handleCancelRequest = async (request) => {
    const confirmed = await confirm({
      title: 'Cancel this request?',
      message: 'It will be withdrawn from the review queue. You can raise a new one afterwards.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      tone: 'danger',
      details: {
        Field: fieldLabel(request.field),
        Requested: request.newValue,
        Reference: request.reference,
      },
    });
    if (!confirmed) return;

    setBusyRequestId(request.id);
    try {
      const { message } = await profileApi.cancelRequest(request.id);
      await refresh();
      toast.info('Request cancelled', message);
    } catch (err) {
      toast.error('Could not cancel', err.message);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleReview = async (request, decision) => {
    const approving = decision === 'APPROVED';

    const confirmed = await confirm({
      title: approving ? 'Approve this change?' : 'Reject this change?',
      message: approving
        ? "The new value will be written to the student's profile immediately."
        : 'The request will be closed. The student can raise a new one.',
      confirmLabel: approving ? 'Approve' : 'Reject',
      tone: approving ? 'primary' : 'danger',
      details: {
        Student: `${request.user.name} (${request.user.rollNumber})`,
        Field: fieldLabel(request.field),
        Change: `${request.oldValue || 'not set'} → ${request.newValue}`,
      },
    });
    if (!confirmed) return;

    setBusyRequestId(request.id);
    try {
      const { message } = await profileApi.review(request.id, { decision });
      await refresh();
      if (approving) toast.success('Request approved', message);
      else toast.info('Request rejected', message);
    } catch (err) {
      toast.error(approving ? 'Could not approve' : 'Could not reject', err.message);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error('Passwords do not match', 'Re-enter the new password to confirm it.');
      return;
    }

    const confirmed = await confirm({
      title: 'Change your password?',
      message: 'You will be signed out of every other device. This one stays signed in.',
      confirmLabel: 'Change password',
      tone: 'warning',
    });
    if (!confirmed) return;

    setChangingPassword(true);
    try {
      const { message } = await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed', message);
    } catch (err) {
      toast.error('Could not change password', err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Sign out?',
      message: 'You will need your password to sign back in.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      tone: 'logout',
    });
    if (!confirmed) return;

    await logout();
    toast.info('Signed out', 'See you next time.');
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

  const pendingCount = queue.filter((r) => r.status === 'PENDING').length;

  const TABS = [
    { id: 'details', label: 'Details', Icon: UserCog },
    { id: 'requests', label: 'My Requests', Icon: FileClock, count: myRequests.filter((r) => r.status === 'PENDING').length },
    ...(canReview ? [{ id: 'review', label: 'Approvals', Icon: Inbox, count: pendingCount }] : []),
    { id: 'security', label: 'Security', Icon: KeyRound },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-6 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
              {profile.user.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">{profile.user.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                  <ShieldCheck className="h-3 w-3" />
                  {ROLE_LABELS[profile.user.role] ?? profile.user.role}
                </span>
                <span className="font-mono">{profile.user.rollNumber}</span>
                {profile.user.roomNo && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Room {profile.user.roomNo}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <nav className="mx-auto max-w-4xl overflow-x-auto px-4 sm:px-6">
          <div className="flex gap-1 border-b border-transparent">
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
      </header>

      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* ---------------------------------------------------------- Details */}
        {tab === 'details' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">You can edit these</h2>
              <p className="mt-0.5 text-xs text-slate-500">Changes save immediately.</p>

              <form onSubmit={handleSaveDetails} className="mt-4 space-y-4" noValidate>
                {editableFields.map((f) => (
                  <div key={f.field}>
                    <label htmlFor={f.field} className="mb-1 block text-xs font-semibold text-slate-600">
                      {f.label}
                    </label>
                    <input
                      id={f.field}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.field] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.field]: e.target.value })}
                      className={`w-full rounded-xl border p-2.5 text-sm focus:outline-none focus:ring-2 ${
                        fieldErrors[f.field]
                          ? 'border-red-400 focus:ring-red-400'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {fieldErrors[f.field] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[f.field]}</p>
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={savingProfile || !isDirty}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Lock className="h-4 w-4 text-amber-500" />
                These need approval
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Raise a request and a warden will review it.
              </p>

              <ul className="mt-4 divide-y divide-slate-100">
                {lockedFields.map((f) => {
                  const pending = pendingByField[f.field];
                  return (
                    <li
                      key={f.field}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{f.label}</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
                          {profile.user[f.field] || <span className="text-slate-400">Not set</span>}
                        </p>
                      </div>

                      {!f.requiresApproval ? (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          Read-only
                        </span>
                      ) : pending ? (
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Request pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRequestModalField(f)}
                          className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          Request change
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}

        {/* --------------------------------------------------------- Requests */}
        {tab === 'requests' && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <EmptyState
                Icon={FileClock}
                title="No requests yet"
                message="When you ask to change a locked field, it will show up here with its status."
              />
            ) : (
              myRequests.map((r) => (
                <ChangeRequestCard
                  key={r.id}
                  request={r}
                  label={fieldLabel(r.field)}
                  mode="mine"
                  busy={busyRequestId === r.id}
                  onCancel={() => handleCancelRequest(r)}
                />
              ))
            )}
          </div>
        )}

        {/* -------------------------------------------------------- Approvals */}
        {tab === 'review' && canReview && (
          <div className="space-y-3">
            {queue.length === 0 ? (
              <EmptyState
                Icon={Inbox}
                title="Queue is empty"
                message="Profile change requests from students will appear here for review."
              />
            ) : (
              queue.map((r) => (
                <ChangeRequestCard
                  key={r.id}
                  request={r}
                  label={fieldLabel(r.field)}
                  mode="review"
                  busy={busyRequestId === r.id}
                  onApprove={() => handleReview(r, 'APPROVED')}
                  onReject={() => handleReview(r, 'REJECTED')}
                />
              ))
            )}
          </div>
        )}

        {/* --------------------------------------------------------- Security */}
        {tab === 'security' && (
          <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Change password</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Signs you out everywhere else. At least 8 characters.
            </p>

            <form onSubmit={handleChangePassword} className="mt-4 space-y-4" noValidate>
              {[
                { id: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
                { id: 'newPassword', label: 'New password', autoComplete: 'new-password' },
                { id: 'confirm', label: 'Confirm new password', autoComplete: 'new-password' },
              ].map(({ id, label, autoComplete }) => (
                <div key={id}>
                  <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">
                    {label}
                  </label>
                  <input
                    id={id}
                    type="password"
                    required
                    autoComplete={autoComplete}
                    placeholder="••••••••"
                    value={passwordForm[id]}
                    onChange={(e) => setPasswordForm({ ...passwordForm, [id]: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={
                  changingPassword ||
                  !passwordForm.currentPassword ||
                  passwordForm.newPassword.length < 8
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {changingPassword ? 'Changing…' : 'Change password'}
              </button>
            </form>
          </section>
        )}
      </main>

      {requestModalField && (
        <RequestChangeModal
          field={requestModalField}
          currentValue={profile.user[requestModalField.field]}
          onClose={() => setRequestModalField(null)}
          onSubmit={handleCreateRequest}
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
