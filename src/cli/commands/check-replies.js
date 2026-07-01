import {
  createSheetsService,
  createSendHistoryService,
  createReplyHistoryService,
  createDashboardService,
} from '../../sheets/index.js';
import { createGmailReader } from '../../gmail/index.js';
import { SEND_STATUS } from '../../constants/index.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Gmail スレッドを確認して返信を検知し、営業リストと返信履歴を更新するコマンド。
 *
 * @param {{ dryRun?: boolean }} [options]
 */
export async function checkRepliesCommand(options = {}) {
  const dryRun = options.dryRun ?? env.isDryRun;

  if (dryRun) logger.warn('DRY RUNモード: Gmail API は呼び出しません');

  try {
    // 1. 送信履歴から SUCCESS 行を読む
    const sendHistory = await createSendHistoryService();
    const successRows = await sendHistory.getSuccessRows();

    if (!successRows.length) {
      logger.info('[check-replies] 送信済みレコードがありません');
      return;
    }

    // 2. 企業ごとに最新の送信を特定（sentAt の降順でソート後、companyId で重複排除）
    const sorted = [...successRows].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const latestByCompany = new Map();
    for (const row of sorted) {
      if (!latestByCompany.has(row.companyId)) {
        latestByCompany.set(row.companyId, row);
      }
    }

    // 3. 営業リストから全企業のステータスを読む
    const sheetsService = await createSheetsService();
    const allCompanies = await sheetsService.getAllCompanies();
    const statusMap = new Map(allCompanies.map((c) => [c.companyId, c.status ?? '']));

    // 4. 返信あり以外の企業のみ対象
    const targets = Array.from(latestByCompany.values()).filter(
      (row) => statusMap.get(row.companyId) !== SEND_STATUS.REPLIED
    );

    logger.info(
      `[check-replies] 確認対象: ${targets.length}件 / 送信済合計: ${latestByCompany.size}件`
    );

    if (!targets.length) {
      logger.info('[check-replies] 確認対象の企業がありません');
      return;
    }

    if (dryRun) {
      for (const t of targets) {
        logger.info(`[DRY RUN] ${t.companyName} (messageId: ${t.messageId}) を確認予定`);
      }
      return;
    }

    // 5. Gmail / 返信履歴を初期化
    const gmailReader = await createGmailReader();
    const replyHistory = await createReplyHistoryService();
    await replyHistory.ensureSheet();

    const detectedAt = new Date().toISOString();
    let replyCount = 0;

    for (const target of targets) {
      let replies;
      try {
        replies = await gmailReader.findReplies(target.messageId);
      } catch (e) {
        logger.warn(`[check-replies] ${target.companyName}: Gmail エラー: ${e.message}`);
        continue;
      }

      if (!replies.length) continue;

      replyCount++;
      logger.success(`[check-replies] 返信あり: ${target.companyName} (${replies.length}件)`);

      // 6. 営業リストを「返信あり」に更新
      await sheetsService
        .updateCompanyByCompanyId(target.companyId, {
          status: SEND_STATUS.REPLIED,
          hasReply: '○',
        })
        .catch((e) => logger.warn(`[check-replies] 営業リスト更新失敗: ${e.message}`));

      // 7. 返信履歴に追記（複数返信がある場合はすべて記録）
      for (const reply of replies) {
        await replyHistory
          .log({
            detectedAt,
            company: target,
            sentMessageId: target.messageId,
            replyMessageId: reply.messageId,
            repliedAt: reply.repliedAt,
            fromEmail: reply.fromEmail,
            subject: reply.subject,
            snippet: reply.snippet,
          })
          .catch((e) => logger.warn(`[check-replies] 返信履歴書込失敗: ${e.message}`));
      }
    }

    logger.success(`[check-replies] 完了: ${replyCount}件の返信を検知しました`);

    // 8. 営業ダッシュボードを更新（失敗しても check-replies 本体には影響しない）
    try {
      const dashboardService = await createDashboardService();
      await dashboardService.createOrUpdateDashboard();
    } catch (e) {
      logger.warn(`[check-replies] ダッシュボードの更新をスキップしました: ${e.message}`);
    }
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
