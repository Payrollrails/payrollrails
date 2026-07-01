export type EntryStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'skipped'
  | 'voucher_created';

export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

export interface ParsedRow {
  rowIndex: number;
  rowNum: number;
  name: string;
  email: string;
  address: string;
  amount: string;
  currency: string;
  country: string;
  note: string;
  valid: boolean;
  errors: string[];
}

export interface UploadSummary {
  total: number;
  valid: number;
  invalid: number;
  totalAmount: string;
  countries: string[];
  voucherCount: number;
}

export interface PayrollEntry {
  id: string;
  run_id: string;
  row_index: number;
  name: string;
  email: string;
  address: string;
  amount: string;
  currency: string;
  country: string;
  note: string;
  status: EntryStatus;
  tx_hash: string | null;
  error_msg: string | null;
  batch_index: number;
  voucher_ref: string | null;
  claim_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollBatch {
  id: string;
  run_id: string;
  batch_index: number;
  status: string;
  tx_hash: string | null;
  fee_bump_hash: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollRun {
  id: string;
  name: string;
  status: RunStatus;
  total_rows: number;
  funded_amount: string;
  source_account: string;
  network: string;
  dry_run: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_msg: string | null;
  entry_count?: number;
  confirmed_count?: number;
  failed_count?: number;
}

export interface RunSummary {
  run: PayrollRun;
  entries: PayrollEntry[];
  batches: PayrollBatch[];
  statusCounts: Record<string, number>;
}

export interface StellarInfo {
  network: string;
  funderConfigured: boolean;
  funderPublicKey: string | null;
}

export interface BalanceInfo {
  address: string;
  usdc: number;
  xlm: number;
  hasTrustline: boolean;
}
