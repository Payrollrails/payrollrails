'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRun, getRunStatus, cancelRun, csvReportUrl, pdfReportUrl } from '@/lib/api';
import type { RunSummary, PayrollEntry, RunStatus } from '@/types';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Download, Square, RefreshCw, ArrowLeft,
  CheckCircle, XCircle, Clock, Send, Gift, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

const TERMINAL_STATUSES: RunStatus[] = ['completed', 'completed_with_errors', 'failed'];
const POLL_INTERVAL = 1500;

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [data, setData] = useState<RunSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetch = useCallback(async () => {
    try {
      const d = await getRun(runId);
      setData(d);
      // Stop polling when terminal
      if (TERMINAL_STATUSES.includes(d.run.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch {
      // backend may still be starting
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetch();
    pollRef.current = setInterval(fetch, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetch]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelRun(runId);
      toast.info('Cancellation requested');
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { run, entries, batches, statusCounts } = data;
  const isLive = !TERMINAL_STATUSES.includes(run.status);
  const totalConfirmed = statusCounts.confirmed || 0;
  const totalFailed = statusCounts.failed || 0;
  const totalVoucher = statusCounts.voucher_created || 0;
  const totalPending = (statusCounts.pending || 0) + (statusCounts.submitted || 0);
  const progress = run.total_rows > 0
    ? Math.round(((totalConfirmed + totalFailed + totalVoucher) / run.total_rows) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/runs')}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Runs
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{run.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={run.status} />
            {run.dry_run === 1 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                DRY RUN
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono">{runId.slice(0, 8)}…</span>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-brand-600">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse inline-block" />
                Live
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-red-600" />
              {cancelling ? 'Cancelling…' : 'Stop'}
            </button>
          )}
          <a
            href={csvReportUrl(runId)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
          <a
            href={pdfReportUrl(runId)}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> PDF Report
          </a>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {run.status === 'running' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600 font-medium">Progress</span>
            <span className="text-slate-500">{totalConfirmed + totalFailed + totalVoucher} / {run.total_rows}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span className="text-green-600">✓ {totalConfirmed} confirmed</span>
            {totalVoucher > 0 && <span className="text-amber-600">🎫 {totalVoucher} vouchers</span>}
            {totalFailed > 0 && <span className="text-red-500">✗ {totalFailed} failed</span>}
            <span className="text-slate-400">… {totalPending} pending</span>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<CheckCircle className="w-5 h-5 text-green-500" />} label="Confirmed" value={totalConfirmed} color="text-green-700" />
        <StatCard icon={<Gift className="w-5 h-5 text-amber-500" />} label="Vouchers" value={totalVoucher} color="text-amber-700" />
        <StatCard icon={<XCircle className="w-5 h-5 text-red-500" />} label="Failed" value={totalFailed} color="text-red-600" />
        <StatCard icon={<Clock className="w-5 h-5 text-slate-400" />} label="Pending" value={totalPending} color="text-slate-500" />
      </div>

      {/* ── Batches ── */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Send className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-sm text-slate-700">Transaction Batches</span>
        </div>
        <div className="divide-y divide-slate-100">
          {batches.map((b) => (
            <div key={b.id} className="px-4 py-3 flex items-center gap-4 text-sm">
              <span className="text-slate-400 w-16">Batch {b.batch_index + 1}</span>
              <StatusBadge status={b.status} small />
              <span className="text-slate-500">
                {entries.filter((e) => e.batch_index === b.batch_index).length} recipients
              </span>
              {b.fee_bump_hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${b.fee_bump_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 font-mono text-xs text-brand-600 hover:underline"
                >
                  {b.fee_bump_hash.slice(0, 12)}… <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {b.last_error && !b.fee_bump_hash && (
                <span className="ml-auto text-xs text-red-500 truncate max-w-xs" title={b.last_error}>
                  {b.last_error}
                </span>
              )}
              {b.attempt_count > 1 && (
                <span className="text-xs text-amber-500">↻ {b.attempt_count} attempts</span>
              )}
            </div>
          ))}
          {batches.length === 0 && (
            <div className="px-4 py-6 text-center text-slate-400 text-sm">No batches yet</div>
          )}
        </div>
      </div>

      {/* ── Entries table ── */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-700">Recipients</span>
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <RefreshCw className="w-3 h-3 animate-spin" /> Auto-refreshing
            </span>
          )}
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Country</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Amount</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">TX / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry: e }: { entry: PayrollEntry }) {
  return (
    <tr className={clsx(
      'hover:bg-slate-50 transition-colors',
      e.status === 'failed' && 'bg-red-50',
      e.status === 'confirmed' && 'bg-green-50/30',
    )}>
      <td className="px-4 py-2 text-slate-400 text-xs">{e.row_index + 1}</td>
      <td className="px-4 py-2 font-medium text-slate-800">
        {e.name}
        {e.email && <div className="text-xs text-slate-400">{e.email}</div>}
      </td>
      <td className="px-4 py-2 text-slate-500">{e.country || '—'}</td>
      <td className="px-4 py-2 text-right font-semibold">
        ${parseFloat(e.amount).toFixed(2)}
      </td>
      <td className="px-4 py-2 text-center">
        <StatusBadge status={e.status} small />
      </td>
      <td className="px-4 py-2 text-xs font-mono">
        {e.tx_hash && e.tx_hash !== 'DRY_RUN_SIMULATED' ? (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${e.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline flex items-center gap-1"
          >
            {e.tx_hash.slice(0, 10)}… <ExternalLink className="w-3 h-3" />
          </a>
        ) : e.tx_hash === 'DRY_RUN_SIMULATED' ? (
          <span className="text-amber-500">DRY RUN</span>
        ) : e.voucher_ref ? (
          <a href={e.claim_link || '#'} className="text-amber-600 hover:underline">
            🎫 {e.voucher_ref.slice(0, 8)}…
          </a>
        ) : e.error_msg ? (
          <span className="text-red-500" title={e.error_msg}>{e.error_msg.slice(0, 30)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
