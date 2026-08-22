import React from 'react';
import { Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';

const STATUS = {
  PENDING: { label: 'Pending review', Icon: Clock, className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', Icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', Icon: XCircle, className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', Icon: Ban, className: 'bg-slate-100 text-slate-600' },
};

export default function StatusBadge({ status }) {
  const { label, Icon, className } = STATUS[status] ?? STATUS.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
