/**
 * 追記専用の履歴シートを管理する汎用基底クラス。
 *
 * - ensureSheet(): タブが存在しない場合のみ作成してヘッダーを書き込む
 * - appendRow():  1行を末尾に追記する（既存行は一切変更しない）
 *
 * 送信履歴・返信履歴・商談履歴などは本クラスを継承して実装する。
 */
export class HistoryService {
  /**
   * @param {{
   *   sheetsApi: object,
   *   spreadsheetId: string,
   *   sheetName: string,
   *   headers: readonly string[],
   * }} opts
   */
  constructor({ sheetsApi, spreadsheetId, sheetName, headers }) {
    this._api = sheetsApi;
    this._spreadsheetId = spreadsheetId;
    this._sheetName = sheetName;
    this._headers = headers;
    this._initialized = false;
  }

  /**
   * タブが存在しない場合のみ作成してヘッダー行を書き込む。
   * 既にタブが存在する場合は何もしない（ヘッダーを上書きしない）。
   */
  async ensureSheet() {
    if (this._initialized) return;

    const meta = await this._api.spreadsheets.get({
      spreadsheetId: this._spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const exists = (meta.data.sheets ?? []).some((s) => s.properties.title === this._sheetName);

    if (!exists) {
      await this._api.spreadsheets.batchUpdate({
        spreadsheetId: this._spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: this._sheetName } } }],
        },
      });

      await this._api.spreadsheets.values.update({
        spreadsheetId: this._spreadsheetId,
        range: `'${this._sheetName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [this._headers] },
      });
    }

    this._initialized = true;
  }

  /**
   * タブの全データ行を返す（ヘッダー行を除く）。
   * タブが存在しない場合は空配列を返す（エラーにしない）。
   * @returns {Promise<string[][]>}
   */
  async getRows() {
    try {
      const res = await this._api.spreadsheets.values.get({
        spreadsheetId: this._spreadsheetId,
        range: `'${this._sheetName}'!A:ZZ`,
      });
      const allRows = res.data.values ?? [];
      return allRows.length > 1 ? allRows.slice(1) : [];
    } catch {
      return [];
    }
  }

  /**
   * 1行を末尾に追記する。未初期化の場合は ensureSheet() を先に呼ぶ。
   * @param {(string | number)[]} values
   */
  async appendRow(values) {
    if (!this._initialized) await this.ensureSheet();

    await this._api.spreadsheets.values.append({
      spreadsheetId: this._spreadsheetId,
      range: `'${this._sheetName}'!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  }
}
