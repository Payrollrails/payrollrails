'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getVoucher, claimVoucher, faucetFund } from '@/lib/api';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import { Gift, CheckCircle, Zap, ExternalLink } from 'lucide-react';

// Stellar G-address: starts with G, 56 chars, base32
const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

type VoucherInfo = {
  ref: string;
  amount: string;
  claimer_email: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

export default function ClaimPage() {
  const { ref } = useParams<{ ref: string }>();
  const searchParams = useSearchParams();
  const secret = searchParams.get('s') ?? '';

  const [voucher, setVoucher] = useState<VoucherInfo | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [fundingFaucet, setFundingFaucet] = useState(false);
  const [addrError, setAddrError] = useState('');

  useEffect(() => {
    getVoucher(ref)
      .then(setVoucher)
      .catch(() => setVoucher(null))
      .finally(() => setLoading(false));
  }, [ref]);

  const validateAddress = (v: string) => {
    if (!v) { setAddrError(''); return; }
    if (!STELLAR_ADDR_RE.test(v)) setAddrError('Invalid Stellar address (must start with G, 56 chars)');
    else setAddrError('');
  };

  const handleClaim = async () => {
    if (!address || addrError) return;
    setClaiming(true);
    try {
      await claimVoucher(ref, secret, address);
      setClaimed(true);
      toast.success('Voucher claimed! USDC will arrive shortly.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  const handleFaucet = async () => {
    if (!address || addrError) return;
    setFundingFaucet(true);
    try {
      await faucetFund(address);
      toast.success('Testnet account funded with XLM!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Faucet failed');
    } finally {
      setFundingFaucet(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Voucher not found</h1>
        <p className="text-slate-500 text-sm">This voucher link may be invalid or expired.</p>
      </div>
    );
  }

  if (claimed || voucher.status === 'claimed') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Voucher Claimed!</h1>
        <p className="text-slate-500 mb-4">
          <span className="font-semibold text-green-700">${parseFloat(voucher.amount).toFixed(2)} USDC</span>{' '}
          is being sent to your Stellar wallet.
        </p>
        <a
          href={`https://stellar.expert/explorer/testnet/account/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-brand-600 hover:underline text-sm"
        >
          View on Stellar Expert <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  if (voucher.status === 'expired') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">⏰</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Voucher Expired</h1>
        <p className="text-slate-500 text-sm">This voucher has expired. Contact the issuer for a new one.</p>
      </div>
    );
  }

  if (voucher.status === 'reclaimed') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">↩</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Voucher Reclaimed</h1>
        <p className="text-slate-500 text-sm">The issuer has reclaimed this voucher. Contact them for assistance.</p>
      </div>
    );
  }

  const expires = new Date(voucher.expires_at);
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000));

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-8 text-center text-white">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold mb-1">You&apos;ve been paid!</h1>
          <p className="text-brand-100 text-sm">Claim your USDC to any Stellar wallet</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount */}
          <div className="text-center bg-brand-50 rounded-xl py-4">
            <div className="text-4xl font-bold text-brand-700">
              ${parseFloat(voucher.amount).toFixed(2)}
            </div>
            <div className="text-brand-500 text-sm mt-1">USDC on Stellar</div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-0.5">Status</div>
              <StatusBadge status={voucher.status} small />
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-0.5">Expires in</div>
              <div className="font-semibold text-slate-700">{daysLeft} days</div>
            </div>
          </div>

          {/* Claim form */}
          {!secret && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              ⚠ Missing claim secret. Use the full link from your email.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Your Stellar wallet address
            </label>
            <input
              value={address}
              onChange={(e) => { setAddress(e.target.value); validateAddress(e.target.value); }}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {addrError && <p className="text-xs text-red-500">{addrError}</p>}
            <p className="text-xs text-slate-400">
              Don&apos;t have a wallet? Create one at{' '}
              <a href="https://lobstr.co" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                lobstr.co
              </a>
              {' or '}
              <a href="https://stellarterm.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                stellarterm.com
              </a>
            </p>
          </div>

          <button
            onClick={handleClaim}
            disabled={claiming || !address || !!addrError || !secret}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {claiming ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Claiming…
              </span>
            ) : (
              `Claim $${parseFloat(voucher.amount).toFixed(2)} USDC`
            )}
          </button>

          {/* Testnet helper */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400 mb-2 text-center">
              On testnet? Fund your account first:
            </p>
            <button
              onClick={handleFaucet}
              disabled={fundingFaucet || !address || !!addrError}
              className="w-full py-2 flex items-center justify-center gap-2 text-sm border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              {fundingFaucet ? 'Funding…' : 'Get testnet XLM (Friendbot)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
