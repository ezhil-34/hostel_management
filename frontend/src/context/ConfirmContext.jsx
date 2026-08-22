import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, HelpCircle, Loader2, LogOut, Trash2 } from 'lucide-react';

const ConfirmContext = createContext(null);

const TONES = {
  danger: {
    Icon: AlertTriangle,
    chip: 'bg-red-100 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  },
  warning: {
    Icon: AlertTriangle,
    chip: 'bg-amber-100 text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
  },
  primary: {
    Icon: HelpCircle,
    chip: 'bg-blue-100 text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
  },
  logout: {
    Icon: LogOut,
    chip: 'bg-slate-100 text-slate-600',
    button: 'bg-slate-800 hover:bg-slate-900 focus-visible:ring-slate-600',
  },
  delete: {
    Icon: Trash2,
    chip: 'bg-red-100 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  },
};

/**
 * Promise-based confirmation dialog.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Sign out?', tone: 'logout' }))) return;
 *
 * Resolves true on confirm, false on cancel/escape/backdrop.
 */
export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);
  const confirmButton = useRef(null);

  const settle = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
    setBusy(false);
  }, []);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({
          title: 'Are you sure?',
          message: '',
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
          tone: 'primary',
          details: null,
          ...(typeof options === 'string' ? { title: options } : options),
        });
      }),
    [],
  );

  // Escape closes; focus lands on the confirm button so keyboard users are not
  // stranded behind the backdrop.
  useEffect(() => {
    if (!dialog) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) settle(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const focusTimer = setTimeout(() => confirmButton.current?.focus(), 0);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
    };
  }, [dialog, busy, settle]);

  const handleConfirm = () => {
    setBusy(true);
    settle(true);
  };

  const tone = TONES[dialog?.tone] ?? TONES.primary;
  const { Icon } = tone;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => !busy && settle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={dialog.message ? 'confirm-message' : undefined}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-base font-bold text-slate-900">
                  {dialog.title}
                </h2>
                {dialog.message && (
                  <p id="confirm-message" className="mt-1.5 text-sm text-slate-600">
                    {dialog.message}
                  </p>
                )}

                {dialog.details && (
                  <dl className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                    {Object.entries(dialog.details).map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="shrink-0 font-semibold text-slate-500">{label}</dt>
                        <dd className="min-w-0 break-words font-medium text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => settle(false)}
                disabled={busy}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {dialog.cancelLabel}
              </button>
              <button
                ref={confirmButton}
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${tone.button}`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside a <ConfirmProvider>');
  return ctx;
};
