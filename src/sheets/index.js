import { google } from 'googleapis';
import { createAuth } from './auth.js';
import { SheetsService } from './service.js';

export { SheetsService };
export { createAuth, getOAuthAuthUrl, saveOAuthToken } from './auth.js';
export {
  SendHistoryService,
  createSendHistoryService,
  SEND_RESULT,
  generateBatchId,
} from './send-history.js';
export {
  ReplyHistoryService,
  createReplyHistoryService,
  REPLY_HISTORY_SHEET,
  REPLY_HISTORY_HEADERS,
} from './reply-history.js';

/**
 * 認証済みの SheetsService インスタンスを生成する。
 *
 * テストでは googleapis を経由せず、SheetsService に直接 mock sheetsApi を注入すること:
 *   new SheetsService({ sheetsApi: mockApi, spreadsheetId: 'id', sheetName: '...' })
 *
 * @returns {Promise<SheetsService>}
 */
export async function createSheetsService() {
  const auth = await createAuth();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  return new SheetsService({ sheetsApi });
}

// ── Convenience wrappers（後方互換 / CLI コマンドから直接呼べる形式）─────────

/**
 * 企業リストをスプレッドシートへ追記する。
 * @param {import('../models/company.js').Company[]} companies
 */
export async function appendCompanies(companies) {
  const service = await createSheetsService();
  return service.appendCompanies(companies);
}

/**
 * 送信可否が「○」の行を取得して返す。
 */
export async function getApprovedRows() {
  const service = await createSheetsService();
  return service.getApprovedRows();
}

/**
 * 指定行のフィールドを一括更新する。
 * @param {number} rowIndex
 * @param {Record<string, string | number | null>} values
 */
export async function updateStatus(rowIndex, values) {
  const service = await createSheetsService();
  return service.updateStatus(rowIndex, values);
}
