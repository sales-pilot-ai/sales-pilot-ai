import { logger } from '../utils/logger.js';
import {
  APPROVAL_VALUE,
  HEADER_TO_FIELD,
  colIndexToLetter,
  companyToRowByHeaders,
  rowToCompanyByHeaders,
} from './mapper.js';

/**
 * Google Sheets への読み書きを担うサービスクラス。
 *
 * sheetsApi をコンストラクタで注入することで、
 * テスト時は googleapis を一切モックせずに動作を検証できる。
 *
 * シートの列順はヘッダー行（1 行目）から動的に取得する。
 * 列の順番が変わっても、ヘッダー名が同じであれば正しく読み書きできる。
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
    this._sheetName = sheetName ?? (process.env.SHEET_NAME || '営業リスト');
    /** @type {{ headers: string[], fieldToColLetter: Map<string,string>, fieldToColIndex: Map<string,number> } | null} */
    this._headerCache = null;
  }

  _requireSpreadsheetId() {
    if (!this._spreadsheetId) {
      throw new Error('SPREADSHEET_ID が .env に設定されていません');
    }
    return this._spreadsheetId;
  }

  /**
   * ヘッダー配列からキャッシュオブジェクトを構築する。
   * @param {string[]} headers
   */
  _buildHeaderCache(headers) {
    const fieldToColLetter = new Map();
    const fieldToColIndex = new Map();
    headers.forEach((header, i) => {
      const field = HEADER_TO_FIELD[header];
      if (field) {
        fieldToColLetter.set(field, colIndexToLetter(i));
        fieldToColIndex.set(field, i);
      }
    });
    return { headers, fieldToColLetter, fieldToColIndex };
  }

  /**
   * シートの 1 行目を読み取ってヘッダーキャッシュを返す。
   * 2 回目以降はキャッシュを返す（API 呼び出しなし）。
   */
  async _loadHeaders() {
    if (this._headerCache) return this._headerCache;
    const spreadsheetId = this._requireSpreadsheetId();
    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: `${this._sheetName}!1:1`,
    });
    const headers = ((res.data.values ?? [])[0] ?? []).map(String);
    this._headerCache = this._buildHeaderCache(headers);
    return this._headerCache;
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

    const { headers } = await this._loadHeaders();
    const rows = companies.map((c) => companyToRowByHeaders(c, headers));

    const response = await this._api.spreadsheets.values.append({
      spreadsheetId,
      range: `${this._sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    logger.success(`[Sheets] ${companies.length} 件を追記しました`);
    return response.data;
  }

  /**
   * 送信可否が「○」の行を取得して返す。
   * 1 行目はヘッダーとして扱い、返り値オブジェクトには _rowIndex（1 始まり行番号）が付与される。
   * @returns {Promise<Array<Record<string, string> & { _rowIndex: number }>>}
   */
  async getApprovedRows() {
    const spreadsheetId = this._requireSpreadsheetId();

    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: `${this._sheetName}`,
    });

    const allRows = res.data.values ?? [];
    if (!allRows.length) return [];

    const headers = allRows[0].map(String);

    // getApprovedRows で取得したヘッダーをキャッシュに反映（後続の update 呼び出しで再取得しない）
    if (!this._headerCache) {
      this._headerCache = this._buildHeaderCache(headers);
    }

    const { fieldToColIndex } = this._headerCache;
    const dataRows = allRows.slice(1);
    const rowOffset = 2; // 1-based、ヘッダー行分ずらす

    const approvalColIndex = fieldToColIndex.get('sendApproval') ?? -1;
    if (approvalColIndex === -1) return [];

    return dataRows
      .map((row, i) => ({ row, rowIndex: i + rowOffset }))
      .filter(({ row }) => (row[approvalColIndex] ?? '') === APPROVAL_VALUE)
      .map(({ row, rowIndex }) => ({
        ...rowToCompanyByHeaders(row, headers),
        _rowIndex: rowIndex,
      }));
  }

  /**
   * 指定行のフィールドを一括更新する。
   * values のキーは Company フィールド名（例: { status: '送信済', sentDate: '2024-06-26' }）。
   * ヘッダーに存在しないフィールドはスキップされる。
   * @param {number} rowIndex  シートの行番号（1 始まり）
   * @param {Record<string, string | number | null>} values  更新内容
   * @returns {Promise<object | null>} Sheets API レスポンス。更新対象がなければ null。
   */
  async updateStatus(rowIndex, values) {
    const spreadsheetId = this._requireSpreadsheetId();
    const { fieldToColLetter } = await this._loadHeaders();

    const data = Object.entries(values)
      .map(([field, value]) => {
        const colLetter = fieldToColLetter.get(field);
        if (!colLetter) return null;
        return {
          range: `${this._sheetName}!${colLetter}${rowIndex}`,
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
