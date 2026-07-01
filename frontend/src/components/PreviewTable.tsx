'use client';

import type { ParsedRow } from '@/types';
import { CheckCircle, XCircle, Gift } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  rows: ParsedRow[];
  compact?: boolean;
}

export function PreviewTable({ rows, compact = false }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-10">#</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Name</th>
              {!compact && <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Email / Address</th>}
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Country</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Amount</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Type</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Valid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.rowIndex}
                className={clsx(
                  'hover:bg-slate-50 transition-colors',
                  !row.valid && 'bg-red-50 hover:bg-red-50'
                )}
              >
                <td className="px-4 py-2 text-slate-400 text-xs">{row.rowNum}</td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {row.name || <span className="text-slate-300 italic">—</span>}
                </td>
                {!compact && (
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                    {row.address
                      ? `${row.address.slice(0, 8)}…${row.address.slice(-6)}`
                      : row.email
                        ? row.email
                        : <span className="text-red-400">missing</span>
                    }
                  </td>
                )}
                <td className="px-4 py-2 text-slate-600">
                  {row.country || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-slate-800">
                  ${parseFloat(row.amount || '0').toFixed(2)}
                </td>
                <td className="px-4 py-2 text-center">
                  {!row.address && row.email ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Gift className="w-3 h-3" /> Voucher
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Direct</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {row.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <span title={row.errors.join('\n')}>
                      <XCircle className="w-4 h-4 text-red-500 mx-auto cursor-help" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="text-center text-slate-400 py-8">No rows parsed</div>
      )}
    </div>
  );
}
