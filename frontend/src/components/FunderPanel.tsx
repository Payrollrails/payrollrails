'use client';

import { useEffect, useState } from 'react';
import { getStellarInfo, getBalance, faucetFund } from '@/lib/api';
import type { StellarInfo, BalanceInfo, UploadSummary } from '@/types';
import { toast } from 'sonner';
import { RefreshCw, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  summary: UploadSummary;
}

export function FunderPanel({ summary }: Props) {
  const [info, setInfo] = useState<StellarInfo | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [funding, setFunding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const needed = parseFloat(summary.totalAmount);

  const load = async () => {
    try {
      const i = await getStellarInfo();
      setInfo(i);
      if (i.funderPublicKey) {
        const b = await getBalance(i.funderPublicKey);
        setBalance(b);
      }
    } catch {
      // ignore — backend may not be configured yet
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleFaucet = async () => {
    if (!info?.funderPublicKey) return;
    setFunding(true);
    try {
      await faucetFund(info.funderPublicKey);
      toast.success('Testnet account funded with 10,000 XLM!');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Faucet failed');
    } finally {
      setFunding(false);
    }
  };

  const sufficient = balance && balance.usdc >= needed;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Funder Account</h2>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {!info?.funderConfigured ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          <p className="font-medium mb-1">⚙ Funder wallet not configured</p>
          <p>
            Set <code className="bg-amber-100 px-1 rounded">FUNDER_SECRET_KEY</code> in{' '}
            <code className="bg-amber-100 px-1 rounded">backend/.env</code> to send live payments.
            You can still run in <strong>dry-run mode</strong> to test the full flow.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="font-mono text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 break-all">
            {info.funderPublicKey}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-0.5">USDC Balance</div>
              <div className={clsx(
                'text-xl font-bold',
                !balance ? 'text-slate-300' :
                  sufficient ? 'text-green-600' : 'text-red-500'
              )}>
                {balance ? `$${balance.usdc.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '…'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-0.5">XLM Balance</div>
              <div className="text-xl font-bold text-slate-700">
                {balance ? `${balance.xlm.toFixed(2)} XLM` : '…'}
              </div>
            </div>
          </div>

          <div className={clsx(
            'rounded-lg p-3 flex items-start gap-2 text-sm',
            sufficient
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          )}>
            {sufficient
              ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            }
            <div>
              {sufficient
                ? `✓ Sufficient funds — need $${needed.toFixed(2)} USDC, have $${balance!.usdc.toFixed(2)}`
                : `Insufficient — need $${needed.toFixed(2)} USDC but only have $${(balance?.usdc ?? 0).toFixed(2)}`
              }
            </div>
          </div>

          {info.network === 'testnet' && (
            <button
              onClick={handleFaucet}
              disabled={funding}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              {funding ? 'Funding…' : 'Testnet Faucet (10k XLM)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
