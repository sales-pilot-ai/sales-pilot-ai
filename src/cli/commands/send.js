import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getApprovedRows, updateStatus } from '../../sheets/index.js';
import { createMailer, loadTemplate, renderTemplate } from '../../gmail/index.js';
import { createPersonalizedContent } from '../../personalizer/index.js';
import { shouldSkip } from './send-filter.js';
import { SEND_STATUS } from '../../constants/index.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../../../templates/emails');

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

function buildTextSignature() {
  const parts = ['--'];
  if (env.gmailName) parts.push(env.gmailName);
  if (env.gmailFrom) parts.push(env.gmailFrom);
  return parts.join('\n');
}

function buildHtmlSignature() {
  const lines = [];
  if (env.gmailName) lines.push(`<strong>${env.gmailName}</strong>`);
  if (env.gmailFrom) lines.push(`<a href="mailto:${env.gmailFrom}">${env.gmailFrom}</a>`);
  if (!lines.length) return '';
  return `<div style="border-top:1px solid #e0e0e0;margin-top:24px;padding-top:16px;font-size:12px;color:#666;">${lines.join('<br />')}</div>`;
}

/**
 * @param {{ dryRun?: boolean, force?: boolean }} options
 */
export async function sendCommand(options) {
  const dryRun = options.dryRun ?? env.isDryRun;
  const force = options.force ?? false;

  if (dryRun) logger.warn('DRY RUNモード: メールは実際には送信されません');
  if (force) logger.warn('--force モード: 送信済企業にも送信します');

  const counts = { sent: 0, skipped: 0, failed: 0 };

  try {
    const companies = await getApprovedRows();
    logger.info(`送信可否○の企業: ${companies.length}件`);

    if (companies.length === 0) {
      logger.info('送信対象がありません');
      return;
    }

    const { textTemplate, htmlTemplate, subjectTemplate } = loadEmailTemplates('initial_contact');
    const mailer = dryRun ? null : await createMailer();

    for (const company of companies) {
      const { skip, reason } = shouldSkip(company, { force });

      if (skip) {
        logger.info(`[スキップ] ${company.companyName} (${reason})`);
        counts.skipped++;
        continue;
      }

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
        counts.sent++;
        continue;
      }

      try {
        const { messageId } = await mailer.send({
          to: company.email,
          subject,
          textBody,
          htmlBody,
        });

        await updateStatus(company._rowIndex, {
          sentDate: new Date().toISOString().slice(0, 10),
          status: SEND_STATUS.SENT,
          sendCount: String((Number(company.sendCount) || 0) + 1),
        });

        logger.success(`送信完了: ${company.companyName} (${company.email}) [${messageId}]`);
        counts.sent++;
      } catch (err) {
        logger.error(`送信失敗: ${company.companyName} (${company.email}): ${err.message}`);
        await updateStatus(company._rowIndex, { status: SEND_STATUS.FAILED }).catch(() => {});
        counts.failed++;
      }

      await new Promise((r) => setTimeout(r, env.sendIntervalMs));
    }
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  logger.info(
    `完了 — 送信: ${counts.sent}件  スキップ: ${counts.skipped}件  失敗: ${counts.failed}件`
  );
}
