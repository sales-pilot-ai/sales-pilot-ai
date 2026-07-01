import { google } from 'googleapis';
import { createAuth } from './auth.js';
import { HistoryService } from './history-service.js';
import { env } from '../config/index.js';

/** 返信履歴タブ名。 */
export const REPLY_HISTORY_SHEET = '返信履歴';

/** 返信履歴タブのヘッダー列（12列）。 */
export const REPLY_HISTORY_HEADERS = Object.freeze([
  '検知日時',
  '企業ID',
  'Place ID',
  '会社名',
  'メールアドレス',
  '送信 Message ID',
  '返信 Message ID',
  '返信日時',
  '返信者',
  '件名',
  '内容概要',
  '返信要約',
]);

/**
 * 返信履歴を管理するサービス。
 * HistoryService を継承し、check-replies コマンドで検出した返信を
 * 「返信履歴」タブへ追記する。
 *
 * 「返信要約」列は現在空文字で保存し、将来 Claude API による自動要約を格納する。
 */
export class ReplyHistoryService extends HistoryService {
  /** @param {{ sheetsApi: object, spreadsheetId: string }} opts */
  constructor({ sheetsApi, spreadsheetId }) {
    super({
      sheetsApi,
      spreadsheetId,
      sheetName: REPLY_HISTORY_SHEET,
      headers: REPLY_HISTORY_HEADERS,
    });
  }

  /**
   * 1件の返信イベントを履歴に追記する。
   *
   * @param {{
   *   detectedAt: string,      ISO 8601 タイムスタンプ（check-replies 実行時刻）
   *   company: object,         Company オブジェクト
   *   sentMessageId: string,   送信済み Gmail Message ID
   *   replyMessageId: string,  返信メールの Gmail Message ID
   *   repliedAt: string,       返信日時（ISO 8601）
   *   fromEmail: string,       返信者のメールアドレス
   *   subject: string,         返信件名
   *   snippet: string,         本文概要（200文字以内）
   *   replySummary?: string,   返信要約（将来 Claude API で生成）
   * }} record
   */
  async log({
    detectedAt,
    company,
    sentMessageId,
    replyMessageId,
    repliedAt,
    fromEmail,
    subject,
    snippet,
    replySummary = '',
  }) {
    await this.appendRow([
      detectedAt,
      company.companyId ?? '',
      company.placeId ?? '',
      company.companyName ?? '',
      company.email ?? '',
      sentMessageId,
      replyMessageId,
      repliedAt,
      fromEmail,
      subject,
      snippet,
      replySummary,
    ]);
  }
}

/**
 * 認証済みの ReplyHistoryService インスタンスを生成する。
 * @returns {Promise<ReplyHistoryService>}
 */
export async function createReplyHistoryService() {
  const auth = await createAuth();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  return new ReplyHistoryService({
    sheetsApi,
    spreadsheetId: env.spreadsheetId,
  });
}
