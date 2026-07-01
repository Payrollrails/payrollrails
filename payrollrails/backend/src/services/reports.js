/**
 * Report generator — CSV and PDF audit exports.
 */

import PDFDocument from 'pdfkit';
import { getDb } from '../db/index.js';

const STATUS_EMOJI = {
  confirmed: '✓',
  failed: '✗',
  pending: '…',
  submitted: '↑',
  voucher_created: '🎫',
  skipped: '—',
};

// ── CSV export ────────────────────────────────────────────────────────────────
export function generateCsvReport(runId) {
  const db = getDb();
  const run = db.prepare('SELECT * FROM payroll_runs WHERE id=?').get(runId);
  if (!run) throw new Error('Run not found');

  const entries = db.prepare(`
    SELECT e.*, v.claim_link
    FROM payroll_entries e
    LEFT JOIN vouchers v ON v.entry_id = e.id
    WHERE e.run_id=?
    ORDER BY e.row_index
  `).all(runId);

  const rows = [
    [
      'Row', 'Name', 'Email', 'Address', 'Country',
      'Amount', 'Currency', 'Status', 'TX Hash',
      'Voucher Ref', 'Claim Link', 'Note', 'Error',
    ],
    ...entries.map((e) => [
      e.row_index + 1,
      e.name,
      e.email,
      e.address,
      e.country,
      e.amount,
      e.currency,
      e.status,
      e.tx_hash || '',
      e.voucher_ref || '',
      e.claim_link || '',
      e.note || '',
      e.error_msg || '',
    ]),
  ];

  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── PDF export ────────────────────────────────────────────────────────────────
export function generatePdfReport(runId, res) {
  const db = getDb();
  const run = db.prepare('SELECT * FROM payroll_runs WHERE id=?').get(runId);
  if (!run) throw new Error('Run not found');

  const entries = db.prepare(`
    SELECT e.*, v.ref as v_ref
    FROM payroll_entries e
    LEFT JOIN vouchers v ON v.entry_id = e.id
    WHERE e.run_id=?
    ORDER BY e.row_index
  `).all(runId);

  const batches = db.prepare(
    'SELECT * FROM payroll_batches WHERE run_id=? ORDER BY batch_index'
  ).all(runId);

  const statusCounts = {};
  let totalPaid = 0;
  for (const e of entries) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    if (e.status === 'confirmed') totalPaid += parseFloat(e.amount);
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').text('PayrollRails', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#666')
    .text('Cross-Border Stablecoin Payroll Report', 50, 76);

  doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#e2e8f0').lineWidth(1).stroke();

  // ── Run summary ──────────────────────────────────────────────────────────────
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Run Summary', 50, 110);

  const summaryY = 132;
  const col1 = 50, col2 = 300;
  doc.fontSize(9).font('Helvetica');

  const summaryLeft = [
    ['Run Name', run.name],
    ['Run ID', run.id],
    ['Network', run.network.toUpperCase()],
    ['Mode', run.dry_run ? 'DRY RUN' : 'LIVE'],
    ['Status', run.status.toUpperCase()],
  ];

  const summaryRight = [
    ['Total Recipients', String(run.total_rows)],
    ['Confirmed', String(statusCounts.confirmed || 0)],
    ['Vouchers Created', String(statusCounts.voucher_created || 0)],
    ['Failed', String(statusCounts.failed || 0)],
    ['Total USDC Paid', `$${totalPaid.toFixed(2)}`],
  ];

  for (let i = 0; i < summaryLeft.length; i++) {
    const y = summaryY + i * 16;
    doc.font('Helvetica-Bold').text(summaryLeft[i][0] + ':', col1, y, { continued: false });
    doc.font('Helvetica').text(summaryLeft[i][1], col1 + 110, y);
    doc.font('Helvetica-Bold').text(summaryRight[i][0] + ':', col2, y, { continued: false });
    doc.font('Helvetica').text(summaryRight[i][1], col2 + 130, y);
  }

  const datesY = summaryY + summaryLeft.length * 16 + 4;
  doc.font('Helvetica-Bold').text('Created:', col1, datesY);
  doc.font('Helvetica').text(run.created_at, col1 + 110, datesY);
  if (run.completed_at) {
    doc.font('Helvetica-Bold').text('Completed:', col2, datesY);
    doc.font('Helvetica').text(run.completed_at, col2 + 130, datesY);
  }

  // ── Batch summary ────────────────────────────────────────────────────────────
  const batchY = datesY + 28;
  doc.fontSize(14).font('Helvetica-Bold').text('Transaction Batches', 50, batchY);

  const batchHeaderY = batchY + 20;
  drawTableHeader(doc, batchHeaderY, ['Batch', 'Status', 'Entries', 'TX Hash', 'Attempts']);
  let curY = batchHeaderY + 18;

  for (const b of batches) {
    const entryCount = entries.filter((e) => e.batch_index === b.batch_index).length;
    drawTableRow(doc, curY, [
      String(b.batch_index + 1),
      b.status,
      String(entryCount),
      b.fee_bump_hash ? b.fee_bump_hash.slice(0, 20) + '…' : '—',
      String(b.attempt_count),
    ]);
    curY += 16;
    if (curY > 700) { doc.addPage(); curY = 50; }
  }

  // ── Recipient table ──────────────────────────────────────────────────────────
  curY += 16;
  if (curY > 650) { doc.addPage(); curY = 50; }
  doc.fontSize(14).font('Helvetica-Bold').text('Recipient Details', 50, curY);
  curY += 20;

  drawTableHeader(doc, curY, ['#', 'Name', 'Country', 'Amount', 'Status', 'TX / Ref']);
  curY += 18;

  for (const e of entries) {
    if (curY > 750) { doc.addPage(); curY = 50; }
    const txRef = e.tx_hash
      ? e.tx_hash.slice(0, 16) + '…'
      : e.v_ref
        ? `🎫 ${e.v_ref.slice(0, 12)}…`
        : '—';

    drawTableRow(doc, curY, [
      String(e.row_index + 1),
      (e.name || '').slice(0, 20),
      e.country || '—',
      `$${parseFloat(e.amount).toFixed(2)}`,
      (STATUS_EMOJI[e.status] || '') + ' ' + e.status,
      txRef,
    ], e.status === 'failed' ? '#dc2626' : e.status === 'confirmed' ? '#16a34a' : '#374151');
    curY += 16;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    doc.fontSize(8).fillColor('#9ca3af')
      .text(
        `PayrollRails Audit Report — Generated ${new Date().toISOString()} — Page ${i + 1} of ${pages.count}`,
        50, doc.page.height - 30, { align: 'center' }
      );
  }

  doc.pipe(res);
  doc.end();
}

function drawTableHeader(doc, y, cols) {
  const widths = getColWidths(cols.length);
  doc.rect(50, y - 2, 495, 16).fill('#f1f5f9');
  doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
  let x = 54;
  for (let i = 0; i < cols.length; i++) {
    doc.text(cols[i], x, y, { width: widths[i], ellipsis: true });
    x += widths[i];
  }
}

function drawTableRow(doc, y, cols, color = '#374151') {
  const widths = getColWidths(cols.length);
  doc.fillColor(color).fontSize(8).font('Helvetica');
  let x = 54;
  for (let i = 0; i < cols.length; i++) {
    doc.text(String(cols[i] ?? ''), x, y, { width: widths[i] - 4, ellipsis: true });
    x += widths[i];
  }
  doc.moveTo(50, y + 13).lineTo(545, y + 13).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
}

function getColWidths(n) {
  const total = 495;
  if (n === 5) return [30, 60, 130, 60, 120, 95];
  if (n === 6) return [25, 100, 65, 65, 100, 140];
  return Array(n).fill(Math.floor(total / n));
}
