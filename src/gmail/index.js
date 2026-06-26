import { logger } from '../utils/logger.js';

/**
 * @typedef {Object} MailOptions
 * @property {string} to
 * @property {string} subject
 * @property {string} body
 * @property {boolean} [dryRun]
 */

/**
 * メールを1件送信する
 * @param {MailOptions} options
 */
export async function sendMail({ to, subject, body, dryRun = false }) {
  if (dryRun) {
    logger.warn(`[DRY RUN] To: ${to}`);
    logger.warn(`[DRY RUN] Subject: ${subject}`);
    logger.warn(`[DRY RUN] Body:\n${body}`);
    return;
  }

  logger.step(`送信中: ${to}`);

  // TODO: Gmail API で実装予定
  throw new Error('Gmail送信は未実装です。Phase 3 で実装予定。');
}
