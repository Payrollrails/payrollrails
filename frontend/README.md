# PayrollRails — Frontend

Next.js 14 dashboard for the PayrollRails cross-border stablecoin payroll system.

## Pages

| Route | Description |
|---|---|
| `/` | Upload wizard: CSV → preview → fund → confirm → run |
| `/runs` | List of all payroll runs with status and progress |
| `/runs/[runId]` | Live run status — auto-polls every 1.5s, shows per-recipient TX hashes |
| `/claim/[ref]?s=[secret]` | Voucher claim page for walletless recipients |

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** — brand teal palette defined in `tailwind.config.ts`
- **Sonner** — toast notifications
- **React Dropzone** — CSV/XLSX drag-and-drop
- **Axios** — API client in `src/lib/api.ts`
- **TypeScript** — all types in `src/types/index.ts`

## Dev

```bash
npm install
node node_modules/next/dist/bin/next dev
# → http://localhost:3000
```

Requires the backend running on `:3001`. All `/api/*` requests are proxied via `next.config.js`.

## Build

```bash
node node_modules/next/dist/bin/next build
```
