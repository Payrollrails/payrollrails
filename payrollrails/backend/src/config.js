import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet';
export const HORIZON_URL =
  process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

export const FUNDER_SECRET_KEY = process.env.FUNDER_SECRET_KEY || '';
export const FEE_BUMP_SECRET_KEY = process.env.FEE_BUMP_SECRET_KEY || '';

// USDC on Stellar testnet (Centre/Circle test issuer)
export const USDC_ISSUER =
  process.env.USDC_ISSUER ||
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const VOUCHER_CONTRACT_ID = process.env.VOUCHER_CONTRACT_ID || '';

export const dbPath = path.resolve(
  __dirname,
  '../../',
  process.env.DB_PATH || 'data/payrollrails.db'
);

// Stellar limits
export const MAX_OPS_PER_TX = 100;
export const BASE_FEE = 100; // stroops per op
export const MAX_RETRY_ATTEMPTS = 5;
export const INITIAL_BACKOFF_MS = 1_000;

// Voucher expiry (days from creation)
export const VOUCHER_EXPIRY_DAYS = 30;
