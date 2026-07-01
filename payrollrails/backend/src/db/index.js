/**
 * DB layer using Node.js built-in node:sqlite (Node 22+).
 * No native build required — ships with Node.
 */

import { DatabaseSync } from 'node:sqlite';
import { dbPath } from '../config.js';
import fs from 'fs';
import path from 'path';

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let _db;

export function getDb() {
  if (!_db) {
    _db = new DatabaseSync(dbPath);
    _db.exec(`PRAGMA journal_mode=WAL`);
    _db.exec(`PRAGMA foreign_keys=ON`);
    migrate(_db);
  }
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      total_rows    INTEGER DEFAULT 0,
      funded_amount TEXT DEFAULT '0',
      source_account TEXT,
      network       TEXT NOT NULL DEFAULT 'testnet',
      dry_run       INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      started_at    TEXT,
      completed_at  TEXT,
      error_msg     TEXT
    );

    CREATE TABLE IF NOT EXISTS payroll_entries (
      id            TEXT PRIMARY KEY,
      run_id        TEXT NOT NULL,
      row_index     INTEGER NOT NULL,
      name          TEXT,
      email         TEXT,
      address       TEXT,
      amount        TEXT NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'USDC',
      country       TEXT,
      note          TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      tx_hash       TEXT,
      error_msg     TEXT,
      idempotency_key TEXT UNIQUE,
      batch_index   INTEGER,
      voucher_ref   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll_batches (
      id            TEXT PRIMARY KEY,
      run_id        TEXT NOT NULL,
      batch_index   INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      tx_hash       TEXT,
      fee_bump_hash TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      envelope_xdr  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      ref           TEXT PRIMARY KEY,
      run_id        TEXT NOT NULL,
      entry_id      TEXT NOT NULL,
      amount        TEXT NOT NULL,
      claimer_email TEXT,
      status        TEXT NOT NULL DEFAULT 'unclaimed',
      claim_link    TEXT,
      claim_secret  TEXT,
      claimed_by    TEXT,
      claimed_at    TEXT,
      expires_at    TEXT,
      contract_id   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_run    ON payroll_entries(run_id);
    CREATE INDEX IF NOT EXISTS idx_entries_status ON payroll_entries(status);
    CREATE INDEX IF NOT EXISTS idx_batches_run    ON payroll_batches(run_id);
    CREATE INDEX IF NOT EXISTS idx_vouchers_run   ON vouchers(run_id);
  `);
}
