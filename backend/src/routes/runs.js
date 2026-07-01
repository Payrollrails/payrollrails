/**
 * /api/runs — CRUD + execution for payroll runs.
 */

import express from 'express';
import { getDb } from '../db/index.js';
import { createRun, executeRun, cancelRun, getRunSummary } from '../services/engine.js';
import { parseFile } from '../services/parser.js';
import multer from 'multer';
import { STELLAR_NETWORK } from '../config.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── List all runs ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  const runs = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM payroll_entries WHERE run_id=r.id) as entry_count,
      (SELECT COUNT(*) FROM payroll_entries WHERE run_id=r.id AND status='confirmed') as confirmed_count,
      (SELECT COUNT(*) FROM payroll_entries WHERE run_id=r.id AND status='failed') as failed_count
    FROM payroll_runs r
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all();
  res.json(runs);
});

// ── Create run from uploaded file ─────────────────────────────────────────────
router.post('/', upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const { name, dryRun, sourceAccount } = req.body;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!name) return res.status(400).json({ error: 'Run name required' });

    const rows = parseFile(req.file.buffer, req.file.originalname);
    const account = sourceAccount || '';

    const { runId, batchCount, entryCount } = createRun(db, {
      name,
      rows,
      sourceAccount: account,
      network: STELLAR_NETWORK,
      dryRun: dryRun === 'true' || dryRun === true,
    });

    res.status(201).json({ runId, batchCount, entryCount });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// ── Get run detail ────────────────────────────────────────────────────────────
router.get('/:runId', (req, res) => {
  const summary = getRunSummary(req.params.runId);
  if (!summary) return res.status(404).json({ error: 'Run not found' });
  res.json(summary);
});

// ── Execute run ───────────────────────────────────────────────────────────────
router.post('/:runId/execute', async (req, res) => {
  const { runId } = req.params;
  const db = getDb();
  const run = db.prepare('SELECT * FROM payroll_runs WHERE id=?').get(runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.status === 'running') return res.status(409).json({ error: 'Run already in progress' });
  if (run.status === 'completed') return res.status(409).json({ error: 'Run already completed' });

  // Start async — don't await, return immediately
  executeRun(runId).catch((e) =>
    console.error(`Run ${runId} failed:`, e.message)
  );

  res.json({ status: 'started', runId });
});

// ── Cancel run ────────────────────────────────────────────────────────────────
router.post('/:runId/cancel', (req, res) => {
  cancelRun(req.params.runId);
  res.json({ status: 'cancellation_requested' });
});

// ── Get run entries ───────────────────────────────────────────────────────────
router.get('/:runId/entries', (req, res) => {
  const db = getDb();
  const entries = db.prepare(`
    SELECT e.*, v.claim_link, v.status as voucher_status
    FROM payroll_entries e
    LEFT JOIN vouchers v ON v.entry_id = e.id
    WHERE e.run_id=?
    ORDER BY e.row_index
  `).all(req.params.runId);
  res.json(entries);
});

// ── Get run status (lightweight polling endpoint) ─────────────────────────────
router.get('/:runId/status', (req, res) => {
  const db = getDb();
  const run = db.prepare('SELECT id, status, completed_at, error_msg FROM payroll_runs WHERE id=?')
    .get(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const counts = db.prepare(`
    SELECT status, COUNT(*) as c FROM payroll_entries WHERE run_id=? GROUP BY status
  `).all(req.params.runId);

  const statusMap = {};
  for (const row of counts) statusMap[row.status] = row.c;

  res.json({ ...run, statusCounts: statusMap });
});

export default router;
