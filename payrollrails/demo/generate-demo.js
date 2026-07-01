/**
 * Generates 50 demo recipients with real testnet Stellar keypairs.
 * Run: node generate-demo.js
 * Output: demo-recipients.csv  (copy to frontend/public/)
 */

import { Keypair } from '@stellar/stellar-sdk';
import fs from 'fs';

const COUNTRIES = [
  'Philippines','Colombia','Nigeria','Senegal','Japan',
  'India','Sweden','UK','Kenya','Ghana',
  'Mexico','Argentina','Indonesia','Vietnam','South Korea',
  'Ethiopia','Ukraine','Italy','Romania','Fiji',
];

const FIRST_NAMES = [
  'Maria','Juan','Ana','Carlos','Fatima','Emeka','Aiko','Priya','Rahul','Li',
  'Sofia','Lars','Emma','James','Mohammed','David','Grace','Paulo','Isabella','Marco',
  'Elena','Kofi','Rosa','Miguel','Lucas','Nadia','Siti','Nguyen','Park','Kim',
  'Abebe','Amara','Moussa','Yaw','Hiroshi','Chen','Olivia','Ama','Dewi','Valentina',
  'Andrei','Budi','Tran','Kwame','Mere','Ana','Fatimah','Kofi','Oleksandr','Amina',
];

const ROLES = [
  'Field coordinator','Community health worker','NGO project lead','Data entry volunteer',
  'Regional supervisor','Logistics coordinator','Research analyst','Program officer',
  'Backend engineer','Operations manager','Finance analyst','UX researcher',
  'DevOps engineer','Communications lead','Finance manager','Data scientist',
  'Supply chain analyst','Tech lead','Community liaison','Aid distribution agent',
];

const WALLETLESS_INDICES = [19, 32, 43, 22, 7]; // these get email-only (voucher)

const rows = ['name,email,address,amount,currency,country,note'];

for (let i = 0; i < 50; i++) {
  const name = FIRST_NAMES[i] + ' ' + String.fromCharCode(65 + (i % 26)) + '.';
  const amount = (40 + Math.floor(Math.random() * 160)).toFixed(2);
  const country = COUNTRIES[i % COUNTRIES.length];
  const role = ROLES[i % ROLES.length];
  const currency = 'USDC';

  if (WALLETLESS_INDICES.includes(i)) {
    // walletless — email only, will become voucher
    const email = name.toLowerCase().replace(/[^a-z]/g, '') + '@example.org';
    rows.push(`${name},${email},,${amount},${currency},${country},${role}`);
  } else {
    // real Stellar keypair
    const kp = Keypair.random();
    rows.push(`${name},,${kp.publicKey()},${amount},${currency},${country},${role}`);
  }
}

// Row 12: intentional invalid address for demo validation flag
const parts = rows[13].split(',');
parts[2] = 'INVALID_ADDRESS_FOR_DEMO';
rows[13] = parts.join(',');

const csv = rows.join('\n');
fs.writeFileSync('demo-recipients.csv', csv);
console.log('✅ Generated demo-recipients.csv with', rows.length - 1, 'recipients');
console.log('   Copy to frontend/public/demo-recipients.csv');
