'use client';

import type { UploadSummary } from '@/types';
import { CheckCircle, XCircle, DollarSign, Globe, Gift } from 'lucide-react';

interface Props {
  summary: UploadSummary;
  filename: string;
}

export function SummaryBar({ summary, filename }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">Preview</span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filename}</span>
        </div>
        <span className="text-sm text-slate-500">{summary.total} rows parsed</span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <Stat
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          label="Valid"
          value={summary.valid}
          color="text-green-700"
        />
        <Stat
          icon={<XCircle className="w-4 h-4 text-red-500" />}
          label="Invalid"
          value={summary.invalid}
          color={summary.invalid > 0 ? 'text-red-600' : 'text-slate-400'}
        />
        <Stat
          icon={<DollarSign className="w-4 h-4 text-brand-600" />}
          label="Total USDC"
          value={`$${summary.totalAmount}`}
          color="text-brand-700"
        />
        <Stat
          icon={<Globe className="w-4 h-4 text-indigo-500" />}
          label="Countries"
          value={summary.countries.length || '—'}
          color="text-indigo-700"
        />
        <Stat
          icon={<Gift className="w-4 h-4 text-amber-500" />}
          label="Vouchers"
          value={summary.voucherCount}
          color={summary.voucherCount > 0 ? 'text-amber-700' : 'text-slate-400'}
        />
      </div>
      {summary.countries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summary.countries.map((c) => (
            <span key={c} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className={`font-bold text-lg ${color}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
