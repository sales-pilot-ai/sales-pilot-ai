import { logger } from '../utils/logger.js';
import { buildMimeMessage, encodeMimeMessage } from './mime.js';

/**
 * Gmail API を使ってメールを送信するクラス。
 *
 * gmailApi をコンストラクタで注入することで、
 * テスト時は googleapis を一切モックせずに動作を検証できる。
 *
 * @example 本番
 *   import { createMailer } from './index.js';
 *   const mailer = await createMailer();
 *   const { messageId } = await mailer.send({ to, subject, textBody, htmlBody });
 *
 * @example テスト
 *   const mockApi = { users: { messages: { send: vi.fn() } } };
 *   const mailer = new GmailMailer({ gmailApi: mockApi, from: 'from@example.com' });
 */
export class GmailMailer {
  /**
   * @param {{
   *   gmailApi: object,
   *   from?: string,
   * }} options
   */
  constructor({ gmailApi, from } = {}) {
    if (!gmailApi) throw new Error('gmailApi は必須です');
    this._api = gmailApi;
    this._from = from ?? process.env.GMAIL_FROM ?? '';
  }

  /**
   * メールを送信する。
   *
   * @param {{
   *   to: string,
   *   subject: string,
   *   textBody?: string,
   *   htmlBody?: string,
   *   attachments?: Array<{ filename: string, mimeType: string, data: Buffer | string }>,
   *   dryRun?: boolean,
   * }} options
   * @returns {Promise<{ messageId: string | null, dryRun?: boolean }>}
   */
  async send({ to, subject, textBody = '', htmlBody = '', attachments = [], dryRun = false }) {
    if (dryRun) {
      logger.warn(`[DRY RUN] To: ${to}`);
      logger.warn(`[DRY RUN] Subject: ${subject}`);
      if (textBody) logger.warn(`[DRY RUN] Body (text):\n${textBody}`);
      if (htmlBody) logger.warn(`[DRY RUN] Body (html): <省略>`);
      if (attachments.length > 0) {
        logger.warn(`[DRY RUN] 添付: ${attachments.map((a) => a.filename).join(', ')}`);
      }
      return { messageId: null, dryRun: true };
    }

    if (!this._from) {
      throw new Error('GMAIL_FROM が .env に設定されていません');
    }

    const mimeMessage = buildMimeMessage({
      from: this._from,
      to,
      subject,
      textBody,
      htmlBody,
      attachments,
    });

    const response = await this._api.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodeMimeMessage(mimeMessage) },
    });

    const messageId = response.data.id;
    logger.success(`[Gmail] 送信完了: ${to} (messageId: ${messageId})`);
    return { messageId };
  }
}
