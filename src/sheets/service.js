import { logger } from '../utils/logger.js';
import {
  APPROVAL_VALUE,
  PROTECTED_FIELDS,
  HEADER_TO_FIELD,
  FIELD_TO_HEADER,
  colIndexToLetter,
  companyToRowByHeaders,
  rowToCompanyByHeaders,
  generateCompanyId,
} from './mapper.js';

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
   *
   * - companyId（企業ID）で既存行を検索し、重複はスキップ
   * - 既存行には空欄のみ補完（PROTECTED_FIELDS は除外）
   * - 新規行は一括 append
   * - 電話番号等の「+」始まりが #ERROR! にならないよう valueInputOption:'RAW' を使用
   *
   * @param {import('../models/company.js').Company[]} companies
   * @returns {Promise<{ appended: number, merged: number } | null>}
   */
  async appendCompanies(companies) {
    const spreadsheetId = this._requireSpreadsheetId();

    if (!companies.length) {
      logger.warn('[Sheets] 追記する企業データがありません');
      return null;
    }

    // シート全データを取得（dedup / merge のため常に新鮮なデータ）
    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: this._sheetName,
    });
    const allRows = res.data.values ?? [];
    const headers = allRows.length ? allRows[0].map(String) : [];

    // 企業ID列がなければヘッダー行に追加する
    const companyIdHeader = FIELD_TO_HEADER['companyId']; // '企業ID'
    if (!headers.includes(companyIdHeader)) {
      const newColIndex = headers.length;
      const newColLetter = colIndexToLetter(newColIndex);
      await this._api.spreadsheets.values.update({
        spreadsheetId,
        range: `${this._sheetName}!${newColLetter}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [[companyIdHeader]] },
      });
      headers.push(companyIdHeader);
      logger.info(`[Sheets] 「企業ID」列を追加しました（${newColLetter}列）`);
    }

    // ヘッダーキャッシュを更新（常に最新状態で上書き）
    this._headerCache = this._buildHeaderCache(headers);
    const { fieldToColIndex } = this._headerCache;

    // 既存企業ID → { rowIndex, row } マップを構築
    const companyIdColIndex = fieldToColIndex.get('companyId') ?? -1;
    const existingMap = new Map();
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      const id = companyIdColIndex >= 0 ? (row[companyIdColIndex] ?? '') : '';
      if (id) existingMap.set(id, { rowIndex: i + 1, row });
    }

    // 各企業を新規 or 既存（重複）に分類
    const toAppend = [];
    const toMerge = [];
    for (const company of companies) {
      const id = generateCompanyId(company);
      const enriched = { ...company, companyId: id };
      const existing = existingMap.get(id);
      if (!existing) {
        toAppend.push(enriched);
      } else {
        toMerge.push({
          company: enriched,
          rowIndex: existing.rowIndex,
          existingRow: existing.row,
        });
      }
    }

    // 新規企業を一括追記
    if (toAppend.length) {
      const rows = toAppend.map((c) => companyToRowByHeaders(c, headers));
      await this._api.spreadsheets.values.append({
        spreadsheetId,
        range: `${this._sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
      });
      logger.success(`[Sheets] ${toAppend.length} 件を追記しました`);
    }

    // 既存企業の空欄のみ補完（PROTECTED_FIELDS は絶対に更新しない）
    for (const { company, rowIndex, existingRow } of toMerge) {
      const updates = {};
      for (const [field, colIndex] of fieldToColIndex) {
        if (PROTECTED_FIELDS.has(field)) continue;
        const existingVal = existingRow[colIndex] ?? '';
        if (existingVal !== '') continue;
        const newVal = company[field];
        if (newVal === null || newVal === undefined || String(newVal) === '') continue;
        updates[field] = String(newVal);
      }
      if (Object.keys(updates).length) {
        await this.updateStatus(rowIndex, updates);
        logger.info(`[Sheets] 行 ${rowIndex}: 空欄を補完しました`);
      } else {
        logger.info(`[Sheets] 行 ${rowIndex}: 補完対象なし（スキップ）`);
      }
    }

    logger.success(`[Sheets] 完了: 追記 ${toAppend.length} 件 / 重複スキップ ${toMerge.length} 件`);
    return { appended: toAppend.length, merged: toMerge.length };
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

    if (!this._headerCache) {
      this._headerCache = this._buildHeaderCache(headers);
    }

    const { fieldToColIndex } = this._headerCache;
    const dataRows = allRows.slice(1);
    const rowOffset = 2;

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
   * valueInputOption を RAW にすることで「+」始まりの電話番号等が数式扱いされない。
   * @param {number} rowIndex  シートの行番号（1 始まり）
   * @param {Record<string, string | number | null>} values  更新内容
   * @returns {Promise<object | null>}
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
        valueInputOption: 'RAW',
        data,
      },
    });

    logger.success(`[Sheets] 行 ${rowIndex} を更新しました`);
    return response.data;
  }
}
