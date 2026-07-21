import { createWriteStream } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { env } from '../../config/env.js';

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedAt: Date;
  amountUsd: number;
  planName: string;
  customerName: string;
  customerEmail: string;
  method: string;
  transactionId: string;
}

const BRAND_GREEN = '#166534';
const TEXT_DARK = '#1e293b';
const TEXT_MUTED = '#64748b';

/** Render a subscription invoice PDF and return its absolute file path. */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<string> {
  const fileName = `invoice-${data.invoiceNumber}.pdf`;
  const filePath = path.join(env.reportsDir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header band
  doc.rect(0, 0, doc.page.width, 110).fill(BRAND_GREEN);
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(24).text('GeoAgri AI', 50, 34);
  doc.font('Helvetica').fontSize(10).text('Smart Farming from Space', 50, 64);
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('INVOICE', 0, 40, { align: 'right', width: doc.page.width - 50 });

  // Invoice meta
  doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(11).text('Invoice Number', 50, 140);
  doc.font('Helvetica').fontSize(11).fill(TEXT_MUTED).text(data.invoiceNumber, 50, 156);
  doc.fill(TEXT_DARK).font('Helvetica-Bold').text('Date Issued', 250, 140);
  doc
    .font('Helvetica')
    .fill(TEXT_MUTED)
    .text(data.issuedAt.toISOString().slice(0, 10), 250, 156);
  doc.fill(TEXT_DARK).font('Helvetica-Bold').text('Status', 420, 140);
  doc.font('Helvetica').fill(BRAND_GREEN).text('PAID', 420, 156);

  // Billed to
  doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(11).text('Billed To', 50, 200);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fill(TEXT_MUTED)
    .text(data.customerName, 50, 216)
    .text(data.customerEmail, 50, 231);

  // Line items table
  const tableTop = 280;
  doc.rect(50, tableTop, doc.page.width - 100, 26).fill('#f1f5f9');
  doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(10);
  doc.text('Description', 62, tableTop + 8);
  doc.text('Period', 300, tableTop + 8);
  doc.text('Amount', 0, tableTop + 8, { align: 'right', width: doc.page.width - 62 });

  const rowY = tableTop + 36;
  doc.font('Helvetica').fontSize(10).fill(TEXT_DARK);
  doc.text(`${data.planName} subscription`, 62, rowY);
  doc.text('30 days', 300, rowY);
  doc.text(`$${data.amountUsd.toFixed(2)} USD`, 0, rowY, {
    align: 'right',
    width: doc.page.width - 62,
  });

  doc
    .moveTo(50, rowY + 24)
    .lineTo(doc.page.width - 50, rowY + 24)
    .strokeColor('#e2e8f0')
    .stroke();

  doc.font('Helvetica-Bold').fontSize(12).fill(TEXT_DARK);
  doc.text('Total', 300, rowY + 40);
  doc.fill(BRAND_GREEN).text(`$${data.amountUsd.toFixed(2)} USD`, 0, rowY + 40, {
    align: 'right',
    width: doc.page.width - 62,
  });

  // Payment details
  doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(11).text('Payment Details', 50, rowY + 90);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fill(TEXT_MUTED)
    .text(`Method: ${data.method.replace('_', ' ')}`, 50, rowY + 108)
    .text(`Transaction ID: ${data.transactionId}`, 50, rowY + 123)
    .text('Verification: manually verified by GeoAgri AI billing', 50, rowY + 138);

  // Footer
  doc
    .fontSize(9)
    .fill(TEXT_MUTED)
    .text(
      'Thank you for choosing GeoAgri AI. This invoice was generated electronically and is valid without a signature.',
      50,
      760,
      { align: 'center', width: doc.page.width - 100 },
    );

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return filePath;
}
