# Changelog

All notable changes to PayrollRails are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Email delivery of voucher claim links
- Recipient address book with CSV import
- Webhook callbacks on run completion
- Rate limiting on `/api/stellar/faucet` and `/api/upload`
- Mainnet deployment guide

---

## [1.0.0] — 2026-07-01

### Added
- **CSV/XLSX upload** — flexible header aliasing, Zod row validation, per-row error reporting
- **Batched Stellar payments** — fee-bumped transactions of ≤100 operations each
- **Crash-safe engine** — SQLite WAL state machine with idempotent retries and exponential backoff (up to 5 attempts per batch)
- **Voucher flow** — walletless recipients receive a signed claim link; redeemable from any Stellar wallet
- **Dry-run mode** — full flow simulation without submitting real transactions
- **Live status dashboard** — per-recipient status with 1.5s polling, TX hash links to Stellar Expert
- **PDF audit report** — pdfkit-generated report with run summary, batch table, and per-recipient detail
- **CSV audit report** — downloadable spreadsheet with all entry fields and voucher claim links
- **Testnet faucet helper** — one-click XLM funding via Friendbot from the dashboard
- **Soroban voucher contract** — Rust contract with `create`, `claim`, `reclaim` functions and test suite
- **50-recipient demo CSV** — seed data across 18 countries including intentional invalid row and voucher entries
- **GitHub Actions CI** — backend smoke test, parser unit test, frontend TypeScript check + build, npm security audit
- **Apache-2.0 and MIT licenses**
- **Code of Conduct** (Contributor Covenant 2.1)
- **Security policy** with responsible disclosure process
- **5 issue labels** — bug, enhancement, good first issue, security, stellar
- **5 README badges** — CI status, Apache-2.0, MIT, Stellar, Node.js 24

### Technical
- Node.js 24 with built-in `node:sqlite` — zero native compilation required
- Next.js 14 App Router with Tailwind CSS and TypeScript
- Express 4 REST API with 15 endpoints
- `@stellar/stellar-sdk` v12 for Horizon interaction and fee-bump transactions
