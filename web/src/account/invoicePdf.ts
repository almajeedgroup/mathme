import { inr } from './plans';

export interface Invoice {
  number: string;
  issued_at: number;
  billing_name: string;
  billing_email: string;
  billing_state: string;
  billing_gstin: string;
  base: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  lines: { description: string; sac: string; amount: number }[];
  seller: { name: string; address: string; state: string; gstin: string; email: string };
}

/** A GST tax invoice as a PDF, made in the browser from the account service's invoice record. */
export async function invoicePdf(inv: Invoice): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { pdfSafe } = await import('../export/pdf');
  const money = (p: number) => pdfSafe(inr(p, true).replace('₹', 'Rs. '));
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const t = (
    text: string,
    x: number,
    y: number,
    opts: { bold?: boolean; size?: number; right?: boolean } = {},
  ) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 10);
    doc.text(pdfSafe(text), x, y, opts.right ? { align: 'right' } : undefined);
  };
  t('TAX INVOICE', 16, 20, { bold: true, size: 18 });
  t(`Invoice ${inv.number}`, 194, 20, { right: true, bold: true });
  t(`Date: ${new Date(inv.issued_at * 1000).toLocaleDateString('en-IN')}`, 194, 26, { right: true });

  t('From', 16, 38, { bold: true });
  let y = 44;
  for (const line of [
    inv.seller.name,
    inv.seller.address,
    `State: ${inv.seller.state}`,
    inv.seller.gstin && `GSTIN: ${inv.seller.gstin}`,
    inv.seller.email,
  ].filter(Boolean) as string[]) {
    t(line, 16, y);
    y += 5;
  }
  t('Bill to', 110, 38, { bold: true });
  y = 44;
  for (const line of [
    inv.billing_name,
    inv.billing_email,
    `State: ${inv.billing_state}`,
    inv.billing_gstin && `GSTIN: ${inv.billing_gstin}`,
  ].filter(Boolean) as string[]) {
    t(line, 110, y);
    y += 5;
  }

  y = 80;
  doc.setDrawColor(200, 190, 230);
  doc.line(16, y, 194, y);
  t('Description', 16, y + 6, { bold: true });
  t('SAC', 140, y + 6, { bold: true });
  t('Amount', 194, y + 6, { bold: true, right: true });
  y += 14;
  for (const l of inv.lines) {
    t(l.description, 16, y);
    t(l.sac, 140, y);
    t(money(l.amount), 194, y, { right: true });
    y += 7;
  }
  doc.line(16, y, 194, y);
  y += 7;
  const row = (label: string, value: number, bold = false) => {
    t(label, 140, y, { bold });
    t(money(value), 194, y, { right: true, bold });
    y += 6;
  };
  row('Taxable value', inv.base);
  if (inv.igst) row('IGST 18%', inv.igst);
  else {
    row('CGST 9%', inv.cgst);
    row('SGST 9%', inv.sgst);
  }
  row('Total', inv.total, true);
  t('This is a computer-generated invoice and needs no signature.', 16, 280, { size: 8 });
  return doc.output('blob');
}
