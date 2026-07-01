'use client';

import { useEffect, useState } from 'react';
import { listRuns } from '@/lib/api';
import type { PayrollRun } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, ChevronRight, Layers } from 'lucide-react';
import Link from 'next/link';

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await listRuns();
      setRuns(data);
    } catch { /* backend may be starting */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalPaid = runs.reduce((s, r) => s + (r.confirmed_count ?? 0), 0);
  const totalRuns = runs.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll Runs</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalRuns} run{totalRuns !== 1 ? 's' : ''} · {totalPaid} total confirmed payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Run
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No runs yet</p>
          <p className="text-slate-400 text-sm mt-1">Upload a CSV to create your first payroll run</p>
          <Link href="/" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
            <Plus className="w-4 h-4" /> Start Now
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} onClick={() => router.push(`/runs/${run.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunRow({ run, onClick }: { run: PayrollRun; onClick: () => void }) {
  const confirmed = run.confirmed_count ?? 0;
  const failed = run.failed_count ?? 0;
  const total = run.total_rows;
  const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-slate-800 truncate">{run.name}</span>
          {run.dry_run === 1 && (
            <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded flex-shrink-0">DRY</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-mono">{run.id.slice(0, 8)}…</span>
          <span>{new Date(run.created_at).toLocaleString()}</span>
          <span className="uppercase">{run.network}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-32 hidden sm:block">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{confirmed}/{total}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {failed > 0 && (
          <div className="text-xs text-red-500 mt-0.5">{failed} failed</div>
        )}
      </div>

      <StatusBadge status={run.status} small />
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </div>
  );
}
