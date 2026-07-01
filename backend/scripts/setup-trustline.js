/**
 * One-time script: adds USDC trustline to the funder account.
 * Run: node scripts/setup-trustline.js
 */
import 'dotenv/config';
import {
  Horizon, Keypair, TransactionBuilder, Networks,
  Operation, Asset, BASE_FEE,
} from '@stellar/stellar-sdk';
import { HORIZON_URL, FUNDER_SECRET_KEY, USDC_ISSUER, STELLAR_NETWORK } from '../src/config.js';

const server = new Horizon.Server(HORIZON_URL);
const funderKp = Keypair.fromSecret(FUNDER_SECRET_KEY);
const network = STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const USDC = new Asset('USDC', USDC_ISSUER);

console.log('Funder:', funderKp.publicKey());
console.log('Adding USDC trustline...');

const account = await server.loadAccount(funderKp.publicKey());

const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network })
  .addOperation(Operation.changeTrust({ asset: USDC }))
  .setTimeout(30)
  .build();

tx.sign(funderKp);
const result = await server.submitTransaction(tx);
console.log('✅ Trustline added! TX hash:', result.hash);
console.log('   The funder account can now hold USDC.');
console.log('\nNext: fund with testnet USDC from the USDC issuer or Stellar laboratory.');
