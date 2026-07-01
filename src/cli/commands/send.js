import { getApprovedRows, updateStatus } from '../../sheets/index.js';
import { createMailer } from '../../gmail/index.js';
import { loadEmailTemplates, buildEmailContent } from './email-builder.js';
import { shouldSkip } from './send-filter.js';
import { runPreview } from './send-preview.js';
import { SEND_STATUS } from '../../constants/index.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * @param {{ dryRun?: boolean, force?: boolean, preview?: boolean }} options
 */
export async function sendCommand(options) {
  const dryRun = options.dryRun ?? env.isDryRun;
  const force = options.force ?? false;
  const preview = options.preview ?? false;

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

    const templates = loadEmailTemplates('initial_contact');

    if (preview) {
      const confirmed = await runPreview(companies, templates, { force });
      if (!confirmed) {
        logger.info('送信をキャンセルしました');
        return;
      }
      console.log('');
    }

    const mailer = dryRun ? null : await createMailer();

    for (const company of companies) {
      const { skip, reason } = shouldSkip(company, { force });

      if (skip) {
        logger.info(`[スキップ] ${company.companyName} (${reason})`);
        counts.skipped++;
        continue;
      }

      const { subject, textBody, htmlBody } = await buildEmailContent(company, templates);

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

        await updateStatus(
          company._rowIndex,
          {
            sentDate: new Date().toISOString().slice(0, 10),
            status: SEND_STATUS.SENT,
            sendCount: String((Number(company.sendCount) || 0) + 1),
          },
          { expectedCompanyId: company.companyId }
        );

        logger.success(`送信完了: ${company.companyName} (${company.email}) [${messageId}]`);
        counts.sent++;
      } catch (err) {
        logger.error(`送信失敗: ${company.companyName} (${company.email}): ${err.message}`);
        await updateStatus(
          company._rowIndex,
          { status: SEND_STATUS.FAILED },
          { expectedCompanyId: company.companyId }
        ).catch((e) => logger.warn(`[Sheets] ステータス更新失敗: ${e.message}`));
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
