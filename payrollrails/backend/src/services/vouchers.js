/**
 * Voucher service — walletless recipients get a claim link.
 * Off-chain (SQLite) by default; optionally anchored to Soroban contract.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { VOUCHER_EXPIRY_DAYS, VOUCHER_CONTRACT_ID } from '../config.js';

// ── Create voucher ────────────────────────────────────────────────────────────
export async function createVoucher(db, entry, runId) {
  const ref = uuidv4();
  const secret = randomBytes(24).toString('hex');
  const claimerHash = createHash('sha256').update(entry.email || ref).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + VOUCHER_EXPIRY_DAYS);

  const claimLink = `/claim/${ref}?s=${secret}`;

  db.prepare(`
    INSERT INTO vouchers (ref, run_id, entry_id, amount, claimer_email, status,
      claim_link, claim_secret, expires_at, contract_id)
    VALUES (?, ?, ?, ?, ?, 'unclaimed', ?, ?, ?, ?)
  `).run(
    ref, runId, entry.id, entry.amount,
    entry.email || null, claimLink, secret,
    expiresAt.toISOString(),
    VOUCHER_CONTRACT_ID || null
  );

  return { ref, claimLink, secret, claimerHash, expiresAt };
}

// ── Claim voucher ─────────────────────────────────────────────────────────────
export async function claimVoucher(db, ref, secret, recipientAddress) {
  const voucher = db.prepare('SELECT * FROM vouchers WHERE ref=?').get(ref);
  if (!voucher) throw new Error('Voucher not found');
  if (voucher.status === 'claimed') throw new Error('Voucher already claimed');
  if (voucher.status === 'reclaimed') throw new Error('Voucher reclaimed by issuer');
  if (voucher.status === 'expired') throw new Error('Voucher expired');

  // Check expiry
  if (new Date(voucher.expires_at) < new Date()) {
    db.prepare(`UPDATE vouchers SET status='expired' WHERE ref=?`).run(ref);
    throw new Error('Voucher has expired');
  }

  // Validate secret
  if (voucher.claim_secret !== secret) throw new Error('Invalid claim secret');

  // Mark claimed (actual USDC transfer happens via engine)
  db.prepare(`
    UPDATE vouchers
    SET status='claimed', claimed_by=?, claimed_at=datetime('now')
    WHERE ref=?
  `).run(recipientAddress, ref);

  // Update the parent entry with the final address
  db.prepare(`
    UPDATE payroll_entries
    SET address=?, status='pending', updated_at=datetime('now')
    WHERE id=?
  `).run(recipientAddress, voucher.entry_id);

  return { voucher, recipientAddress };
}

// ── Reclaim (issuer takes back unclaimed) ─────────────────────────────────────
export function reclaimVoucher(db, ref, issuerRunId) {
  const voucher = db.prepare('SELECT * FROM vouchers WHERE ref=? AND run_id=?').get(ref, issuerRunId);
  if (!voucher) throw new Error('Voucher not found');
  if (voucher.status === 'claimed') throw new Error('Cannot reclaim claimed voucher');

  db.prepare(`UPDATE vouchers SET status='reclaimed' WHERE ref=?`).run(ref);
  db.prepare(`UPDATE payroll_entries SET status='skipped', error_msg='Voucher reclaimed' WHERE id=?`)
    .run(voucher.entry_id);

  return { reclaimed: true };
}

// ── Get voucher info (public, no secret) ──────────────────────────────────────
export function getVoucherInfo(db, ref) {
  const v = db.prepare(`
    SELECT ref, amount, claimer_email, status, expires_at, created_at, contract_id
    FROM vouchers WHERE ref=?
  `).get(ref);
  return v || null;
}
