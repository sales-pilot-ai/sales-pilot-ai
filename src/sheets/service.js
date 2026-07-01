import { logger } from '../utils/logger.js';
import {
  APPROVAL_VALUE,
  PROTECTED_FIELDS,
  HEADER_TO_FIELD,
  FIELD_TO_HEADER,
  colIndexToLetter,
  companyToRowByHeaders,
  rowToCompanyByHeaders,
  generateDedupKey,
  formatCompanyId,
  parseCompanyId,
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
   * - 企業ID は連番（000001 形式）で採番し、一度付与したら変更しない
   * - Place ID / websiteUrl / 企業名+電話で重複判定し、既存企業はスキップ
   * - 既存行には空欄のみ補完（PROTECTED_FIELDS は除外）
   * - 新規行は一括 append
   * - 旧形式（place:xxx）の企業ID を持つ行は自動マイグレーション
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

    // ヘッダーキャッシュを必ずクリア（人がシートを編集して列が変わっていても正しく読む）
    this._headerCache = null;

    // シート全データを取得（dedup / merge / migration のため常に新鮮なデータ）
    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: this._sheetName,
    });
    const allRows = res.data.values ?? [];
    const headers = allRows.length ? allRows[0].map(String) : [];

    // 企業ID列がなければヘッダー行に追加する
    const companyIdHeader = FIELD_TO_HEADER['companyId']; // '企業ID'
    if (!headers.includes(companyIdHeader)) {
      const newColLetter = colIndexToLetter(headers.length);
      await this._api.spreadsheets.values.update({
        spreadsheetId,
        range: `${this._sheetName}!${newColLetter}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [[companyIdHeader]] },
      });
      headers.push(companyIdHeader);
      logger.info(`[Sheets] 「企業ID」列を追加しました（${newColLetter}列）`);
    }

    // Place ID 列がなければヘッダー行に追加する
    const placeIdHeader = FIELD_TO_HEADER['placeId']; // 'Place ID'
    if (!headers.includes(placeIdHeader)) {
      const newColLetter = colIndexToLetter(headers.length);
      await this._api.spreadsheets.values.update({
        spreadsheetId,
        range: `${this._sheetName}!${newColLetter}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [[placeIdHeader]] },
      });
      headers.push(placeIdHeader);
      logger.info(`[Sheets] 「Place ID」列を追加しました（${newColLetter}列）`);
    }

    // ヘッダーキャッシュを最新状態で構築
    this._headerCache = this._buildHeaderCache(headers);
    const { fieldToColIndex } = this._headerCache;

    const companyIdColIndex = fieldToColIndex.get('companyId') ?? -1;
    const placeIdColIndex = fieldToColIndex.get('placeId') ?? -1;
    const nameColIndex = fieldToColIndex.get('companyName') ?? -1;
    const websiteColIndex = fieldToColIndex.get('websiteUrl') ?? -1;

    // 既存行を走査してマイグレーション対象を特定する。
    // C000001 形式 → 有効（maxNum を更新）
    // 純数字 000001 形式 → C プレフィックスを付与して保持（旧 #021 形式）
    // place:xxx / 空 / その他 → 新しい連番を採番
    let maxNum = 0;
    const rowsToReformat = []; // 純数字形式: 番号維持で C プレフィックスを付加
    const rowsNeedingMigration = []; // place:xxx / 空 / その他: 新連番採番
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];

      // 空行スキップ（会社名・placeId・websiteUrl がすべて空）
      const name = nameColIndex >= 0 ? (row[nameColIndex] ?? '') : '';
      const placeIdVal = placeIdColIndex >= 0 ? (row[placeIdColIndex] ?? '') : '';
      const websiteVal = websiteColIndex >= 0 ? (row[websiteColIndex] ?? '') : '';
      if (!name && !placeIdVal && !websiteVal) continue;

      const id = companyIdColIndex >= 0 ? (row[companyIdColIndex] ?? '') : '';
      const cNum = parseCompanyId(id); // C000001 形式 → number, それ以外 → null
      if (cNum !== null) {
        // 既に C 形式: 有効
        maxNum = Math.max(maxNum, cNum);
      } else if (id !== '' && /^\d+$/.test(id)) {
        // 旧 000001 形式: 番号を維持して C プレフィックスを付加
        const n = parseInt(id, 10);
        maxNum = Math.max(maxNum, n);
        rowsToReformat.push({ rowIndex: i + 1, row, n });
      } else {
        // place:xxx / 空 / その他: 新連番採番
        rowsNeedingMigration.push({ rowIndex: i + 1, row, oldId: id });
      }
    }

    // 旧形式（純数字）を C プレフィックス付きに更新（番号は変えない）
    for (const { rowIndex, row, n } of rowsToReformat) {
      const newId = formatCompanyId(n);
      if (companyIdColIndex >= 0) row[companyIdColIndex] = newId;
      await this.updateStatus(rowIndex, { companyId: newId });
      logger.info(
        `[Sheets] 行 ${rowIndex}: 企業ID を ${n.toString().padStart(6, '0')} → ${newId} に変換`
      );
    }

    // マイグレーション: 旧形式（place:xxx / 空）を新しい C 形式連番に変換
    // row は allRows[i] への参照なので in-memory 更新すれば dedup でも反映される
    for (const { rowIndex, row, oldId } of rowsNeedingMigration) {
      maxNum++;
      const newId = formatCompanyId(maxNum);
      const updates = { companyId: newId };
      if (companyIdColIndex >= 0) row[companyIdColIndex] = newId;

      if (
        placeIdColIndex >= 0 &&
        (row[placeIdColIndex] ?? '') === '' &&
        oldId.startsWith('place:')
      ) {
        const extractedPlaceId = oldId.slice('place:'.length);
        updates.placeId = extractedPlaceId;
        row[placeIdColIndex] = extractedPlaceId;
      }

      await this.updateStatus(rowIndex, updates);
      logger.info(
        `[Sheets] 行 ${rowIndex}: 企業ID を ${newId} に採番（旧ID: ${oldId || '未設定'}）`
      );
    }

    // dedup マップ: generateDedupKey → { rowIndex, row }
    // Place ID > websiteUrl > 企業名+電話 の優先順位で重複判定
    // 同一キーが複数ある場合（シートの重複行）は警告を出す
    const dedupMap = new Map();
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];

      // 空行スキップ
      const name = nameColIndex >= 0 ? (row[nameColIndex] ?? '') : '';
      const placeIdVal = placeIdColIndex >= 0 ? (row[placeIdColIndex] ?? '') : '';
      const websiteVal = websiteColIndex >= 0 ? (row[websiteColIndex] ?? '') : '';
      if (!name && !placeIdVal && !websiteVal) continue;

      const rowCompany = rowToCompanyByHeaders(row, headers);
      const key = generateDedupKey(rowCompany);
      if (!key) continue;

      if (dedupMap.has(key)) {
        const firstRow = dedupMap.get(key).rowIndex;
        logger.warn(
          `[Sheets] 重複行を検出: "${rowCompany.companyName}" (行 ${firstRow} と行 ${i + 1})`
        );
      }
      dedupMap.set(key, { rowIndex: i + 1, row });
    }

    // 各企業を新規 or 既存（重複）に分類
    const toAppend = [];
    const toMerge = [];
    for (const company of companies) {
      const key = generateDedupKey(company);
      const existing = dedupMap.get(key);
      if (!existing) {
        maxNum++;
        toAppend.push({ ...company, companyId: formatCompanyId(maxNum) });
      } else {
        toMerge.push({
          company,
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

      // 並列プロセスによる companyId 重複を解消する（T-09 対応）
      await this._resolveCompanyIdConflicts(spreadsheetId);
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
   * シート全体をスキャンして重複 companyId を検出・再採番する。
   * 並列プロセスが同時に同じ maxNum から採番した場合の衝突を解消する（T-09）。
   * @param {string} spreadsheetId
   */
  async _resolveCompanyIdConflicts(spreadsheetId) {
    const { fieldToColIndex } = await this._loadHeaders();
    const companyIdColIndex = fieldToColIndex.get('companyId') ?? -1;
    if (companyIdColIndex < 0) return;

    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: this._sheetName,
    });
    const allRows = res.data.values ?? [];

    let maxNum = 0;
    const seen = new Map(); // companyId → first rowIndex
    const conflicts = []; // { rowIndex, oldId }

    for (let i = 1; i < allRows.length; i++) {
      const id = allRows[i]?.[companyIdColIndex] ?? '';
      const n = parseCompanyId(id);
      if (n === null) continue;
      maxNum = Math.max(maxNum, n);
      if (seen.has(id)) {
        conflicts.push({ rowIndex: i + 1, oldId: id });
      } else {
        seen.set(id, i + 1);
      }
    }

    if (conflicts.length === 0) return;

    logger.warn(`[Sheets] 企業ID の重複を ${conflicts.length} 件検出。再採番します`);
    for (const { rowIndex, oldId } of conflicts) {
      const newId = formatCompanyId(++maxNum);
      await this.updateStatus(rowIndex, { companyId: newId });
      logger.info(`[Sheets] 行 ${rowIndex}: 重複企業ID ${oldId} → ${newId} に再採番`);
    }
  }

  /**
   * 全行をスキャンして companyId が一致する行番号を返す。
   * ソート後に行番号がずれた場合の再検索に使う（T-03）。
   * @param {string} spreadsheetId
   * @param {string} companyId  例: 'C000001'
   * @returns {Promise<number | null>}  1-based 行番号、見つからない場合は null
   */
  async _findRowByCompanyId(spreadsheetId, companyId) {
    const { fieldToColIndex } = await this._loadHeaders();
    const companyIdColIndex = fieldToColIndex.get('companyId') ?? -1;
    if (companyIdColIndex < 0) return null;

    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: this._sheetName,
    });
    const allRows = res.data.values ?? [];
    for (let i = 1; i < allRows.length; i++) {
      if ((allRows[i]?.[companyIdColIndex] ?? '') === companyId) {
        return i + 1;
      }
    }
    return null;
  }

  /**
   * 全企業行を返す（企業ID が空の行を除く）。
   * check-replies など、送信可否にかかわらず全企業のステータスを参照したい場合に使う。
   * @returns {Promise<Array<Record<string, string> & { _rowIndex: number }>>}
   */
  async getAllCompanies() {
    const spreadsheetId = this._requireSpreadsheetId();
    this._headerCache = null;

    const res = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: this._sheetName,
    });

    const allRows = res.data.values ?? [];
    if (!allRows.length) return [];

    const headers = allRows[0].map(String);
    this._headerCache = this._buildHeaderCache(headers);
    const { fieldToColIndex } = this._headerCache;
    const companyIdColIndex = fieldToColIndex.get('companyId') ?? -1;

    return allRows
      .slice(1)
      .map((row, i) => ({
        ...rowToCompanyByHeaders(row, headers),
        _rowIndex: i + 2,
      }))
      .filter((c) => companyIdColIndex < 0 || (c.companyId ?? '') !== '');
  }

  /**
   * companyId を指定して営業リストの行を更新する。
   * 行番号を知らなくても companyId だけで更新できる公開メソッド。
   * @param {string} companyId  例: 'C000001'
   * @param {Record<string, string | number | null>} values
   * @returns {Promise<object | null>}
   */
  async updateCompanyByCompanyId(companyId, values) {
    const spreadsheetId = this._requireSpreadsheetId();
    const rowIndex = await this._findRowByCompanyId(spreadsheetId, companyId);
    if (rowIndex === null) {
      logger.warn(`[Sheets] companyId ${companyId} が見つかりません`);
      return null;
    }
    return this.updateStatus(rowIndex, values);
  }

  /**
   * 送信可否が「○」の行を取得して返す。
   * 1 行目はヘッダーとして扱い、返り値オブジェクトには _rowIndex（1 始まり行番号）が付与される。
   * @returns {Promise<Array<Record<string, string> & { _rowIndex: number }>>}
   */
  async getApprovedRows() {
    const spreadsheetId = this._requireSpreadsheetId();

    // ヘッダーキャッシュをクリアして常に最新の列構成で読む
    this._headerCache = null;

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
   *
   * @param {number} rowIndex  シートの行番号（1 始まり）
   * @param {Record<string, string | number | null>} values  更新内容
   * @param {{ expectedCompanyId?: string }} [options]
   *   expectedCompanyId を指定すると、更新前に対象行の企業ID を検証する。
   *   ソートなどで行番号がずれていた場合は全行スキャンして正しい行を特定する（T-03 対応）。
   * @returns {Promise<object | null>}
   */
  async updateStatus(rowIndex, values, { expectedCompanyId } = {}) {
    const spreadsheetId = this._requireSpreadsheetId();
    const { fieldToColLetter } = await this._loadHeaders();

    let targetRowIndex = rowIndex;

    if (expectedCompanyId != null) {
      const companyIdColLetter = fieldToColLetter.get('companyId');
      if (companyIdColLetter) {
        const res = await this._api.spreadsheets.values.get({
          spreadsheetId,
          range: `${this._sheetName}!${companyIdColLetter}${rowIndex}`,
        });
        const currentId = String(res.data.values?.[0]?.[0] ?? '');
        if (currentId !== expectedCompanyId) {
          logger.warn(
            `[Sheets] 行 ${rowIndex} が移動しています（期待: ${expectedCompanyId}, 実際: ${currentId}）。再検索します`
          );
          const found = await this._findRowByCompanyId(spreadsheetId, expectedCompanyId);
          if (found === null) {
            logger.warn(`[Sheets] companyId ${expectedCompanyId} が見つかりません`);
            return null;
          }
          targetRowIndex = found;
        }
      }
    }

    const data = Object.entries(values)
      .map(([field, value]) => {
        const colLetter = fieldToColLetter.get(field);
        if (!colLetter) return null;
        return {
          range: `${this._sheetName}!${colLetter}${targetRowIndex}`,
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

    logger.success(`[Sheets] 行 ${targetRowIndex} を更新しました`);
    return response.data;
  }
}
