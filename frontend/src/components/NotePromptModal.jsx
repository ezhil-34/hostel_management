import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

/**
 * Asks for a short written note before a consequential action.
 *
 * This replaces `window.prompt()`, which was doing the job for "resolve" and
 * "reopen" — the two actions the whole module turns on. A native prompt is the
 * wrong tool twice over: it looks nothing like the rest of the app, and Chrome
 * lets a user tick "prevent this page from creating additional dialogs", after
 * which the prompt returns null forever and the buttons silently stop working
 * with no error anywhere. A real dialog cannot be suppressed, can validate as
 * you type, and can say why the button is still disabled.
 */
export default function NotePromptModal({
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  tone = 'emerald',
  minLength = 10,
  maxLength = 1000,
  details,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const trimmed = value.trim();
  const tooShort = trimmed.length < minLength;
  const showError = touched && tooShort && trimmed.length > 0;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (tooShort || submitting) return;
    onSubmit(trimmed);
  };

  const toneClasses =
    tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600 text-white'
      : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-prompt-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 id="note-prompt-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4 p-5" noValidate>
          {details && (
            <dl className="space-y-1 rounded-xl bg-slate-50 px-3 py-2.5">
              {Object.entries(details).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-xs">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div>
            <label htmlFor="note" className="mb-1 block text-xs font-semibold text-slate-600">
              {label}
            </label>
            <textarea
              id="note"
              ref={inputRef}
              rows={4}
              maxLength={maxLength}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 ${
                showError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
              }`}
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="text-xs text-red-600">
                {showError ? `At least ${minLength} characters.` : ''}
              </p>
              <p className="shrink-0 text-xs text-slate-400">
                {trimmed.length}/{maxLength}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={tooShort || submitting}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses}`}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
