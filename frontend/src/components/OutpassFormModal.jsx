import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, CalendarPlus } from 'lucide-react';
import { toLocalInput } from '../lib/datetime';

export default function OutpassFormModal({ defaultRoomNo = '', onClose, onSubmit }) {
  // Lazy initialiser: the default times are read from the clock once, when the
  // modal opens, not recomputed on every keystroke.
  const [form, setForm] = useState(() => ({
    roomNo: defaultRoomNo,
    destination: '',
    reason: '',
    leaveAt: toLocalInput(new Date(Date.now() + 3600_000)),
    returnAt: toLocalInput(new Date(Date.now() + 8 * 3600_000)),
  }));
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const firstInput = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => firstInput.current?.focus(), 0);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
      document.body.style.overflow = overflow;
    };
  }, [onClose, submitting]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      // The inputs are local wall-clock time; send absolute instants.
      await onSubmit({
        ...form,
        leaveAt: new Date(form.leaveAt).toISOString(),
        returnAt: new Date(form.returnAt).toISOString(),
      });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full rounded-xl border p-2.5 text-sm focus:outline-none focus:ring-2 ${
      fieldErrors[field] ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
    }`;

  const reasonShort = form.reason.trim().length > 0 && form.reason.trim().length < 10;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outpass-form-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="outpass-form-title" className="text-base font-bold text-slate-900">
                Request an outpass
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                A warden reviews this before your QR is issued.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="destination" className="mb-1 block text-xs font-semibold text-slate-600">
              Destination
            </label>
            <input
              ref={firstInput}
              id="destination"
              type="text"
              required
              placeholder="e.g. City Mall"
              value={form.destination}
              onChange={set('destination')}
              className={inputClass('destination')}
            />
            {fieldErrors.destination && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.destination}</p>
            )}
          </div>

          <div>
            <label htmlFor="roomNo" className="mb-1 block text-xs font-semibold text-slate-600">
              Room Number
            </label>
            <input
              id="roomNo"
              type="text"
              required
              placeholder="e.g. B-302"
              value={form.roomNo}
              onChange={set('roomNo')}
              className={inputClass('roomNo')}
            />
            {fieldErrors.roomNo && <p className="mt-1 text-xs text-red-600">{fieldErrors.roomNo}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="leaveAt" className="mb-1 block text-xs font-semibold text-slate-600">
                Leave Time
              </label>
              <input
                id="leaveAt"
                type="datetime-local"
                required
                value={form.leaveAt}
                onChange={set('leaveAt')}
                className={inputClass('leaveAt')}
              />
              {fieldErrors.leaveAt && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.leaveAt}</p>
              )}
            </div>
            <div>
              <label htmlFor="returnAt" className="mb-1 block text-xs font-semibold text-slate-600">
                Return Time
              </label>
              <input
                id="returnAt"
                type="datetime-local"
                required
                value={form.returnAt}
                onChange={set('returnAt')}
                className={inputClass('returnAt')}
              />
              {fieldErrors.returnAt && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.returnAt}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="mb-1 block text-xs font-semibold text-slate-600">
              Reason
            </label>
            <textarea
              id="reason"
              required
              rows={3}
              maxLength={500}
              placeholder="e.g. Going home for the weekend to attend a family function."
              value={form.reason}
              onChange={set('reason')}
              className={`resize-none ${inputClass('reason')} ${
                reasonShort ? 'border-red-400 focus:ring-red-400' : ''
              }`}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              <p className="text-xs text-red-600">
                {fieldErrors.reason || (reasonShort ? 'At least 10 characters.' : '')}
              </p>
              <p className="shrink-0 text-xs text-slate-400">{form.reason.trim().length}/500</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !form.destination.trim() ||
                !form.roomNo.trim() ||
                form.reason.trim().length < 10
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
