import { google } from 'googleapis';
import { settings } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  COLUMN_FIELDS,
  SHEET_RANGE,
  APPROVAL_VALUE,
  HEADER_ROW,
  companyToRow,
  rowToCompany,
} from './mapper.js';

const KEY_FILE = 'credentials/service-account.json';

// ─── Internal helpers ────────────────────────────────────────────────────────

function requireSpreadsheetId() {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('SPREADSHEET_ID が .env に設定されていません');
  return id;
}

function getSheetName() {
  return process.env.SHEET_NAME ?? '営業リスト';
}

async function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 企業リストをスプレッドシートへ追記する。
 * @param {import('../models/company.js').Company[]} companies
 * @returns {Promise<object | null>} Sheets API レスポンス。空配列の場合は null。
 */
export async function appendCompanies(companies) {
  requireSpreadsheetId();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = getSheetName();

  if (!companies.length) {
    logger.warn('[Sheets] 追記する企業データがありません');
    return null;
  }

  const sheets = await createSheetsClient();
  const rows = companies.map(companyToRow);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!${SHEET_RANGE}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  logger.success(`[Sheets] ${companies.length} 件を追記しました`);
  return response.data;
}

/**
 * 送信可否が「○」の行を取得して返す。
 * 返り値オブジェクトには _rowIndex プロパティ（1 始まり行番号）が付与される。
 * @returns {Promise<Array<Record<string, string> & { _rowIndex: number }>>}
 */
export async function getApprovedRows() {
  requireSpreadsheetId();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = getSheetName();

  const sheets = await createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${SHEET_RANGE}`,
  });

  const allRows = response.data.values ?? [];
  // ヘッダー行がある場合は先頭行をスキップし、rowIndex に +1 する
  const dataRows = HEADER_ROW ? allRows.slice(1) : allRows;
  const rowOffset = HEADER_ROW ? 2 : 1;

  const approvalColIndex = COLUMN_FIELDS.indexOf('sendApproval');

  return dataRows
    .map((row, i) => ({ row, rowIndex: i + rowOffset }))
    .filter(({ row }) => (row[approvalColIndex] ?? '') === APPROVAL_VALUE)
    .map(({ row, rowIndex }) => ({ ...rowToCompany(row), _rowIndex: rowIndex }));
}

/**
 * 指定行のフィールドを一括更新する。
 * values のキーは Company フィールド名（例: { status: '送信済', sentDate: '2024-06-26' }）。
 * settings.json の列定義に存在しないフィールドはスキップされる。
 * @param {number} rowIndex  シートの行番号（1 始まり）
 * @param {Record<string, string | number | null>} values  更新内容
 * @returns {Promise<object | null>} Sheets API レスポンス。更新対象がなければ null。
 */
export async function updateStatus(rowIndex, values) {
  requireSpreadsheetId();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = getSheetName();

  const data = Object.entries(values)
    .map(([field, value]) => {
      const colDef = settings.sheets.columns[field];
      if (!colDef) return null;
      return {
        range: `${sheetName}!${colDef.col}${rowIndex}`,
        values: [[value ?? '']],
      };
    })
    .filter(Boolean);

  if (!data.length) {
    logger.warn('[Sheets] 更新するフィールドがありません');
    return null;
  }

  const sheets = await createSheetsClient();
  const response = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });

  logger.success(`[Sheets] 行 ${rowIndex} を更新しました`);
  return response.data;
}
