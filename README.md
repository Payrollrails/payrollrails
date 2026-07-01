# PayrollRails

[![CI](https://github.com/Payrollrails/payrollrails/actions/workflows/ci.yml/badge.svg)](https://github.com/Payrollrails/payrollrails/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/Payrollrails/payrollrails/blob/main/LICENSE)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Payrollrails/payrollrails/blob/main/LICENSE-MIT)
[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-7B68EE?logo=stellar&logoColor=white)](https://stellar.org)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-43853d?logo=node.js&logoColor=white)](https://nodejs.org)

**Cross-border stablecoin payroll on Stellar.**
Pay 50 people in 5 countries in ~8 seconds for ~$0.05 total fees.

---

## The Problem

Paying remote contractors and field workers across borders is:
- **Slow** — bank wires take 1–5 business days
- **Expensive** — 3–7% FX + transfer fees
- **Fragile** — existing crypto tools mishandle partial failures
- **Non-auditable** — nothing an accountant or regulator can use

## The Solution

PayrollRails uses **Stellar's native payment rails** to batch USDC payments into fee-bumped transactions of up to 100 operations each. A crash-safe SQLite state machine ensures idempotent retries on restart. Every run produces a downloadable PDF + CSV audit report. Walletless recipients get a claim voucher link they can redeem from any Stellar wallet.

---

## Architecture

```
payrollrails/
├── backend/                   Node.js 24 API + Stellar engine
│   ├── src/
│   │   ├── config.js          Env-driven config (network, keys, limits)
│   │   ├── index.js           Express server + crash-recovery on boot
│   │   ├── db/
│   │   │   └── index.js       node:sqlite DB (zero native deps, WAL mode)
│   │   ├── routes/
│   │   │   ├── upload.js      POST /api/upload  — parse CSV/XLSX
│   │   │   ├── runs.js        CRUD + execution for payroll runs
│   │   │   ├── reports.js     CSV + PDF audit export
│   │   │   ├── stellar.js     Balance, faucet, account info
│   │   │   └── vouchers.js    Claim/reclaim voucher flow
│   │   └── services/
│   │       ├── parser.js      CSV/XLSX → validated rows (Zod + header aliasing)
│   │       ├── stellar.js     Horizon client, tx builder, fee-bump, submit
│   │       ├── engine.js      Crash-safe batch runner with exponential backoff
│   │       ├── vouchers.js    Off-chain voucher create/claim/reclaim
│   │       └── reports.js     pdfkit PDF + CSV string generation
│   ├── scripts/
│   │   ├── setup-trustline.js Add USDC trustline to funder account
│   │   └── fund-usdc.js       Fund funder with testnet USDC
│   ├── .env                   Local secrets (gitignored)
│   └── .env.example           Template with all required vars
│
├── frontend/                  Next.js 14 dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       Upload → preview → fund → confirm wizard
│   │   │   ├── runs/
│   │   │   │   ├── page.tsx           All runs list
│   │   │   │   └── [runId]/page.tsx   Live run status (1.5s poll)
│   │   │   └── claim/
│   │   │       └── [ref]/page.tsx     Voucher claim page
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx    Coloured status pill with pulse animation
│   │   │   ├── SummaryBar.tsx     Upload summary stats row
│   │   │   ├── PreviewTable.tsx   Validated row preview with error tooltips
│   │   │   └── FunderPanel.tsx    Balance checker + testnet faucet button
│   │   ├── lib/
│   │   │   └── api.ts         Axios client — all backend calls
│   │   └── types/
│   │       └── index.ts       Shared TypeScript types
│   └── public/
│       └── demo-recipients.csv  50-row seed across 18 countries
│
├── contracts/
│   └── voucher/               Soroban smart contract (Rust)
│       ├── Cargo.toml
│       └── src/lib.rs         create / claim / reclaim + test suite
│
└── demo/
    └── generate-demo.js       Generates fresh demo CSV with real keypairs
```

---

## Data Flow

```
CSV Upload
    │
    ▼
POST /api/upload  →  parser.js  →  Zod validation  →  preview rows
    │
    ▼
POST /api/runs   →  engine.createRun()  →  SQLite (payroll_runs + entries + batches)
    │
    ▼
POST /api/runs/:id/execute  →  engine.executeRun()
    │
    ├─ for each batch (≤100 ops):
    │      stellar.buildPaymentTx()  →  sign  →  stellar.wrapFeeBump()
    │      persist XDR to DB (crash safety)
    │      stellar.submitTx()  →  Horizon
    │      on failure: exponential backoff retry (max 5)
    │      on success: update entries → confirmed
    │
    ├─ for email-only recipients:
    │      vouchers.createVoucher()  →  DB entry + claim link
    │
    └─ on restart (status='running'):
           engine.resumeInterruptedRuns()  →  picks up pending/failed batches
    │
    ▼
GET /api/reports/:id/pdf  →  reports.generatePdfReport()  →  pdfkit stream
GET /api/reports/:id/csv  →  reports.generateCsvReport()  →  string
```

---

## Quick Start

### Prerequisites

- Node.js 22+ (uses built-in `node:sqlite`)
- A Stellar testnet keypair — generate at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — paste your FUNDER_SECRET_KEY
npm install
node src/index.js
```

Backend runs on **http://localhost:3001**

### 2. Fund the funder account (testnet only)

```bash
# Step 1: Fund with XLM via Friendbot (call the API or click in the dashboard)
curl -X POST http://localhost:3001/api/stellar/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_PUBLIC_KEY"}'

# Step 2: Add USDC trustline
node scripts/setup-trustline.js

# Step 3: Fund with testnet USDC
node scripts/fund-usdc.js
```

### 3. Frontend

```bash
cd frontend
npm install
node node_modules/next/dist/bin/next dev
```

Frontend runs on **http://localhost:3000**

---

## Environment Variables

All configuration lives in `backend/.env`:

| Variable | Required | Description |
|---|---|---|
| `STELLAR_NETWORK` | ✓ | `testnet` or `mainnet` |
| `HORIZON_URL` | ✓ | Horizon RPC endpoint |
| `FUNDER_SECRET_KEY` | ✓ | Secret key of the paying wallet |
| `FEE_BUMP_SECRET_KEY` | | Separate fee-bump keypair (defaults to funder) |
| `USDC_ISSUER` | ✓ | USDC asset issuer public key |
| `DB_PATH` | | SQLite file path (default: `data/payrollrails.db`) |
| `PORT` | | API port (default: `3001`) |
| `VOUCHER_CONTRACT_ID` | | Deployed Soroban contract ID |

---

## CSV Format

Columns are flexible — header names are aliased automatically:

| Column | Aliases | Required |
|---|---|---|
| `name` | `full_name`, `recipient` | ✓ |
| `amount` | `payment`, `usd`, `usdc` | ✓ |
| `address` | `stellar_address`, `wallet` | Either address or email |
| `email` | `email_address` | Either address or email |
| `currency` | `asset`, `token` | Optional (default: USDC) |
| `country` | `country_code`, `location` | Optional |
| `note` | `memo`, `description` | Optional |

Rows with neither address nor email are flagged invalid. Rows with only an email receive a **voucher claim link** instead of a direct payment.

---

## API Reference

### Upload

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Parse CSV/XLSX, return validated rows for preview |

### Runs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/runs` | List all runs (last 50) |
| `POST` | `/api/runs` | Create a run from file upload |
| `GET` | `/api/runs/:id` | Full run detail (entries + batches + status counts) |
| `GET` | `/api/runs/:id/status` | Lightweight status poll |
| `GET` | `/api/runs/:id/entries` | All recipient entries for a run |
| `POST` | `/api/runs/:id/execute` | Start execution (async, returns immediately) |
| `POST` | `/api/runs/:id/cancel` | Request cancellation |

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/:id/csv` | Download CSV audit report |
| `GET` | `/api/reports/:id/pdf` | Download PDF audit report |

### Stellar

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stellar/info` | Network + funder config status |
| `GET` | `/api/stellar/balance/:address` | USDC + XLM balances + trustline check |
| `POST` | `/api/stellar/faucet` | Fund testnet account via Friendbot |
| `GET` | `/api/stellar/account/:address` | Full Horizon account info |

### Vouchers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/vouchers/:ref` | Public voucher info (no secret) |
| `POST` | `/api/vouchers/:ref/claim` | Claim voucher with secret + recipient address |
| `POST` | `/api/vouchers/:ref/reclaim` | Issuer reclaims unclaimed voucher |

---

## Crash Recovery Demo

```bash
# Terminal 1 — start backend
cd backend && node src/index.js

# Terminal 2 — start frontend
cd frontend && node node_modules/next/dist/bin/next dev

# Load demo CSV → dry-run OFF → Execute
# While statuses are flipping to Confirmed...

# Terminal 1 — kill the backend
^C

# Restart it
node src/index.js
# Output: 🔄 Resuming interrupted run: <id>
# The run picks up from the first unconfirmed batch.
```

---

## Soroban Voucher Contract

The optional on-chain voucher anchor lives in `contracts/voucher/`. It provides:

- `create(ref, amount, claimer_hash, expiry_ledger)` — issuer creates voucher
- `claim(ref, recipient)` — recipient claims with their address
- `reclaim(ref)` — issuer reclaims unclaimed voucher

```bash
# Requires Rust + stellar CLI
cd contracts/voucher
cargo build --target wasm32-unknown-unknown --release
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/payrollrails_voucher.wasm \
  --network testnet --source <your-keypair>
# Paste the contract ID into backend/.env as VOUCHER_CONTRACT_ID
```

Without a deployed contract ID, vouchers work off-chain via SQLite only.

---

## Health Check

```bash
curl http://localhost:3001/api/health
# {"status":"ok","ts":"2026-06-29T..."}
```

---

## Notes

- `node:sqlite` is used instead of `better-sqlite3` — it ships with Node 22+ and requires zero native compilation, making it work on any platform without build tools.
- The testnet USDC issuer key in `.env` is a throwaway keypair created by `fund-usdc.js`. For mainnet, set `USDC_ISSUER` to Circle's official issuer public key.
- The fee-bump account pays base fees from its own XLM balance, keeping the funder account's XLM separate from payment capital.
