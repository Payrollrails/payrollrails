# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | ✅ Active |
| Older releases | ❌ No support |

We only provide security fixes on the current `main` branch. Please ensure you are running the latest code before reporting.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in PayrollRails, please report it responsibly:

**Email:** security@payrollrails.dev  
**Subject:** `[SECURITY] <brief description>`

Include as much of the following as possible:

- Type of vulnerability (e.g. key exposure, injection, auth bypass)
- Full path of the affected source file(s)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if available)
- Potential impact and attack scenario

We will acknowledge your report within **48 hours** and aim to release a fix within **7 days** for critical issues.

## Scope

### In Scope

- Private key exposure or leakage via API, logs, or error messages
- SQL injection or unauthorized database access
- Authentication bypass on any API endpoint
- Stellar transaction manipulation or double-spend vectors
- Voucher claim forgery or replay attacks
- Dependency vulnerabilities with a direct exploitable path

### Out of Scope

- Vulnerabilities in third-party services (Horizon, Stellar network itself)
- Denial of service against the testnet
- Issues requiring physical access to the server
- Social engineering attacks
- Theoretical vulnerabilities without a proof of concept

## Critical Security Practices

When running PayrollRails in production:

1. **Never commit `.env`** — `FUNDER_SECRET_KEY` must stay out of version control at all times.
2. **Use a dedicated funder wallet** — never use a personal or exchange wallet as the funder.
3. **Rotate keys immediately** if you suspect they have been exposed.
4. **Use mainnet USDC issuer** — replace the testnet `USDC_ISSUER` with Circle's official mainnet issuer before going live.
5. **Run behind a reverse proxy** (nginx/Caddy) — do not expose port 3001 directly to the internet.
6. **Rate-limit the `/api/stellar/faucet` endpoint** or disable it entirely on mainnet.
7. **Restrict CORS** — replace `cors({ origin: '*' })` in `backend/src/index.js` with your actual frontend domain.

## Disclosure Policy

We follow **coordinated disclosure**. Once a fix is deployed we will:

1. Credit the reporter (unless they prefer to remain anonymous)
2. Publish a security advisory on GitHub
3. Tag a new release with a changelog entry

## Bug Bounty

PayrollRails does not currently offer a paid bug bounty program. We do offer public recognition in the repository for responsible disclosures.
