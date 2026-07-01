import { google } from 'googleapis';
import { createAuth } from '../sheets/auth.js';
import { GmailMailer } from './mailer.js';

export { GmailMailer };
export { GmailReader, createGmailReader } from './reader.js';
export { loadTemplate, renderTemplate, renderTemplateFile } from './template.js';

/**
 * 認証済みの GmailMailer インスタンスを生成する。
 *
 * テストでは googleapis を経由せず、GmailMailer に直接 mock gmailApi を注入すること:
 *   new GmailMailer({ gmailApi: mockApi, from: 'from@example.com' })
 *
 * @returns {Promise<GmailMailer>}
 */
export async function createMailer() {
  const auth = await createAuth();
  const gmailApi = google.gmail({ version: 'v1', auth });
  return new GmailMailer({ gmailApi });
}

/**
 * メールを 1 件送信する（後方互換 / CLI コマンドから直接呼べる形式）。
 *
 * @param {{
 *   to: string,
 *   subject: string,
 *   body?: string,
 *   htmlBody?: string,
 *   attachments?: Array<{ filename: string, mimeType: string, data: Buffer | string }>,
 *   dryRun?: boolean,
 * }} options
 * @returns {Promise<{ messageId: string | null, dryRun?: boolean }>}
 */
export async function sendMail({ to, subject, body, htmlBody, attachments, dryRun = false }) {
  const mailer = await createMailer();
  return mailer.send({ to, subject, textBody: body, htmlBody, attachments, dryRun });
}
