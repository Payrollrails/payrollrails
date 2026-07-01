import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';
import { resumeInterruptedRuns } from './services/engine.js';

import uploadRouter from './routes/upload.js';
import runsRouter from './routes/runs.js';
import reportsRouter from './routes/reports.js';
import stellarRouter from './routes/stellar.js';
import vouchersRouter from './routes/vouchers.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRouter);
app.use('/api/runs', runsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/stellar', stellarRouter);
app.use('/api/vouchers', vouchersRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 PayrollRails backend running on http://localhost:${PORT}`);
  console.log(`   Network: ${process.env.STELLAR_NETWORK || 'testnet'}`);
  console.log(`   DB:      ${process.env.DB_PATH || 'data/payrollrails.db'}\n`);

  // Resume any runs that were interrupted by a crash/restart
  await resumeInterruptedRuns();
});

export default app;
