import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getApprovedRows } from '../../sheets/index.js';
import { createMailer, loadTemplate, renderTemplate } from '../../gmail/index.js';
import { updateStatus } from '../../sheets/index.js';
import { createPersonalizedContent } from '../../personalizer/index.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../../../templates/emails');

/**
 * テンプレートファイル群を読み込む。
 * HTML・件名ファイルが存在しなければ null を返す。
 * @param {string} name  ファイル名（拡張子なし）
 * @returns {{
 *   textTemplate: string,
 *   htmlTemplate: string | null,
 *   subjectTemplate: string | null,
 * }}
 */
function loadEmailTemplates(name) {
  const txtPath = resolve(TEMPLATES_DIR, `${name}.txt`);
  const htmlPath = resolve(TEMPLATES_DIR, `${name}.html`);
  const subjectPath = resolve(TEMPLATES_DIR, `${name}.subject.txt`);
  return {
    textTemplate: loadTemplate(txtPath),
    htmlTemplate: existsSync(htmlPath) ? loadTemplate(htmlPath) : null,
    subjectTemplate: existsSync(subjectPath) ? loadTemplate(subjectPath).trim() : null,
  };
}

/**
 * .env の送信者情報からテキスト署名を生成する。
 * @returns {string}
 */
function buildTextSignature() {
  const parts = ['--'];
  if (env.gmailName) parts.push(env.gmailName);
  if (env.gmailFrom) parts.push(env.gmailFrom);
  return parts.join('\n');
}

/**
 * .env の送信者情報から HTML 署名を生成する。
 * @returns {string}
 */
function buildHtmlSignature() {
  const lines = [];
  if (env.gmailName) lines.push(`<strong>${env.gmailName}</strong>`);
  if (env.gmailFrom) lines.push(`<a href="mailto:${env.gmailFrom}">${env.gmailFrom}</a>`);
  if (!lines.length) return '';
  return `<div style="border-top:1px solid #e0e0e0;margin-top:24px;padding-top:16px;font-size:12px;color:#666;">${lines.join('<br />')}</div>`;
}

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

    if (companies.length === 0) {
      logger.info('送信対象がありません');
      return;
    }

    const { textTemplate, htmlTemplate, subjectTemplate } = loadEmailTemplates('initial_contact');
    const mailer = dryRun ? null : await createMailer();

    for (const company of companies) {
      const { introText } = await createPersonalizedContent(company);
      const vars = {
        companyName: company.companyName,
        contactName: company.contactName || 'ご担当者',
        meetingUrl: env.meetingUrl,
        introText,
      };

      const subject = subjectTemplate
        ? renderTemplate(subjectTemplate, vars)
        : `【ご提案】${company.companyName} 様の営業効率化についてのご相談`;

      const textBody = renderTemplate(textTemplate, vars) + '\n' + buildTextSignature();
      const htmlBody = htmlTemplate
        ? renderTemplate(htmlTemplate, vars).replace('</body>', `${buildHtmlSignature()}</body>`)
        : undefined;

      if (dryRun) {
        logger.warn(`[DRY RUN] To: ${company.email}`);
        logger.warn(`[DRY RUN] Subject: ${subject}`);
        logger.warn(`[DRY RUN] Body:\n${textBody}`);
        continue;
      }

      const { messageId } = await mailer.send({
        to: company.email,
        subject,
        textBody,
        htmlBody,
      });

      await updateStatus(company._rowIndex, {
        sentDate: new Date().toISOString().slice(0, 10),
        status: '送信済',
        sendCount: String((Number(company.sendCount) || 0) + 1),
      });

      logger.success(`送信完了: ${company.companyName} (${company.email}) [${messageId}]`);

      await new Promise((r) => setTimeout(r, env.sendIntervalMs));
    }

    logger.success('送信処理が完了しました');
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
