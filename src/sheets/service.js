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

/**
 * Google Sheets への読み書きを担うサービスクラス。
 *
 * sheetsApi をコンストラクタで注入することで、
 * テスト時は googleapis を一切モックせずに動作を検証できる。
 *
 * 本番環境では createSheetsService()（index.js）を使って生成する。
 * テスト環境では new SheetsService({ sheetsApi: mockApi, ... }) で直接生成する。
 *
 * @example 本番
 *   import { createSheetsService } from './index.js';
 *   const service = await createSheetsService();
 *   await service.appendCompanies(companies);
 *
 * @example テスト
 *   const mockApi = { spreadsheets: { values: { append: vi.fn(), ... } } };
 *   const service = new SheetsService({ sheetsApi: mockApi, spreadsheetId: 'id' });
 */
export class SheetsService {
  /**
   * @param {{
   *   sheetsApi: object,
   *   spreadsheetId?: string,
   *   sheetName?: string,
   * }} options
   */
  constructor({ sheetsApi, spreadsheetId, sheetName } = {}) {
    if (!sheetsApi) throw new Error('sheetsApi は必須です');
    this._api = sheetsApi;
    this._spreadsheetId = spreadsheetId ?? process.env.SPREADSHEET_ID ?? '';
    this._sheetName = sheetName ?? process.env.SHEET_NAME ?? '営業リスト';
  }

  _requireSpreadsheetId() {
    if (!this._spreadsheetId) {
      throw new Error('SPREADSHEET_ID が .env に設定されていません');
    }
    return this._spreadsheetId;
  }

  /**
   * 企業リストをスプレッドシートへ追記する。
   * @param {import('../models/company.js').Company[]} companies
   * @returns {Promise<object | null>} Sheets API レスポンス。空配列の場合は null。
   */
  async appendCompanies(companies) {
    const spreadsheetId = this._requireSpreadsheetId();

    if (!companies.length) {
      logger.warn('[Sheets] 追記する企業データがありません');
      return null;
    }

    const rows = companies.map(companyToRow);
    const response = await this._api.spreadsheets.values.append({
      spreadsheetId,
      range: `${this._sheetName}!${SHEET_RANGE}`,
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
  async getApprovedRows() {
    const spreadsheetId = this._requireSpreadsheetId();

    const response = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: `${this._sheetName}!${SHEET_RANGE}`,
    });

    const allRows = response.data.values ?? [];
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
  async updateStatus(rowIndex, values) {
    const spreadsheetId = this._requireSpreadsheetId();

    const data = Object.entries(values)
      .map(([field, value]) => {
        const colDef = settings.sheets.columns[field];
        if (!colDef) return null;
        return {
          range: `${this._sheetName}!${colDef.col}${rowIndex}`,
          values: [[value ?? '']],
        };
      })
      .filter(Boolean);

    if (!data.length) {
      logger.warn('[Sheets] 更新するフィールドがありません');
      return null;
    }

    const response = await this._api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });

    logger.success(`[Sheets] 行 ${rowIndex} を更新しました`);
    return response.data;
  }
}
