import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { createAuth } from './auth.js';
import { HistoryService } from './history-service.js';
import { env } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

/** Sales Pilot のバージョン文字列（package.json から取得）。 */
export const APP_VERSION = `v${version}`;

/** 送信履歴タブ名。 */
export const SEND_HISTORY_SHEET = '送信履歴';

/** 送信履歴タブのヘッダー列（14列）。 */
export const SEND_HISTORY_HEADERS = Object.freeze([
  '送信日時',
  'Batch ID',
  '企業ID',
  'Place ID',
  '会社名',
  'メールアドレス',
  '件名',
  'Message ID',
  '送信結果',
  'エラー内容',
  '送信者',
  'Template Name',
  'Scenario Name',
  'Sales Pilot Version',
]);

/**
 * 送信結果の定数。
 * @readonly
 * @enum {string}
 */
export const SEND_RESULT = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

/**
 * 1回の send コマンド実行を識別する Batch ID を生成する。
 * 形式: YYYYMMDDHHmmss-XXXX（タイムスタンプ + ランダム4文字英数字）
 * @returns {string}
 */
export function generateBatchId() {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${ts}-${rand}`;
}

/**
 * 送信履歴を管理するサービス。
 * HistoryService を継承し、send コマンドの送信結果（SUCCESS / FAILED / SKIPPED）を
 * 「送信履歴」タブへ追記する。
 */
export class SendHistoryService extends HistoryService {
  /** @param {{ sheetsApi: object, spreadsheetId: string }} opts */
  constructor({ sheetsApi, spreadsheetId }) {
    super({
      sheetsApi,
      spreadsheetId,
      sheetName: SEND_HISTORY_SHEET,
      headers: SEND_HISTORY_HEADERS,
    });
  }

  /**
   * 1件の送信イベントを履歴に追記する。
   *
   * @param {{
   *   sentAt: string,            ISO 8601 タイムスタンプ
   *   batchId: string,           実行バッチID
   *   company: object,           Company オブジェクト
   *   subject: string,           件名（SKIPPED の場合は空文字）
   *   messageId: string,         Gmail Message ID（SKIPPED/FAILED は空文字）
   *   result: string,            SEND_RESULT の値
   *   error?: string,            エラー内容またはスキップ理由
   *   sender: string,            送信者メールアドレス
   *   templateName: string,      使用テンプレート名
   *   scenarioName: string,      シナリオ名
   *   appVersion?: string,       Sales Pilot Version（省略時は APP_VERSION）
   * }} record
   */
  async log({
    sentAt,
    batchId,
    company,
    subject,
    messageId,
    result,
    error = '',
    sender,
    templateName,
    scenarioName,
    appVersion = APP_VERSION,
  }) {
    await this.appendRow([
      sentAt,
      batchId,
      company.companyId ?? '',
      company.placeId ?? '',
      company.companyName ?? '',
      company.email ?? '',
      subject,
      messageId,
      result,
      error,
      sender,
      templateName,
      scenarioName,
      appVersion,
    ]);
  }
}

/**
 * 認証済みの SendHistoryService インスタンスを生成する。
 * @returns {Promise<SendHistoryService>}
 */
export async function createSendHistoryService() {
  const auth = await createAuth();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  return new SendHistoryService({
    sheetsApi,
    spreadsheetId: env.spreadsheetId,
  });
}
