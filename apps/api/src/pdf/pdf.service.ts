import { Injectable } from '@nestjs/common';
import { ActionLog, CollectionCase, Customer, Loan } from '@prisma/client';
import dayjs = require('dayjs');
import * as puppeteer from 'puppeteer-core';

type CaseNoticeInput = {
  caseData: CollectionCase;
  customer: Customer;
  loan: Loan;
  lastActions: ActionLog[];
};

@Injectable()
export class PdfService {
  async generatePaymentNotice(input: CaseNoticeInput): Promise<Buffer> {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      const payBefore = dayjs().add(3, 'day').format('YYYY-MM-DD');
      const generatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');

      const actionsMarkup = input.lastActions.length
        ? input.lastActions
            .map(
              (log) =>
                `<tr><td>${log.type}</td><td>${log.outcome}</td><td>${escapeHtml(log.notes)}</td><td>${dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="4">No actions logged</td></tr>';
// In a real app, you'd want to use a proper templating engine instead of embedding HTML like this, but this keeps dependencies minimal because puppeteer can render raw HTML to PDF without needing a browser context with assets, etc.
      const html = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px; }
          .logo { width: 140px; height: 40px; border: 1px dashed #9ca3af; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 12px; }
          h1 { margin: 0; font-size: 22px; }
          .section { margin-top: 20px; }
          .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
          .value { font-size: 15px; margin-top: 2px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
          .footer { margin-top: 24px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Payment Reminder Notice</h1>
            <div class="label">Collections Case #${input.caseData.id}</div>
          </div>
          <div class="logo">LOGO PLACEHOLDER</div>
        </div>

        <div class="section grid">
          <div><div class="label">Customer</div><div class="value">${escapeHtml(input.customer.name)}</div></div>
          <div><div class="label">Email</div><div class="value">${escapeHtml(input.customer.email)}</div></div>
          <div><div class="label">Phone</div><div class="value">${escapeHtml(input.customer.phone)}</div></div>
          <div><div class="label">Country</div><div class="value">${escapeHtml(input.customer.country)}</div></div>
        </div>

        <div class="section grid">
          <div><div class="label">Loan ID</div><div class="value">${input.loan.id}</div></div>
          <div><div class="label">Outstanding</div><div class="value">$${input.loan.outstanding}</div></div>
          <div><div class="label">DPD</div><div class="value">${input.caseData.dpd}</div></div>
          <div><div class="label">Stage / Assigned</div><div class="value">${input.caseData.stage} / ${input.caseData.assignedTo ?? 'Unassigned'}</div></div>
          <div><div class="label">Pay Before</div><div class="value">${payBefore}</div></div>
        </div>

        <div class="section">
          <div class="label">Last 3 Actions</div>
          <table>
            <thead>
              <tr><th>Type</th><th>Outcome</th><th>Notes</th><th>Created At</th></tr>
            </thead>
            <tbody>${actionsMarkup}</tbody>
          </table>
        </div>

        <div class="footer">Generated at ${generatedAt}</div>
      </body>
      </html>
    `;

      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
