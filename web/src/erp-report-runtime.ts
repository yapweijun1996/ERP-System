import ExcelJS from 'exceljs';

export interface BrowserBudgetRow {
  accountCode: string;
  periodNo: number;
  amount: string;
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += character;
  }
  cells.push(value.trim());
  return cells;
}

function mapRows(rows: unknown[][]): BrowserBudgetRow[] {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => String(value ?? '').trim().toLowerCase());
  const accountIndex = headers.findIndex((value) =>
    ['account', 'account code', 'account_code'].includes(value));
  const periodIndex = headers.findIndex((value) =>
    ['period', 'period no', 'period_no'].includes(value));
  const amountIndex = headers.findIndex((value) => value === 'amount');
  if ([accountIndex, periodIndex, amountIndex].some((index) => index < 0)) {
    throw new Error('Budget file requires Account Code, Period No and Amount columns.');
  }
  return rows.slice(1).filter((row) => row.some((value) => String(value ?? '').trim()))
    .map((row) => ({
      accountCode: String(row[accountIndex] ?? '').trim(),
      periodNo: Number(row[periodIndex]),
      amount: String(row[amountIndex] ?? '').trim(),
    }));
}

async function parseBudgetFile(file: File): Promise<BrowserBudgetRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Budget file must be 5 MB or smaller.');
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    return mapRows(text.split(/\r?\n/).filter(Boolean).map(csvCells));
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Use a CSV or XLSX budget file.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Budget workbook has no worksheet.');
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1).map((value) => {
      if (value && typeof value === 'object' && 'result' in value) {
        return (value as { result?: unknown }).result;
      }
      return value;
    }));
  });
  return mapRows(rows);
}

declare global {
  interface Window {
    ErpReportRuntime?: {
      parseBudgetFile(file: File): Promise<BrowserBudgetRow[]>;
    };
  }
}

window.ErpReportRuntime = Object.freeze({ parseBudgetFile });

export {};
