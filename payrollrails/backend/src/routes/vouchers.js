/**
 * /api/vouchers — claim and reclaim vouchers.
 */

import express from 'express';
import { StrKey } from '@stellar/stellar-sdk';
import { getDb } from '../db/index.js';
import { claimVoucher, reclaimVoucher, getVoucherInfo } from '../services/vouchers.js';
import { executeRun } from '../services/engine.js';

const router = express.Router();

// GET /api/vouchers/:ref — public info
router.get('/:ref', (req, res) => {
  const db = getDb();
  const info = getVoucherInfo(db, req.params.ref);
  if (!info) return res.status(404).json({ error: 'Voucher not found' });
  res.json(info);
});

// POST /api/vouchers/:ref/claim  { secret, address }
router.post('/:ref/claim', async (req, res) => {
  const { secret, address } = req.body;

  if (!secret) return res.status(400).json({ error: 'Claim secret required' });
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    return res.status(400).json({ error: 'Valid Stellar address required' });
  }

  try {
    const db = getDb();
    const { voucher } = await claimVoucher(db, req.params.ref, secret, address);

    // Re-run the parent payroll run to process the newly-resolved entry
    executeRun(voucher.run_id).catch((e) =>
      console.error(`Voucher claim rerun ${voucher.run_id} failed:`, e.message)
    );

    res.json({ success: true, message: 'Voucher claimed — payment will process shortly.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/vouchers/:ref/reclaim  { runId }
router.post('/:ref/reclaim', (req, res) => {
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId required' });

  try {
    const db = getDb();
    const result = reclaimVoucher(db, req.params.ref, runId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
