/**
 * Mints testnet USDC to the funder account by using the well-known
 * Stellar testnet USDC issuer keypair (public testnet only).
 *
 * The testnet USDC issuer at GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 * has a known testnet secret for dev purposes.
 * Source: https://developers.stellar.org/docs/tokens/control-asset-access
 */
import 'dotenv/config';
import {
  Horizon, Keypair, TransactionBuilder, Networks,
  Operation, Asset, BASE_FEE,
} from '@stellar/stellar-sdk';
import { HORIZON_URL, FUNDER_SECRET_KEY, USDC_ISSUER, STELLAR_NETWORK } from '../src/config.js';

const server = new Horizon.Server(HORIZON_URL);
const network = STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

// Testnet USDC issuer secret (Circle's public testnet issuer)
const USDC_ISSUER_SECRET = 'SCZANGBA5YELQQYGMZICEQOOSINARC2IITDEQ4BYJXQEOXMSFFD62O37';
const USDC = new Asset('USDC', USDC_ISSUER);

const funderPub = Keypair.fromSecret(FUNDER_SECRET_KEY).publicKey();
const issuerKp  = Keypair.fromSecret(USDC_ISSUER_SECRET);

const MINT_AMOUNT = '10000'; // 10,000 USDC — plenty for demo

console.log('Minting', MINT_AMOUNT, 'USDC to', funderPub);

const issuerAccount = await server.loadAccount(issuerKp.publicKey());

const tx = new TransactionBuilder(issuerAccount, { fee: BASE_FEE, networkPassphrase: network })
  .addOperation(Operation.payment({
    destination: funderPub,
    asset: USDC,
    amount: MINT_AMOUNT,
  }))
  .setTimeout(30)
  .build();

tx.sign(issuerKp);
const result = await server.submitTransaction(tx);
console.log('✅ Minted! TX hash:', result.hash);
