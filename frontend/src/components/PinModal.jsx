import React, { useState, useRef, useEffect } from 'react';
import { Lock, X, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Four boxes, one digit each.
 *
 * The PIN is held as a string throughout — "0042" is a valid PIN and
 * `Number('0042')` is 42, so treating it as a number loses leading zeros
 * somewhere between here and bcrypt.
 */
function PinBoxes({ value, onChange, disabled, autoFocus }) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  /**
   * Updates through a function of the previous value rather than reading the
   * `value` prop.
   *
   * Reading the prop looked fine and was wrong: type two digits faster than
   * React re-renders and the second update is computed from a stale value, so
   * the first digit is silently dropped. The PIN then fails for no visible
   * reason and burns one of five attempts before the wallet locks.
   */
  const setDigit = (index, digit) => {
    onChange((prev) => {
      const next = (prev ?? '').split('');
      next[index] = digit;
      return next.join('').slice(0, 4);
    });
    if (digit && index < 3) refs.current[index + 1]?.focus();
  };

  const onKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 3) refs.current[index + 1]?.focus();
  };

  // Pasting a whole PIN should work; browsers deliver it to whichever box has focus.
  const onPaste = (e) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!digits) return;
    e.preventDefault();
    onChange(() => digits);
    refs.current[Math.min(digits.length, 3)]?.focus();
  };

  return (
    <div className="flex justify-center gap-3" onPaste={onPaste}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          aria-label={`PIN digit ${i + 1}`}
          value={value[i] ?? ''}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={onKeyDown(i)}
          className="h-14 w-12 rounded-xl border-2 border-slate-200 text-center text-2xl font-bold text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
        />
      ))}
    </div>
  );
}

/** Asks for the spending PIN before a purchase goes through. */
export function PinPromptModal({ item, counterName, balance, error, submitting, onCancel, onSubmit }) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !submitting && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const submit = (e) => {
    e.preventDefault();
    if (pin.length !== 4 || submitting) return;
    onSubmit(pin);
    // Clear the boxes as the attempt goes out rather than reacting to the error
    // afterwards: on success this modal unmounts, and on failure the next
    // attempt starts from empty without a second render pass to get there.
    setPin('');
  };

  const short = balance - item.points;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 id="pin-title" className="text-base font-bold text-slate-900">
                Confirm with your PIN
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{counterName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cancel"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">{item.name}</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">{item.points}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-slate-500">
              <span>Balance after this</span>
              <span className={`font-semibold tabular-nums ${short < 0 ? 'text-red-600' : ''}`}>
                {short}
              </span>
            </div>
          </div>

          <PinBoxes value={pin} onChange={setPin} disabled={submitting} autoFocus />

          {error && (
            <p role="alert" className="text-center text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Pay {item.points} points
          </button>
        </form>
      </div>
    </div>
  );
}

/** First-time setup: choose a PIN, confirmed with the account password. */
export function SetPinModal({ error, submitting, onCancel, onSubmit }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');

  const mismatch = confirmPin.length === 4 && pin !== confirmPin;
  const ready = pin.length === 4 && confirmPin.length === 4 && !mismatch && password.length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (ready && !submitting) onSubmit({ pin, confirmPin, password });
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setpin-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="setpin-title" className="text-base font-bold text-slate-900">
                Set a spending PIN
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Four digits, asked for on every purchase.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cancel"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-center text-xs font-semibold text-slate-600">Choose your PIN</p>
            <PinBoxes value={pin} onChange={setPin} disabled={submitting} autoFocus />
          </div>

          <div>
            <p className="mb-2 text-center text-xs font-semibold text-slate-600">Enter it again</p>
            <PinBoxes value={confirmPin} onChange={setConfirmPin} disabled={submitting} />
            {mismatch && (
              <p className="mt-2 text-center text-xs font-medium text-red-600">
                Those two do not match.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="account-password"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Your account password
            </label>
            <input
              id="account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Asked for so a borrowed phone cannot set a new PIN and spend your points.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-center text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save PIN
          </button>
        </form>
      </div>
    </div>
  );
}

export default PinPromptModal;
