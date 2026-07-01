/**
 * POST /api/upload
 * Accepts CSV or XLSX, returns parsed + validated rows for preview.
 */

import express from 'express';
import multer from 'multer';
import { parseFile, summarize } from '../services/parser.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only CSV or XLSX files accepted'), ok);
  },
});

router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseFile(req.file.buffer, req.file.originalname);
    const summary = summarize(rows);

    return res.json({ rows, summary });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

export default router;
