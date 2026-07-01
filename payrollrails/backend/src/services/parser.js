import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

// ── Schema ────────────────────────────────────────────────────────────────────
const RecipientRow = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  amount: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be positive number'),
  currency: z.string().default('USDC'),
  country: z.string().optional().or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
});

// Normalize header aliases
const HEADER_MAP = {
  // name
  name: 'name', full_name: 'name', fullname: 'name', recipient: 'name',
  // email
  email: 'email', email_address: 'email', emailaddress: 'email',
  // address
  address: 'address', stellar_address: 'address', wallet: 'address', wallet_address: 'address',
  // amount
  amount: 'amount', payment: 'amount', pay: 'amount', usd: 'amount', usdc: 'amount',
  // currency
  currency: 'currency', asset: 'currency', token: 'currency',
  // country
  country: 'country', country_code: 'country', location: 'country',
  // note
  note: 'note', memo: 'note', description: 'note', reference: 'note',
};

function normalizeHeaders(raw) {
  return raw.map((h) => {
    const key = String(h).toLowerCase().trim().replace(/\s+/g, '_');
    return HEADER_MAP[key] || key;
  });
}

function parseRows(records) {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Skip completely empty rows
    const vals = Object.values(raw).map((v) => String(v || '').trim());
    if (vals.every((v) => v === '')) continue;

    const normalized = {};
    for (const [k, v] of Object.entries(raw)) {
      normalized[k] = typeof v === 'number' ? String(v) : String(v || '').trim();
    }

    const parsed = RecipientRow.safeParse(normalized);
    const errors = [];

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }

    const data = parsed.success ? parsed.data : { ...normalized };

    // Validate Stellar address if provided
    if (data.address && data.address !== '') {
      if (!StrKey.isValidEd25519PublicKey(data.address)) {
        errors.push(`address: invalid Stellar public key`);
      }
    }

    // Must have at least address or email
    if ((!data.address || data.address === '') && (!data.email || data.email === '')) {
      errors.push('Must provide either address or email');
    }

    results.push({
      rowIndex: i,
      rowNum,
      name: data.name || '',
      email: data.email || '',
      address: data.address || '',
      amount: data.amount || '0',
      currency: (data.currency || 'USDC').toUpperCase(),
      country: data.country || '',
      note: data.note || '',
      valid: errors.length === 0,
      errors,
    });
  }
  return results;
}

// ── CSV ───────────────────────────────────────────────────────────────────────
export function parseCsv(buffer) {
  const records = parse(buffer, {
    columns: (headers) => normalizeHeaders(headers),
    skip_empty_lines: true,
    trim: true,
    cast: false,
  });
  return parseRows(records);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────
export function parseXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

  // Normalize headers
  const normalizedRecords = raw.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const nk = HEADER_MAP[k.toLowerCase().trim().replace(/\s+/g, '_')] || k.toLowerCase().trim();
      out[nk] = v;
    }
    return out;
  });

  return parseRows(normalizedRecords);
}

// ── Auto-detect ───────────────────────────────────────────────────────────────
export function parseFile(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'csv') return parseCsv(buffer);
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(buffer);
  throw new Error(`Unsupported file type: .${ext}`);
}

export function summarize(rows) {
  const valid = rows.filter((r) => r.valid);
  const invalid = rows.filter((r) => !r.valid);
  const totalAmount = valid.reduce((s, r) => s + parseFloat(r.amount), 0);
  const countries = [...new Set(valid.map((r) => r.country).filter(Boolean))];
  const hasVoucher = valid.filter((r) => !r.address && r.email);
  return {
    total: rows.length,
    valid: valid.length,
    invalid: invalid.length,
    totalAmount: totalAmount.toFixed(2),
    countries,
    voucherCount: hasVoucher.length,
  };
}
