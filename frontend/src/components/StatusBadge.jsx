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
} from 'lucide-react';

const STATUS = {
  PENDING: { label: 'Pending review', Icon: Clock, className: 'bg-amber-100 text-amber-700' },

  // Maintenance lifecycle. OPEN/ACCEPTED are distinct from the outpass statuses
  // above, so they get their own entries rather than being aliased.
  OPEN: { label: 'Open', Icon: Inbox, className: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { label: 'Being worked on', Icon: Wrench, className: 'bg-blue-100 text-blue-700' },
  RESOLVED: { label: 'Resolved', Icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  WITHDRAWN: { label: 'Withdrawn', Icon: Ban, className: 'bg-slate-100 text-slate-600' },
  APPROVED: { label: 'Approved', Icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', Icon: XCircle, className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', Icon: Ban, className: 'bg-slate-100 text-slate-600' },
  ACTIVE: { label: 'Currently out', Icon: DoorOpen, className: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', Icon: CheckCircle2, className: 'bg-slate-100 text-slate-600' },
  OVERDUE: { label: 'Overdue', Icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  EXPIRED: { label: 'Expired unused', Icon: CalendarX, className: 'bg-slate-100 text-slate-600' },
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
  const { label, Icon, className } = STATUS[key] ?? STATUS.PENDING;

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
