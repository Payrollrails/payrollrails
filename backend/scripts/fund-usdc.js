/**
 * Testnet USDC funding via the official Circle testnet USDC faucet API.
 * Alternatively, self-issues a custom USDC-equivalent for pure demo runs.
 *
 * Strategy: use the Stellar testnet USDC issuer that matches USDC_ISSUER in .env.
 * If the issuer is the Circle testnet one (GBBD47...), we use their faucet endpoint.
 * Otherwise we fall back to creating a self-issued test asset.
 */
import 'dotenv/config';
import {
  Horizon, Keypair, TransactionBuilder, Networks,
  Operation, Asset, BASE_FEE,
} from '@stellar/stellar-sdk';
import {
  HORIZON_URL, FUNDER_SECRET_KEY, USDC_ISSUER, STELLAR_NETWORK,
} from '../src/config.js';

const server   = new Horizon.Server(HORIZON_URL);
const network  = STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const funderKp = Keypair.fromSecret(FUNDER_SECRET_KEY);
const funderPub = funderKp.publicKey();

console.log('Funder public key:', funderPub);

// ── Try the Circle USDC testnet faucet ────────────────────────────────────
const CIRCLE_FAUCET = 'https://friendbot.circle.com';
try {
  console.log('Trying Circle USDC testnet faucet...');
  const res = await fetch(`${CIRCLE_FAUCET}?addr=${funderPub}`);
  const body = await res.json();
  if (res.ok) {
    console.log('✅ Circle faucet success:', body.hash ?? JSON.stringify(body));
    process.exit(0);
  }
  console.log('Circle faucet response:', JSON.stringify(body));
} catch (e) {
  console.log('Circle faucet unavailable:', e.message);
}

// ── Fallback: self-issue a TEST_USDC asset ────────────────────────────────
console.log('\nFallback: creating self-issued TEST_USDC for demo...');

// Generate a fresh issuer keypair (throwaway)
const issuerKp = Keypair.random();
console.log('Temp issuer:', issuerKp.publicKey());

// Fund the temp issuer with Friendbot
const fb = await fetch(`https://friendbot.stellar.org?addr=${issuerKp.publicKey()}`);
if (!fb.ok) throw new Error('Friendbot failed for temp issuer');
console.log('Temp issuer funded via Friendbot');

const TEST_USDC = new Asset('USDC', issuerKp.publicKey());
const MINT = '50000';

// 1. Add trustline on funder for this test asset
const funderAcct = await server.loadAccount(funderPub);
const trustTx = new TransactionBuilder(funderAcct, { fee: BASE_FEE, networkPassphrase: network })
  .addOperation(Operation.changeTrust({ asset: TEST_USDC, limit: '1000000' }))
  .setTimeout(30).build();
trustTx.sign(funderKp);
await server.submitTransaction(trustTx);
console.log('Trustline added for TEST_USDC');

// 2. Mint TEST_USDC to funder
const issuerAcct = await server.loadAccount(issuerKp.publicKey());
const mintTx = new TransactionBuilder(issuerAcct, { fee: BASE_FEE, networkPassphrase: network })
  .addOperation(Operation.payment({ destination: funderPub, asset: TEST_USDC, amount: MINT }))
  .setTimeout(30).build();
mintTx.sign(issuerKp);
const mintResult = await server.submitTransaction(mintTx);
console.log('✅ Minted', MINT, 'TEST_USDC. TX:', mintResult.hash);

// 3. Update .env USDC_ISSUER to point to this temp issuer
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
let env = readFileSync(envPath, 'utf8');
env = env.replace(/^USDC_ISSUER=.*/m, `USDC_ISSUER=${issuerKp.publicKey()}`);
writeFileSync(envPath, env);
console.log('Updated .env USDC_ISSUER =', issuerKp.publicKey());
console.log('\n⚠  This is a throwaway testnet issuer — for demo only.');
console.log('   Restart the backend: node src/index.js');
