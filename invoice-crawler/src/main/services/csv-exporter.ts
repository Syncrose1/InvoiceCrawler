import { promises as fs } from 'fs';
import type { ExtractionField, InvoiceResult } from '@shared/types';
import { MISSING_VALUE } from '@shared/constants';

const FILE_NAME_COLUMN = 'File';
const STATUS_COLUMN = 'Status';

export async function exportCsv(
  results: InvoiceResult[],
  fields: ExtractionField[],
  outputPath: string,
): Promise<void> {
  const header = [FILE_NAME_COLUMN, STATUS_COLUMN, ...fields.map((f) => f.name)];
  const lines: string[] = [header.map(quote).join(',')];

  for (const result of results) {
    const row = [
      result.fileName,
      humaniseStatus(result),
      ...fields.map((f) => result.data[f.key] ?? MISSING_VALUE),
    ];
    lines.push(row.map((value) => quote(neutraliseFormula(value))).join(','));
  }

  // Prepend a UTF-8 BOM so Excel opens non-ASCII (e.g. £, €, Arabic, CJK) correctly.
  const content = '﻿' + lines.join('\r\n') + '\r\n';
  await fs.writeFile(outputPath, content, 'utf-8');
}

/**
 * Stop Excel from evaluating extracted text as a formula. Values come from
 * untrusted invoices via the model, so `=HYPERLINK(...)` or `@SUM(...)` would
 * otherwise run on open. A leading apostrophe makes Excel treat the cell as
 * text. Plain numbers (`-12.50`, `+44 20 ...`) and the missing-value dash are
 * left alone so they still sort and sum.
 */
function neutraliseFormula(value: string): string {
  if (value === MISSING_VALUE) return value;
  if (!/^[=+\-@\t\r]/.test(value)) return value;
  if (/^[+-]?[\d.,\s]+$/.test(value)) return value;
  return `'${value}`;
}

function quote(value: string): string {
  // Quote the field if it contains comma, quote, CR, LF, or leading/trailing whitespace.
  if (/[",\r\n]|^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function humaniseStatus(result: InvoiceResult): string {
  switch (result.status) {
    case 'success':
      return 'Success';
    case 'error':
      return result.error ? `Error: ${result.error}` : 'Error';
    case 'processing':
      return 'In progress';
    case 'pending':
    default:
      return 'Pending';
  }
}
