# Contributing to PayrollRails

Thank you for your interest in contributing! PayrollRails is an open project and we welcome bug fixes, features, documentation improvements, and tests.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branch Naming](#branch-naming)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/payrollrails.git
   cd payrollrails
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/Payrollrails/payrollrails.git
   ```

---

## Development Setup

### Backend
```bash
cd backend
cp .env.example .env
# Fill in your testnet FUNDER_SECRET_KEY
npm install
node src/index.js
# → http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
node node_modules/next/dist/bin/next dev
# → http://localhost:3000
```

### Generate a testnet keypair
Visit https://laboratory.stellar.org/#account-creator?network=test

### Fund your testnet funder account
```bash
# After setting FUNDER_SECRET_KEY in backend/.env:
node backend/scripts/setup-trustline.js
node backend/scripts/fund-usdc.js
```

---

## Branch Naming

Use the format `type/short-description`:

| Type | Example |
|---|---|
| Bug fix | `fix/batch-status-transition` |
| New feature | `feat/email-voucher-delivery` |
| Documentation | `docs/soroban-deploy-guide` |
| Tests | `test/parser-edge-cases` |
| Security | `security/rate-limit-faucet` |
| Refactor | `refactor/trustline-parallel-check` |

---

## Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes — keep each PR focused on one thing
3. Test locally — ensure the backend starts and the frontend builds
4. Commit using the [commit message format](#commit-messages) below

---

## Pull Request Process

1. Push your branch and open a PR against `main`
2. Fill in the PR template completely
3. Ensure all CI checks pass (backend smoke test, frontend build, security audit)
4. Link the issue your PR resolves using `Closes #123`
5. Request a review — a maintainer will respond within 48 hours
6. Address feedback and push additional commits to the same branch
7. Once approved, a maintainer will squash-merge your PR

---

## Code Style

- **Backend** — ES Modules (`import`/`export`), single quotes, 2-space indent
- **Frontend** — TypeScript strict mode, React functional components only
- **No new dependencies** without prior discussion in an issue
- Keep functions small and single-purpose
- Add comments for non-obvious Stellar SDK usage

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): short description

Optional longer body explaining what and why.
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `security`, `chore`

Examples:
```
feat(engine): add parallel trustline checking for batch entries
fix(parser): handle UTF-8 BOM in CSV uploads
docs(readme): add mainnet deployment section
test(voucher): add expiry and reclaim flow tests
```

---

## Reporting Bugs

Open an issue using the **Bug Report** template. Include:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
- Relevant logs or error messages

For security vulnerabilities — **do not open a public issue**. See [SECURITY.md](SECURITY.md).

---

## Suggesting Features

Open an issue using the **Feature Request** template. Describe:
- The problem you're solving
- Your proposed solution
- Any alternatives you considered

Wave Program contributors: pick up issues tagged `good first issue` or `enhancement` during active sprint cycles.
