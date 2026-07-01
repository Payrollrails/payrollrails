import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Memo,
  BASE_FEE as SDK_BASE_FEE,
} from '@stellar/stellar-sdk';
import {
  HORIZON_URL,
  STELLAR_NETWORK,
  FUNDER_SECRET_KEY,
  FEE_BUMP_SECRET_KEY,
  USDC_ISSUER,
  BASE_FEE,
  MAX_OPS_PER_TX,
} from '../config.js';

// ── Singletons ────────────────────────────────────────────────────────────────
let _server;
export function getServer() {
  if (!_server) _server = new Horizon.Server(HORIZON_URL);
  return _server;
}

export function getNetwork() {
  return STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}

export function getFunderKeypair() {
  if (!FUNDER_SECRET_KEY) throw new Error('FUNDER_SECRET_KEY not configured');
  return Keypair.fromSecret(FUNDER_SECRET_KEY);
}

export function getFeeBumpKeypair() {
  const key = FEE_BUMP_SECRET_KEY || FUNDER_SECRET_KEY;
  if (!key) throw new Error('FEE_BUMP_SECRET_KEY not configured');
  return Keypair.fromSecret(key);
}

export const USDC = new Asset('USDC', USDC_ISSUER);

// ── Account helpers ───────────────────────────────────────────────────────────
export async function loadAccount(publicKey) {
  return getServer().loadAccount(publicKey);
}

export async function getUsdcBalance(publicKey) {
  try {
    const account = await loadAccount(publicKey);
    const bal = account.balances.find(
      (b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER
    );
    return bal ? parseFloat(bal.balance) : 0;
  } catch {
    return 0;
  }
}

export async function getNativeBalance(publicKey) {
  try {
    const account = await loadAccount(publicKey);
    const bal = account.balances.find((b) => b.asset_type === 'native');
    return bal ? parseFloat(bal.balance) : 0;
  } catch {
    return 0;
  }
}

// ── Trustline check ───────────────────────────────────────────────────────────
export async function hasTrustline(publicKey) {
  try {
    const account = await loadAccount(publicKey);
    return account.balances.some(
      (b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER
    );
  } catch {
    return false;
  }
}

// ── Testnet faucet ────────────────────────────────────────────────────────────
export async function fundTestnetAccount(publicKey) {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Friendbot failed: ${body}`);
  }
  return res.json();
}

// ── Build a batched payment transaction ──────────────────────────────────────
/**
 * @param {string} sourcePublicKey  - funder account (sequence holder)
 * @param {Array<{address: string, amount: string, note?: string}>} payments
 * @param {number} batchIndex - for memo reference
 * @returns {Transaction}
 */
export async function buildPaymentTx(sourcePublicKey, payments, batchIndex) {
  const account = await loadAccount(sourcePublicKey);
  const network = getNetwork();
  const feePerOp = Math.max(BASE_FEE, parseInt(SDK_BASE_FEE));

  const builder = new TransactionBuilder(account, {
    fee: String(feePerOp),
    networkPassphrase: network,
  }).addMemo(Memo.text(`PayrollRails-${batchIndex}`));

  for (const p of payments) {
    builder.addOperation(
      Operation.payment({
        destination: p.address,
        asset: USDC,
        amount: parseFloat(p.amount).toFixed(7),
      })
    );
  }

  return builder.setTimeout(300).build(); // 5 min timeout
}

// ── Fee bump wrapper ──────────────────────────────────────────────────────────
export function wrapFeeBump(innerTx) {
  const feeBumpKp = getFeeBumpKeypair();
  const network = getNetwork();
  const numOps = innerTx.operations.length;
  // Fee bump pays (ops + 1) * fee per op
  const feeBumpFee = String((numOps + 1) * Math.max(BASE_FEE, parseInt(SDK_BASE_FEE)));

  const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    feeBumpKp,
    feeBumpFee,
    innerTx,
    network
  );
  feeBumpTx.sign(feeBumpKp);
  return feeBumpTx;
}

// ── Submit with retry ─────────────────────────────────────────────────────────
const RETRIABLE_CODES = new Set([
  'tx_too_late',
  'tx_bad_seq',
  'tx_insufficient_fee',
  'tx_bad_auth_extra',
]);

export async function submitTx(tx) {
  try {
    const result = await getServer().submitTransaction(tx);
    return { success: true, hash: result.hash, result };
  } catch (err) {
    const code = err?.response?.data?.extras?.result_codes?.transaction;
    const opCodes = err?.response?.data?.extras?.result_codes?.operations || [];
    return {
      success: false,
      code,
      opCodes,
      retriable: RETRIABLE_CODES.has(code) || code === undefined,
      error: err?.response?.data?.detail || err.message,
    };
  }
}

// ── Batch splitter ────────────────────────────────────────────────────────────
export function splitIntoBatches(entries, batchSize = MAX_OPS_PER_TX) {
  const batches = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }
  return batches;
}

// ── Transaction status poller ─────────────────────────────────────────────────
export async function waitForConfirmation(hash, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await getServer().transactions().transaction(hash).call();
      if (tx.successful) return { confirmed: true, tx };
    } catch {
      // not found yet
    }
    await sleep(2_000);
  }
  return { confirmed: false };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
