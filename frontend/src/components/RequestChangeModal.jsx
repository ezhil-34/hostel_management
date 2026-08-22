import React, { useState, useEffect, useRef } from 'react';
import { Lock, Loader2, X, ArrowRight } from 'lucide-react';

/**
 * Raise a change request for a locked field. The reason is mandatory — it is
 * the only context the reviewer gets.
 */
export default function RequestChangeModal({ field, currentValue, onClose, onSubmit }) {
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit({ field: field.field, newValue, reason });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
      setSubmitting(false);
    }
  };

  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 10;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 id="request-title" className="text-base font-bold text-slate-900">
                Request a change
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {field.label} needs warden approval before it can change.
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

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
            <span className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-500 ring-1 ring-slate-200">
              {currentValue || 'not set'}
            </span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
              {newValue.trim() || '…'}
            </span>
          </div>

          <div>
            <label htmlFor="newValue" className="mb-1 block text-xs font-semibold text-slate-600">
              New {field.label.toLowerCase()}
            </label>
            <input
              ref={firstInput}
              id="newValue"
              type={field.type}
              required
              placeholder={field.placeholder}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className={`w-full rounded-xl border p-2.5 text-sm focus:outline-none focus:ring-2 ${
                fieldErrors.newValue
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
            />
            {fieldErrors.newValue && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.newValue}</p>
            )}
          </div>

          <div>
            <label htmlFor="reason" className="mb-1 block text-xs font-semibold text-slate-600">
              Why is this change needed?
            </label>
            <textarea
              id="reason"
              required
              rows={3}
              minLength={10}
              maxLength={500}
              placeholder="e.g. The hostel office reallocated me to C-101 on 14 August."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full resize-none rounded-xl border p-2.5 text-sm focus:outline-none focus:ring-2 ${
                fieldErrors.reason || reasonTooShort
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              <p className="text-xs text-red-600">
                {fieldErrors.reason || (reasonTooShort ? 'At least 10 characters.' : '')}
              </p>
              <p className="shrink-0 text-xs text-slate-400">{reason.trim().length}/500</p>
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
              disabled={submitting || !newValue.trim() || reason.trim().length < 10}
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
