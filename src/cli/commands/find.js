import { findCompanies } from '../../crawler/find.js';
import { appendCompanies } from '../../sheets/index.js';
import { promptFindOptions, confirmFindExecution } from '../prompts.js';
import { reviewCompanies, promptReviewDecision, printReviewSummary } from './find-review.js';
import { logger } from '../../utils/logger.js';

/**
 * @param {{
 *   industry?: string,
 *   area?: string,
 *   limit: string,
 *   skipAnalyzer: boolean,
 *   dryRun: boolean,
 *   yes: boolean,
 *   review?: boolean,
 * }} options
 */
export async function findCommand(options) {
  let { industry, area, limit: limitStr, skipAnalyzer, dryRun, yes, review = false } = options;

  // --industry / --area が未指定のときは対話形式で補完する
  if (!industry || !area) {
    const defaultLimit = parseInt(limitStr, 10) || 20;
    const answers = await promptFindOptions({
      defaultIndustry: industry || '',
      defaultArea: area || '',
      defaultLimit,
    });
    industry = answers.industry;
    area = answers.area;
    limitStr = String(answers.limit);
  }

  const limit = parseInt(limitStr, 10);
  if (isNaN(limit) || limit <= 0) {
    logger.error('--limit は正の整数を指定してください');
    process.exit(1);
  }

  // 最終確認（--yes/-y 指定時はスキップ）
  if (!yes) {
    const confirmed = await confirmFindExecution(industry, area, limit, { skipSheets: dryRun });
    if (!confirmed) {
      logger.info('キャンセルしました');
      return;
    }
  }

  try {
    // --review 時は findCompanies() 内での自動保存を止め、レビュー後に承認分だけ保存する
    const companies = await findCompanies(industry, area, {
      limit,
      skipAnalyzer,
      skipSheets: dryRun || review,
    });

    if (review) {
      const { approved, skippedCount, remainingCount } = await reviewCompanies(
        companies,
        promptReviewDecision
      );

      let addedCount = 0;
      let mergedCount = 0;
      if (approved.length > 0 && !dryRun) {
        const result = await appendCompanies(approved);
        addedCount = result?.appended ?? 0;
        mergedCount = result?.merged ?? 0;
      }

      printReviewSummary({ addedCount, mergedCount, skippedCount, remainingCount });
      return;
    }

    logger.success(`${companies.length} 件の企業情報を取得しました`);
  } catch (err) {
    logger.error(`エラーが発生しました: ${err.message}`);
    process.exit(1);
  }
}
