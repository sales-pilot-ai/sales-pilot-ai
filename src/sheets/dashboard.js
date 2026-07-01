import { google } from 'googleapis';
import { SEND_STATUS } from '../constants/index.js';
import { APPROVAL_VALUE, HEADER_TO_FIELD, colIndexToLetter } from './mapper.js';
import { createAuth } from './auth.js';
import { logger } from '../utils/logger.js';

export const DASHBOARD_SHEET = '営業ダッシュボード';

const SECTION_WIDTH = 8;

/** ダッシュボードの各セクションに表示する 8列 */
export const DASHBOARD_COLUMNS = Object.freeze([
  { field: 'companyName', header: '会社名' },
  { field: 'email', header: 'メールアドレス' },
  { field: 'phone', header: '電話番号' },
  { field: 'status', header: '送信状況' },
  { field: 'sentDate', header: '送信日' },
  { field: 'hasReply', header: '返信有無' },
  { field: 'meetingDate', header: '商談日' },
  { field: 'memo', header: 'メモ' },
]);

// ── 純粋関数: FILTER 数式ビルダー ─────────────────────────────────────────

/**
 * 指定列選択 + 条件の FILTER 数式を組み立てる。
 * @param {string} listSheet
 * @param {Map<string,string>} fieldToColLetter
 * @param {string} condition
 * @returns {string}
 */
function buildFilterFormula(listSheet, fieldToColLetter, condition) {
  // 存在しないフィールドはシート範囲外列（AY = index 50）を参照 → 空値になる
  const emptyCol = colIndexToLetter(50);
  const cols = DASHBOARD_COLUMNS.map(({ field }) => {
    const col = fieldToColLetter.get(field) ?? emptyCol;
    return `'${listSheet}'!${col}2:${col}`;
  });
  const fallback = Array(DASHBOARD_COLUMNS.length).fill('""');
  fallback[0] = '"(該当なし)"';
  return `=IFERROR(FILTER({${cols.join(',')}},${condition}),{${fallback.join(',')}})`;
}

/** 「返信あり」セクションの FILTER 数式 */
export function buildRepliedFormula(listSheet, fieldToColLetter) {
  // 列が存在しない場合は常に空の列 (AY) を参照 → 条件が常に FALSE → (該当なし) を表示
  const statusCol = fieldToColLetter.get('status') ?? colIndexToLetter(50);
  const cond = `'${listSheet}'!${statusCol}2:${statusCol}="${SEND_STATUS.REPLIED}"`;
  return buildFilterFormula(listSheet, fieldToColLetter, cond);
}

/** 「送信待ち」セクションの FILTER 数式 */
export function buildWaitingFormula(listSheet, fieldToColLetter) {
  const statusCol = fieldToColLetter.get('status') ?? colIndexToLetter(50);
  const approvalCol = fieldToColLetter.get('sendApproval') ?? colIndexToLetter(50);
  const cond =
    `('${listSheet}'!${approvalCol}2:${approvalCol}="${APPROVAL_VALUE}")*` +
    `(('${listSheet}'!${statusCol}2:${statusCol}="")+` +
    `('${listSheet}'!${statusCol}2:${statusCol}="${SEND_STATUS.NOT_SENT}")+` +
    `('${listSheet}'!${statusCol}2:${statusCol}="${SEND_STATUS.FAILED}"))`;
  return buildFilterFormula(listSheet, fieldToColLetter, cond);
}

/** 「商談中」セクションの FILTER 数式 */
export function buildMeetingFormula(listSheet, fieldToColLetter) {
  // 商談日列がまだ存在しない場合は空列を参照 → 0件表示
  const meetingDateCol = fieldToColLetter.get('meetingDate') ?? colIndexToLetter(50);
  const cond = `'${listSheet}'!${meetingDateCol}2:${meetingDateCol}<>""`;
  return buildFilterFormula(listSheet, fieldToColLetter, cond);
}

// ── 純粋関数: 件数付きタイトル数式ビルダー ───────────────────────────────

/** 「返信あり（N件）」タイトル数式 */
export function buildRepliedTitleFormula(listSheet, fieldToColLetter) {
  const statusCol = fieldToColLetter.get('status') ?? colIndexToLetter(50);
  return (
    `="返信あり（"&COUNTIF('${listSheet}'!${statusCol}2:${statusCol},` +
    `"${SEND_STATUS.REPLIED}")&"件）"`
  );
}

/** 「送信待ち（N件）」タイトル数式 */
export function buildWaitingTitleFormula(listSheet, fieldToColLetter) {
  const statusCol = fieldToColLetter.get('status') ?? colIndexToLetter(50);
  const approvalCol = fieldToColLetter.get('sendApproval') ?? colIndexToLetter(50);
  return (
    `="送信待ち（"&SUMPRODUCT(('${listSheet}'!${approvalCol}2:${approvalCol}="${APPROVAL_VALUE}")*` +
    `ISNUMBER(MATCH('${listSheet}'!${statusCol}2:${statusCol},` +
    `{"","${SEND_STATUS.NOT_SENT}","${SEND_STATUS.FAILED}"},0)))&"件）"`
  );
}

/** 「商談中（N件）」タイトル数式 */
export function buildMeetingTitleFormula(listSheet, fieldToColLetter) {
  const meetingDateCol = fieldToColLetter.get('meetingDate') ?? colIndexToLetter(50);
  return `="商談中（"&COUNTA('${listSheet}'!${meetingDateCol}2:${meetingDateCol})&"件）"`;
}

// ── DashboardService ──────────────────────────────────────────────────────

export class DashboardService {
  /**
   * @param {{
   *   sheetsApi: object,
   *   spreadsheetId?: string,
   *   listSheetName?: string,
   * }} options
   */
  constructor({ sheetsApi, spreadsheetId, listSheetName } = {}) {
    if (!sheetsApi) throw new Error('sheetsApi は必須です');
    this._api = sheetsApi;
    this._spreadsheetId = spreadsheetId ?? process.env.SPREADSHEET_ID ?? '';
    this._listSheetName = listSheetName ?? (process.env.SHEET_NAME || '営業リスト');
  }

  /**
   * 営業ダッシュボードタブを生成/上書きする。
   * 既存タブがある場合は内容をクリアしてから書き直す（冪等）。
   */
  async createOrUpdateDashboard() {
    const spreadsheetId = this._spreadsheetId;
    if (!spreadsheetId) throw new Error('SPREADSHEET_ID が設定されていません');

    // 1. 営業リストのヘッダー行を読んでフィールド→列文字マップを作成
    const headerRes = await this._api.spreadsheets.values.get({
      spreadsheetId,
      range: `'${this._listSheetName}'!1:1`,
    });
    const headers = (headerRes.data.values ?? [[]])[0] ?? [];
    const fieldToColLetter = new Map();
    headers.forEach((h, i) => {
      const field = HEADER_TO_FIELD[h];
      if (field) fieldToColLetter.set(field, colIndexToLetter(i));
    });

    // 2. ダッシュボードタブを確保（存在: クリア / 不存在: 新規作成）
    await this._ensureDashboardTab(spreadsheetId);

    // 3. セクション定義
    const listSheet = this._listSheetName;
    const sections = [
      {
        titleFormula: buildRepliedTitleFormula(listSheet, fieldToColLetter),
        filterFormula: buildRepliedFormula(listSheet, fieldToColLetter),
      },
      {
        titleFormula: buildWaitingTitleFormula(listSheet, fieldToColLetter),
        filterFormula: buildWaitingFormula(listSheet, fieldToColLetter),
      },
      {
        titleFormula: buildMeetingTitleFormula(listSheet, fieldToColLetter),
        filterFormula: buildMeetingFormula(listSheet, fieldToColLetter),
      },
    ];

    // 4. 書き込みデータを組み立て
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const columnHeaders = DASHBOARD_COLUMNS.map((c) => c.header);
    const data = [
      { range: `'${DASHBOARD_SHEET}'!A1`, values: [['営業ダッシュボード']] },
      { range: `'${DASHBOARD_SHEET}'!A2`, values: [[`最終更新: ${now}`]] },
    ];

    for (let i = 0; i < sections.length; i++) {
      const startIdx = i * SECTION_WIDTH;
      const startLetter = colIndexToLetter(startIdx);
      const endLetter = colIndexToLetter(startIdx + SECTION_WIDTH - 1);
      const s = sections[i];

      // Row 4: セクションタイトル（件数付き数式）
      data.push({ range: `'${DASHBOARD_SHEET}'!${startLetter}4`, values: [[s.titleFormula]] });
      // Row 5: 列ヘッダー
      data.push({
        range: `'${DASHBOARD_SHEET}'!${startLetter}5:${endLetter}5`,
        values: [columnHeaders],
      });
      // Row 6: FILTER 数式
      data.push({ range: `'${DASHBOARD_SHEET}'!${startLetter}6`, values: [[s.filterFormula]] });
    }

    await this._api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });

    logger.info('[Dashboard] 営業ダッシュボードを更新しました');
  }

  async _ensureDashboardTab(spreadsheetId) {
    const meta = await this._api.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const exists = (meta.data.sheets ?? []).some((s) => s.properties.title === DASHBOARD_SHEET);

    if (exists) {
      await this._api.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${DASHBOARD_SHEET}'`,
      });
    } else {
      await this._api.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: DASHBOARD_SHEET } } }],
        },
      });
    }
  }
}

export async function createDashboardService() {
  const auth = await createAuth();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  return new DashboardService({ sheetsApi });
}
