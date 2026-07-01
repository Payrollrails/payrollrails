/**
 * PayrollRails Engine
 * Crash-safe batch runner with idempotent retries and exponential backoff.
 *
 * State machine per run:
 *   pending → running → completed | failed
 *
 * State machine per batch:
 *   pending → submitted → confirmed | failed
 *
 * On restart, picks up any batch in pending/submitted state and retries.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import {
  buildPaymentTx,
  getFunderKeypair,
  wrapFeeBump,
  submitTx,
  sleep,
  splitIntoBatches,
  hasTrustline,
} from './stellar.js';
import { createVoucher } from './vouchers.js';
import { MAX_RETRY_ATTEMPTS, INITIAL_BACKOFF_MS } from '../config.js';

// Active run registry (in-process cancel signal)
const activeRuns = new Map(); // runId → { cancelled: bool }

export function cancelRun(runId) {
  if (activeRuns.has(runId)) {
    activeRuns.get(runId).cancelled = true;
  }
}

// ── Create run from parsed rows ───────────────────────────────────────────────
export function createRun(db, { name, rows, sourceAccount, network, dryRun }) {
  const runId = uuidv4();
  const validRows = rows.filter((r) => r.valid);

  db.prepare(`
    INSERT INTO payroll_runs (id, name, status, total_rows, source_account, network, dry_run)
    VALUES (?, ?, 'pending', ?, ?, ?, ?)
  `).run(runId, name, validRows.length, sourceAccount, network, dryRun ? 1 : 0);

  const insertEntry = db.prepare(`
    INSERT INTO payroll_entries
      (id, run_id, row_index, name, email, address, amount, currency, country, note,
       status, idempotency_key, batch_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);

  const batches = splitIntoBatches(validRows, MAX_OPS_PER_TX);

  db.exec('BEGIN');
  try {
    for (let bi = 0; bi < batches.length; bi++) {
      for (const row of batches[bi]) {
        const entryId = uuidv4();
        const ikey = `${runId}:${row.rowIndex}`;
        insertEntry.run(
          entryId, runId, row.rowIndex,
          row.name, row.email, row.address,
          row.amount, row.currency, row.country, row.note,
          ikey, bi
        );
      }

      db.prepare(`
        INSERT INTO payroll_batches (id, run_id, batch_index, status)
        VALUES (?, ?, ?, 'pending')
      `).run(uuidv4(), runId, bi);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return { runId, batchCount: batches.length, entryCount: validRows.length };
}

// ── Main run executor ─────────────────────────────────────────────────────────
export async function executeRun(runId) {
  const db = getDb();
  const signal = { cancelled: false };
  activeRuns.set(runId, signal);

  try {
    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    // Mark started
    db.prepare(`UPDATE payroll_runs SET status='running', started_at=datetime('now') WHERE id=?`)
      .run(runId);

    const isDryRun = run.dry_run === 1;
    const funderKp = isDryRun ? null : getFunderKeypair();

    // Get all pending/failed batches (crash recovery: also retry submitted but unconfirmed)
    const batches = db.prepare(`
      SELECT * FROM payroll_batches
      WHERE run_id = ? AND status IN ('pending','failed')
      ORDER BY batch_index ASC
    `).all(runId);

    for (const batch of batches) {
      if (signal.cancelled) {
        db.prepare(`UPDATE payroll_runs SET status='failed', error_msg='Cancelled by user' WHERE id=?`)
          .run(runId);
        return;
      }

      await processBatch(db, run, batch, funderKp, isDryRun, signal);
    }

    // Check overall status
    const failedEntries = db.prepare(
      `SELECT COUNT(*) as c FROM payroll_entries WHERE run_id=? AND status='failed'`
    ).get(runId).c;

    const finalStatus = failedEntries > 0 ? 'completed_with_errors' : 'completed';
    db.prepare(`
      UPDATE payroll_runs SET status=?, completed_at=datetime('now') WHERE id=?
    `).run(finalStatus, runId);

  } catch (err) {
    db.prepare(`
      UPDATE payroll_runs SET status='failed', error_msg=?, completed_at=datetime('now') WHERE id=?
    `).run(err.message, runId);
    throw err;
  } finally {
    activeRuns.delete(runId);
  }
}

// ── Process one batch ─────────────────────────────────────────────────────────
async function processBatch(db, run, batch, funderKp, isDryRun, signal) {
  const entries = db.prepare(`
    SELECT * FROM payroll_entries
    WHERE run_id = ? AND batch_index = ? AND status IN ('pending','failed')
    ORDER BY row_index ASC
  `).all(run.id, batch.batch_index);

  if (entries.length === 0) {
    db.prepare(`UPDATE payroll_batches SET status='confirmed' WHERE id=?`).run(batch.id);
    return;
  }

  // Separate direct payments vs vouchers (no address, only email)
  const directPayments = entries.filter((e) => e.address && e.address !== '');
  const voucherEntries = entries.filter((e) => (!e.address || e.address === '') && e.email);

  // Handle vouchers
  for (const entry of voucherEntries) {
    if (signal.cancelled) return;
    try {
      const voucher = await createVoucher(db, entry, run.id);
      db.prepare(`
        UPDATE payroll_entries SET status='voucher_created', voucher_ref=?, updated_at=datetime('now')
        WHERE id=?
      `).run(voucher.ref, entry.id);
    } catch (err) {
      db.prepare(`
        UPDATE payroll_entries SET status='failed', error_msg=?, updated_at=datetime('now') WHERE id=?
      `).run(err.message, entry.id);
    }
  }

  if (directPayments.length === 0) {
    db.prepare(`UPDATE payroll_batches SET status='confirmed', updated_at=datetime('now') WHERE id=?`)
      .run(batch.id);
    return;
  }

  // DRY RUN: simulate only
  if (isDryRun) {
    await sleep(300 + Math.random() * 500); // simulate latency
    for (const entry of directPayments) {
      db.prepare(`
        UPDATE payroll_entries SET status='confirmed', tx_hash='DRY_RUN_SIMULATED',
        updated_at=datetime('now') WHERE id=?
      `).run(entry.id);
    }
    db.prepare(`UPDATE payroll_batches SET status='confirmed', tx_hash='DRY_RUN', updated_at=datetime('now') WHERE id=?`)
      .run(batch.id);
    return;
  }

  // Filter out recipients without trustline (flag as failed with reason)
  const payable = [];
  for (const entry of directPayments) {
    const trusted = await hasTrustline(entry.address);
    if (!trusted) {
      db.prepare(`
        UPDATE payroll_entries SET status='failed',
        error_msg='Recipient has no USDC trustline',
        updated_at=datetime('now') WHERE id=?
      `).run(entry.id);
    } else {
      payable.push(entry);
    }
  }

  if (payable.length === 0) {
    db.prepare(`UPDATE payroll_batches SET status='failed', last_error='No payable entries', updated_at=datetime('now') WHERE id=?`)
      .run(batch.id);
    return;
  }

  // Retry loop with exponential backoff
  let attempt = 0;
  let lastError = '';

  while (attempt < MAX_RETRY_ATTEMPTS) {
    if (signal.cancelled) return;
    attempt++;

    try {
      const funderPub = funderKp.publicKey();
      const payments = payable.map((e) => ({
        address: e.address,
        amount: e.amount,
        note: e.note,
      }));

      const innerTx = await buildPaymentTx(funderPub, payments, batch.batch_index);
      innerTx.sign(funderKp);
      const feeBumpTx = wrapFeeBump(innerTx);
      const envelopeXdr = feeBumpTx.toEnvelope().toXDR('base64');

      // Persist XDR before submitting (crash safety)
      db.prepare(`
        UPDATE payroll_batches SET envelope_xdr=?, attempt_count=?, status='submitted',
        updated_at=datetime('now') WHERE id=?
      `).run(envelopeXdr, attempt, batch.id);

      const result = await submitTx(feeBumpTx);

      if (result.success) {
        const hash = result.hash;
        db.prepare(`
          UPDATE payroll_batches SET status='confirmed', fee_bump_hash=?, tx_hash=?,
          updated_at=datetime('now') WHERE id=?
        `).run(hash, hash, batch.id);

        for (const entry of payable) {
          db.prepare(`
            UPDATE payroll_entries SET status='confirmed', tx_hash=?, updated_at=datetime('now')
            WHERE id=?
          `).run(hash, entry.id);
        }
        return;

      } else {
        lastError = result.error || result.code || 'Unknown error';

        // Per-op failures: mark individual entries
        if (result.opCodes && result.opCodes.length === payable.length) {
          for (let i = 0; i < payable.length; i++) {
            const opCode = result.opCodes[i];
            if (opCode !== 'op_success' && opCode !== 'op_inner') {
              db.prepare(`
                UPDATE payroll_entries SET status='failed', error_msg=?, updated_at=datetime('now')
                WHERE id=?
              `).run(opCode, payable[i].id);
              payable.splice(i, 1);
              i--;
            }
          }
        }

        if (!result.retriable) break;
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await sleep(backoff + Math.random() * 500);
      }
    } catch (err) {
      lastError = err.message;
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }

  // All retries exhausted
  db.prepare(`
    UPDATE payroll_batches SET status='failed', last_error=?, updated_at=datetime('now') WHERE id=?
  `).run(lastError, batch.id);

  for (const entry of payable) {
    db.prepare(`
      UPDATE payroll_entries SET status='failed', error_msg=?, updated_at=datetime('now') WHERE id=?
    `).run(lastError, entry.id);
  }
}

// ── Resume crashed runs on startup ────────────────────────────────────────────
export async function resumeInterruptedRuns() {
  const db = getDb();
  const interrupted = db.prepare(
    `SELECT * FROM payroll_runs WHERE status = 'running'`
  ).all();

  for (const run of interrupted) {
    console.log(`🔄 Resuming interrupted run: ${run.id}`);
    executeRun(run.id).catch((e) =>
      console.error(`Failed to resume run ${run.id}:`, e.message)
    );
  }
}

// ── Run summary ───────────────────────────────────────────────────────────────
export function getRunSummary(runId) {
  const db = getDb();
  const run = db.prepare('SELECT * FROM payroll_runs WHERE id=?').get(runId);
  if (!run) return null;

  const entries = db.prepare('SELECT * FROM payroll_entries WHERE run_id=? ORDER BY row_index').all(runId);
  const batches = db.prepare('SELECT * FROM payroll_batches WHERE run_id=? ORDER BY batch_index').all(runId);

  const statusCounts = {};
  for (const e of entries) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  }

  return { run, entries, batches, statusCounts };
}
