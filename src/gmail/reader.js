import { google } from 'googleapis';
import { createAuth } from '../sheets/auth.js';
import { env } from '../config/index.js';

/**
 * Gmail API を使ってスレッドを読み取り、返信メッセージを検出するクラス。
 *
 * @example
 *   const reader = await createGmailReader();
 *   const replies = await reader.findReplies(messageId);
 */
export class GmailReader {
  /**
   * @param {{ gmailApi: object, senderEmail?: string }} opts
   */
  constructor({ gmailApi, senderEmail } = {}) {
    if (!gmailApi) throw new Error('gmailApi は必須です');
    this._api = gmailApi;
    this._senderEmail = senderEmail ?? '';
  }

  /**
   * Gmail Message ID から Thread ID を取得する。
   * @param {string} messageId
   * @returns {Promise<string>}
   */
  async getThreadId(messageId) {
    const res = await this._api.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'minimal',
    });
    return res.data.threadId;
  }

  /**
   * Thread ID からスレッド内の全メッセージを取得する。
   * @param {string} threadId
   * @returns {Promise<object[]>}
   */
  async getThreadMessages(threadId) {
    const res = await this._api.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From', 'Date', 'Subject'],
    });
    return res.data.messages ?? [];
  }

  /**
   * 指定メッセージへの返信（第三者からのメッセージ）を返す。
   *
   * - 送信元メッセージ自身（messageId と一致）は除外
   * - senderEmail を含む From ヘッダーのメッセージは除外（自分の返信）
   *
   * @param {string} messageId  送信済みメッセージの Gmail ID
   * @returns {Promise<Array<{
   *   messageId: string,
   *   threadId: string,
   *   fromEmail: string,
   *   repliedAt: string,
   *   subject: string,
   *   snippet: string,
   * }>>}
   */
  async findReplies(messageId) {
    const threadId = await this.getThreadId(messageId);
    const messages = await this.getThreadMessages(threadId);

    const replies = [];
    for (const msg of messages) {
      if (msg.id === messageId) continue;

      const headers = msg.payload?.headers ?? [];
      const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      const fromHeader = getHeader('From');
      if (this._senderEmail && fromHeader.includes(this._senderEmail)) continue;

      const internalDate = Number(msg.internalDate ?? 0);
      replies.push({
        messageId: msg.id,
        threadId,
        fromEmail: fromHeader,
        repliedAt: internalDate ? new Date(internalDate).toISOString() : getHeader('Date'),
        subject: getHeader('Subject'),
        snippet: (msg.snippet ?? '').slice(0, 200),
      });
    }

    return replies;
  }
}

/**
 * 認証済みの GmailReader インスタンスを生成する。
 * @returns {Promise<GmailReader>}
 */
export async function createGmailReader() {
  const auth = await createAuth();
  const gmailApi = google.gmail({ version: 'v1', auth });
  return new GmailReader({ gmailApi, senderEmail: env.gmailFrom });
}
