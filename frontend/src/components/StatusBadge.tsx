'use client';

import clsx from 'clsx';

const CONFIG: Record<string, { label: string; classes: string; dot?: string }> = {
  // run statuses
  pending:               { label: 'Pending',    classes: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-400' },
  running:               { label: 'Running',    classes: 'bg-brand-100 text-brand-700',  dot: 'bg-brand-500 animate-pulse' },
  completed:             { label: 'Completed',  classes: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  completed_with_errors: { label: 'Partial',    classes: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  failed:                { label: 'Failed',     classes: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
  // entry statuses
  submitted:             { label: 'Submitted',  classes: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500 animate-pulse' },
  confirmed:             { label: 'Confirmed',  classes: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  skipped:               { label: 'Skipped',    classes: 'bg-slate-100 text-slate-400' },
  voucher_created:       { label: 'Voucher',    classes: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  // batch statuses
  confirmed_batch:       { label: 'Confirmed',  classes: 'bg-green-100 text-green-700' },
  unclaimed:             { label: 'Unclaimed',  classes: 'bg-slate-100 text-slate-500' },
  claimed:               { label: 'Claimed',    classes: 'bg-green-100 text-green-700' },
  reclaimed:             { label: 'Reclaimed',  classes: 'bg-slate-100 text-slate-400' },
  expired:               { label: 'Expired',    classes: 'bg-red-100 text-red-500' },
};

interface Props {
  status: string;
  small?: boolean;
}

export function StatusBadge({ status, small = false }: Props) {
  const cfg = CONFIG[status] ?? { label: status, classes: 'bg-slate-100 text-slate-500' };

  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      small ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
      cfg.classes,
    )}>
      {cfg.dot && (
        <span className={clsx('rounded-full flex-shrink-0', small ? 'w-1.5 h-1.5' : 'w-2 h-2', cfg.dot)} />
      )}
      {cfg.label}
    </span>
  );
}
