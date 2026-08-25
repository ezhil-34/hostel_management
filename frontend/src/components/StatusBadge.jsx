import React from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  DoorOpen,
  AlertTriangle,
  CalendarX,
  Inbox,
  Wrench,
  CheckCheck,
  HelpCircle,
} from 'lucide-react';

const STATUS = {
  PENDING: { label: 'Pending review', Icon: Clock, className: 'bg-amber-100 text-amber-700' },

  // Maintenance lifecycle. OPEN/ACCEPTED are distinct from the outpass statuses
  // above, so they get their own entries rather than being aliased.
  OPEN: { label: 'Open', Icon: Inbox, className: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { label: 'Being worked on', Icon: Wrench, className: 'bg-blue-100 text-blue-700' },
  RESOLVED: { label: 'Resolved', Icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  CLOSED: { label: 'Closed', Icon: CheckCheck, className: 'bg-slate-100 text-slate-600' },
  WITHDRAWN: { label: 'Withdrawn', Icon: Ban, className: 'bg-slate-100 text-slate-600' },
  APPROVED: { label: 'Approved', Icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', Icon: XCircle, className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', Icon: Ban, className: 'bg-slate-100 text-slate-600' },
  ACTIVE: { label: 'Currently out', Icon: DoorOpen, className: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', Icon: CheckCircle2, className: 'bg-slate-100 text-slate-600' },
  OVERDUE: { label: 'Overdue', Icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  EXPIRED: { label: 'Expired unused', Icon: CalendarX, className: 'bg-slate-100 text-slate-600' },
};

/** ACCEPTED_BY_STAFF → "Accepted by staff". Only ever used for a status we forgot. */
const humanise = (value) => {
  if (!value) return 'Unknown';
  const words = String(value).toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * `overdue` and `expired` win over `status`. Both are derived server-side and
 * arrive as flags alongside the stored status, never as a status of their own:
 * an overdue pass is `ACTIVE + isOverdue`, an expired one `APPROVED + isExpired`.
 * Showing the raw status would tell the student their dead pass is "Approved".
 */
export default function StatusBadge({
  status,
  overdue = false,
  expired = false,
  overdueByMinutes = 0,
}) {
  const key = overdue ? 'OVERDUE' : expired ? 'EXPIRED' : status;

  /**
   * An unknown status shows itself, rather than borrowing PENDING's label.
   *
   * This used to fall back to PENDING, which is how a closed maintenance job
   * came to display "Pending review": CLOSED was simply missing from the table
   * above, and the fallback made that look like a status instead of a bug. A
   * badge that says "Closed" when it means closed, or shows the raw value when
   * it does not recognise one, cannot mislead anybody the same way twice.
   */
  const entry = STATUS[key] ?? {
    label: humanise(key),
    Icon: HelpCircle,
    className: 'bg-slate-100 text-slate-600',
  };
  const { label, Icon, className } = entry;

  if (import.meta.env.DEV && !STATUS[key] && key) {
    console.warn(`[StatusBadge] no entry for status "${key}" — add one to STATUS.`);
  }

  const suffix =
    overdue && overdueByMinutes > 0
      ? ` · ${
          overdueByMinutes >= 60
            ? `${Math.floor(overdueByMinutes / 60)}h ${overdueByMinutes % 60}m`
            : `${overdueByMinutes}m`
        }`
      : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {suffix}
    </span>
  );
}
