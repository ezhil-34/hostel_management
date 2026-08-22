import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    Icon: CheckCircle2,
    ring: 'border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    body: 'text-emerald-700',
  },
  error: {
    Icon: AlertCircle,
    ring: 'border-red-200 bg-red-50',
    icon: 'text-red-600',
    title: 'text-red-900',
    body: 'text-red-700',
  },
  warning: {
    Icon: AlertTriangle,
    ring: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-700',
  },
  info: {
    Icon: Info,
    ring: 'border-blue-200 bg-blue-50',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    body: 'text-blue-700',
  },
};

const DEFAULT_DURATION = 4500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, title, description, { duration = DEFAULT_DURATION } = {}) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, variant, title, description }]);

      // Errors stay until dismissed — they usually need reading and acting on.
      if (duration !== null && variant !== 'error') {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  // Clear any pending timers if the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const toast = {
    success: (title, description, opts) => push('success', title, description, opts),
    error: (title, description, opts) => push('error', title, description, opts),
    warning: (title, description, opts) => push('warning', title, description, opts),
    info: (title, description, opts) => push('info', title, description, opts),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map(({ id, variant, title, description }) => {
          const style = VARIANTS[variant] ?? VARIANTS.info;
          const { Icon } = style;
          return (
            <div
              key={id}
              role={variant === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg animate-[toast-in_180ms_ease-out] ${style.ring}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${style.title}`}>{title}</p>
                {description && (
                  <p className={`mt-0.5 break-words text-xs ${style.body}`}>{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss notification"
                className={`shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5 ${style.icon}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>');
  return ctx;
};
