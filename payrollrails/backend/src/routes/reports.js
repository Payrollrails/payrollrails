/**
 * /api/reports — CSV and PDF report downloads.
 */

import express from 'express';
import { generateCsvReport, generatePdfReport } from '../services/reports.js';

const router = express.Router();

// GET /api/reports/:runId/csv
router.get('/:runId/csv', (req, res) => {
  try {
    const csv = generateCsvReport(req.params.runId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payrollrails-${req.params.runId.slice(0, 8)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/reports/:runId/pdf
router.get('/:runId/pdf', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payrollrails-${req.params.runId.slice(0, 8)}.pdf"`
    );
    generatePdfReport(req.params.runId, res);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
