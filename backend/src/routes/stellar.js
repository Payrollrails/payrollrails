/**
 * /api/stellar — Stellar helpers: balance check, faucet, account info.
 */

import express from 'express';
import { StrKey } from '@stellar/stellar-sdk';
import {
  getUsdcBalance,
  getNativeBalance,
  fundTestnetAccount,
  hasTrustline,
  loadAccount,
} from '../services/stellar.js';
import { STELLAR_NETWORK, FUNDER_SECRET_KEY } from '../config.js';
import { Keypair } from '@stellar/stellar-sdk';

const router = express.Router();

// GET /api/stellar/info
router.get('/info', (req, res) => {
  let funderPublicKey = null;
  try {
    if (FUNDER_SECRET_KEY) {
      funderPublicKey = Keypair.fromSecret(FUNDER_SECRET_KEY).publicKey();
    }
  } catch { /* ignore */ }

  res.json({
    network: STELLAR_NETWORK,
    funderConfigured: !!FUNDER_SECRET_KEY,
    funderPublicKey,
  });
});

// GET /api/stellar/balance/:address
router.get('/balance/:address', async (req, res) => {
  const { address } = req.params;
  if (!StrKey.isValidEd25519PublicKey(address)) {
    return res.status(400).json({ error: 'Invalid Stellar address' });
  }
  try {
    const [usdc, xlm, trustline] = await Promise.all([
      getUsdcBalance(address),
      getNativeBalance(address),
      hasTrustline(address),
    ]);
    res.json({ address, usdc, xlm, hasTrustline: trustline });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/stellar/faucet  { address }
router.post('/faucet', async (req, res) => {
  if (STELLAR_NETWORK !== 'testnet') {
    return res.status(403).json({ error: 'Faucet only available on testnet' });
  }
  const { address } = req.body;
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    return res.status(400).json({ error: 'Valid Stellar address required' });
  }
  try {
    const result = await fundTestnetAccount(address);
    res.json({ success: true, result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/stellar/account/:address — full account info
router.get('/account/:address', async (req, res) => {
  const { address } = req.params;
  if (!StrKey.isValidEd25519PublicKey(address)) {
    return res.status(400).json({ error: 'Invalid Stellar address' });
  }
  try {
    const account = await loadAccount(address);
    res.json({
      id: account.id,
      sequence: account.sequence,
      balances: account.balances,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
