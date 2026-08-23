import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Wrench } from 'lucide-react';
import { CATEGORY_LABELS, CATEGORY_HINTS } from '../lib/maintenanceMeta';

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function MaintenanceFormModal({ defaultRoomNo = '', onClose, onSubmit }) {
  const [form, setForm] = useState({
    category: 'PLUMBING',
    priority: 'MEDIUM',
    title: '',
    description: '',
    roomNo: defaultRoomNo,
    locationDetail: '',
  });
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

  const set = (key) => (e) =>
    setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit(form);
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

  const descShort = form.description.trim().length > 0 && form.description.trim().length < 20;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-form-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 id="maintenance-form-title" className="text-base font-bold text-slate-900">
                Report a fault
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                A maintenance worker picks it up, fixes it, and marks it resolved.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1 block text-xs font-semibold text-slate-600">
                What needs fixing?
              </label>
              <select
                id="category"
                value={form.category}
                onChange={set('category')}
                className={inputClass('category')}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              {/* Examples for the picked trade — cheaper than a help page, and
                  it nudges people away from filing everything under Other. */}
              <p className="mt-1 text-xs text-slate-400">{CATEGORY_HINTS[form.category]}</p>
            </div>
            <div>
              <label htmlFor="priority" className="mb-1 block text-xs font-semibold text-slate-600">
                Priority
              </label>
              <select
                id="priority"
                value={form.priority}
                onChange={set('priority')}
                className={inputClass('priority')}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-semibold text-slate-600">
              Title
            </label>
            <input
              ref={firstInput}
              id="title"
              type="text"
              required
              maxLength={140}
              placeholder="e.g. Washroom tap will not stop running"
              value={form.title}
              onChange={set('title')}
              className={inputClass('title')}
            />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="roomNo" className="mb-1 block text-xs font-semibold text-slate-600">
                Room
              </label>
              <input
                id="roomNo"
                type="text"
                maxLength={20}
                placeholder="e.g. B-302"
                value={form.roomNo}
                onChange={set('roomNo')}
                className={inputClass('roomNo')}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Defaults to your room. Change it for a common area.
              </p>
            </div>
            <div>
              <label htmlFor="locationDetail" className="mb-1 block text-xs font-semibold text-slate-600">
                Where exactly? <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="locationDetail"
                type="text"
                maxLength={120}
                placeholder="e.g. attached washroom"
                value={form.locationDetail}
                onChange={set('locationDetail')}
                className={inputClass('locationDetail')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-semibold text-slate-600">
              What happened?
            </label>
            <textarea
              id="description"
              required
              rows={4}
              maxLength={2000}
              placeholder="When did it start, how bad is it, and anything a worker should bring?"
              value={form.description}
              onChange={set('description')}
              className={`resize-none ${inputClass('description')} ${
                descShort ? 'border-red-400 focus:ring-red-400' : ''
              }`}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              <p className="text-xs text-red-600">
                {fieldErrors.description || (descShort ? 'At least 20 characters.' : '')}
              </p>
              <p className="shrink-0 text-xs text-slate-400">{form.description.trim().length}/2000</p>
            </div>
          </div>

          <p className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800">
            Your name, room and phone number are attached automatically — a worker
            needs to know whose room to come to and who to call at the door.
          </p>

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
                submitting || form.title.trim().length < 5 || form.description.trim().length < 20
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Sending…' : 'Report it'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
