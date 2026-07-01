'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { uploadFile, createRun, executeRun } from '@/lib/api';
import type { ParsedRow, UploadSummary } from '@/types';
import { PreviewTable } from '@/components/PreviewTable';
import { SummaryBar } from '@/components/SummaryBar';
import { FunderPanel } from '@/components/FunderPanel';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, Play, RotateCcw, ChevronRight,
  Zap, Globe, Shield, TrendingDown,
} from 'lucide-react';
import clsx from 'clsx';

type Step = 'upload' | 'preview' | 'fund' | 'confirm';

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [runName, setRunName] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const result = await uploadFile(f);
      setRows(result.rows);
      setSummary(result.summary);
      setRunName(`Payroll ${new Date().toLocaleDateString()}`);
      setStep('preview');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
  });

  // ── Create run + execute ──────────────────────────────────────────────────
  const handleExecute = async () => {
    if (!file || !runName.trim()) return;
    setLoading(true);
    try {
      const { runId: id } = await createRun(file, runName, dryRun);
      setRunId(id);
      await executeRun(id);
      toast.success('Run started! Redirecting to live status…');
      router.push(`/runs/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to start run');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setRows([]);
    setSummary(null);
    setRunId(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Hero ── */}
      {step === 'upload' && (
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            Pay anyone, anywhere,{' '}
            <span className="text-brand-600">instantly.</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Upload a CSV of recipients → preview → fund → run.
            Batched Stellar USDC payments with crash-safe retries and audit-ready reports.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mt-8 max-w-3xl mx-auto">
            {[
              { icon: Zap, label: '~8 seconds', sub: '50 payments' },
              { icon: TrendingDown, label: '~$0.05', sub: 'total fees' },
              { icon: Globe, label: '5 countries', sub: 'demo seed' },
              { icon: Shield, label: 'Crash-safe', sub: 'auto-recovery' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                <Icon className="w-5 h-5 text-brand-600 mx-auto mb-1" />
                <div className="font-bold text-slate-800">{label}</div>
                <div className="text-xs text-slate-500">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step indicator ── */}
      {step !== 'upload' && (
        <div className="flex items-center gap-2 mb-6 text-sm">
          {(['upload', 'preview', 'fund', 'confirm'] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className={clsx(
                'px-3 py-1 rounded-full font-medium',
                step === s
                  ? 'bg-brand-600 text-white'
                  : ['upload', 'preview', 'fund', 'confirm'].indexOf(step) > i
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-slate-100 text-slate-400'
              )}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 3 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </span>
          ))}
          <button onClick={reset} className="ml-auto text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      )}

      {/* ── Upload step ── */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all',
              isDragActive
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
            )}
          >
            <input {...getInputProps()} />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-600">Parsing file…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-12 h-12 text-brand-400" />
                <p className="text-lg font-medium text-slate-700">
                  {isDragActive ? 'Drop it!' : 'Drag & drop your CSV or XLSX'}
                </p>
                <p className="text-sm text-slate-400">or click to browse — up to 10 MB, ≤100 recipients per batch</p>
                <button className="mt-2 px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
                  Choose File
                </button>
              </div>
            )}
          </div>

          {/* Demo load */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-slate-400 text-sm">or</span>
            <button
              onClick={async () => {
                const res = await fetch('/demo-recipients.csv');
                const blob = await res.blob();
                const f = new File([blob], 'demo-recipients.csv', { type: 'text/csv' });
                onDrop([f]);
              }}
              className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium border border-brand-200 px-4 py-2 rounded-lg hover:bg-brand-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Load 50-recipient demo
            </button>
          </div>
        </div>
      )}

      {/* ── Preview step ── */}
      {step === 'preview' && summary && (
        <div className="space-y-4">
          <SummaryBar summary={summary} filename={file?.name || ''} />
          <PreviewTable rows={rows} />
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">
              {summary.invalid > 0 && (
                <span className="text-amber-600 font-medium">
                  ⚠ {summary.invalid} invalid row{summary.invalid > 1 ? 's' : ''} will be skipped.{' '}
                </span>
              )}
              {summary.valid} valid recipients ready.
            </p>
            <button
              disabled={summary.valid === 0}
              onClick={() => setStep('fund')}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Continue to Fund <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Fund step ── */}
      {step === 'fund' && summary && (
        <div className="space-y-4">
          <FunderPanel summary={summary} />
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep('preview')} className="text-sm text-slate-500 hover:text-slate-700">
              ← Back to Preview
            </button>
            <button
              onClick={() => setStep('confirm')}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm + Run step ── */}
      {step === 'confirm' && summary && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-800 text-lg">Confirm & Execute</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Run name</label>
                <input
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Payroll June 2026"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setDryRun(!dryRun)}
                    className={clsx(
                      'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
                      dryRun ? 'bg-amber-400' : 'bg-slate-200'
                    )}
                  >
                    <div className={clsx(
                      'w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-transform',
                      dryRun ? 'translate-x-5' : 'translate-x-1'
                    )} />
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {dryRun ? '🟡 Dry-run mode (simulated)' : '🟢 Live mode'}
                  </span>
                </label>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-800">{summary.valid}</div>
                <div className="text-xs text-slate-500">Recipients</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-600">${summary.totalAmount}</div>
                <div className="text-xs text-slate-500">Total USDC</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{summary.countries.length}</div>
                <div className="text-xs text-slate-500">Countries</div>
              </div>
            </div>

            {summary.voucherCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                🎫 {summary.voucherCount} recipients have no wallet address &mdash; they&apos;ll receive a claim voucher link.
              </div>
            )}

            {dryRun && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                ⚠ Dry-run mode: no real transactions will be submitted. Perfect for testing.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep('fund')} className="text-sm text-slate-500 hover:text-slate-700">
              ← Back
            </button>
            <button
              disabled={loading || !runName.trim()}
              onClick={handleExecute}
              className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Starting…</>
              ) : (
                <><Play className="w-4 h-4 fill-white" /> Execute Payroll</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
