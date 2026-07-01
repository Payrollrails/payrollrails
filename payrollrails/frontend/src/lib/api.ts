import axios from 'axios';
import type {
  ParsedRow, UploadSummary, PayrollRun, RunSummary,
  PayrollEntry, StellarInfo, BalanceInfo,
} from '@/types';

const api = axios.create({ baseURL: '/api' });

// ── Upload ────────────────────────────────────────────────────────────────────
export async function uploadFile(
  file: File
): Promise<{ rows: ParsedRow[]; summary: UploadSummary }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload', fd);
  return res.data;
}

// ── Runs ──────────────────────────────────────────────────────────────────────
export async function listRuns(): Promise<PayrollRun[]> {
  const res = await api.get('/runs');
  return res.data;
}

export async function createRun(
  file: File,
  name: string,
  dryRun: boolean,
  sourceAccount?: string
): Promise<{ runId: string; batchCount: number; entryCount: number }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name);
  fd.append('dryRun', String(dryRun));
  if (sourceAccount) fd.append('sourceAccount', sourceAccount);
  const res = await api.post('/runs', fd);
  return res.data;
}

export async function getRun(runId: string): Promise<RunSummary> {
  const res = await api.get(`/runs/${runId}`);
  return res.data;
}

export async function getRunStatus(
  runId: string
): Promise<{ id: string; status: string; statusCounts: Record<string, number> }> {
  const res = await api.get(`/runs/${runId}/status`);
  return res.data;
}

export async function executeRun(runId: string): Promise<void> {
  await api.post(`/runs/${runId}/execute`);
}

export async function cancelRun(runId: string): Promise<void> {
  await api.post(`/runs/${runId}/cancel`);
}

export async function getRunEntries(runId: string): Promise<PayrollEntry[]> {
  const res = await api.get(`/runs/${runId}/entries`);
  return res.data;
}

// ── Stellar ───────────────────────────────────────────────────────────────────
export async function getStellarInfo(): Promise<StellarInfo> {
  const res = await api.get('/stellar/info');
  return res.data;
}

export async function getBalance(address: string): Promise<BalanceInfo> {
  const res = await api.get(`/stellar/balance/${address}`);
  return res.data;
}

export async function faucetFund(address: string): Promise<void> {
  await api.post('/stellar/faucet', { address });
}

// ── Vouchers ──────────────────────────────────────────────────────────────────
export async function getVoucher(ref: string) {
  const res = await api.get(`/vouchers/${ref}`);
  return res.data;
}

export async function claimVoucher(ref: string, secret: string, address: string) {
  const res = await api.post(`/vouchers/${ref}/claim`, { secret, address });
  return res.data;
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function csvReportUrl(runId: string) {
  return `/api/reports/${runId}/csv`;
}
export function pdfReportUrl(runId: string) {
  return `/api/reports/${runId}/pdf`;
}
