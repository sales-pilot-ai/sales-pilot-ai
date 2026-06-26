import { getApprovedRows } from '../../sheets/index.js';
import { sendMail } from '../../gmail/index.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(__dirname, '../../../templates/emails/initial_contact.txt');

/**
 * @param {{ dryRun?: boolean }} options
 */
export async function sendCommand(options) {
  const dryRun = options.dryRun ?? env.isDryRun;

  if (dryRun) {
    logger.warn('DRY RUNモード: メールは実際には送信されません');
  }

  try {
    const companies = await getApprovedRows();
    logger.info(`送信対象: ${companies.length}件`);

    const template = readFileSync(templatePath, 'utf-8');

    for (const company of companies) {
      const body = template
        .replace('{{companyName}}', company.companyName)
        .replace('{{contactPerson}}', company.contactPerson || 'ご担当者');

      await sendMail({
        to: company.email,
        subject: `【ご提案】Sales Pilot AI のご紹介`,
        body,
        dryRun,
      });

      if (!dryRun) {
        await new Promise((r) => setTimeout(r, env.sendIntervalMs));
      }
    }

    logger.success('送信処理が完了しました');
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
