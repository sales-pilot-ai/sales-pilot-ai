import { findCompanies } from '../../crawler/find.js';
import { promptFindOptions } from '../prompts.js';
import { logger } from '../../utils/logger.js';

/**
 * @param {{
 *   industry?: string,
 *   area?: string,
 *   limit: string,
 *   skipAnalyzer: boolean,
 *   dryRun: boolean,
 * }} options
 */
export async function findCommand(options) {
  let { industry, area, limit: limitStr, skipAnalyzer, dryRun } = options;

  // --industry / --area が未指定のときは対話形式で補完する
  if (!industry || !area) {
    const defaultLimit = parseInt(limitStr, 10) || 20;
    const answers = await promptFindOptions({
      defaultIndustry: industry || '',
      defaultArea: area || '',
      defaultLimit,
    });
    if (!answers.confirmed) {
      logger.info('キャンセルしました');
      return;
    }
    industry = answers.industry;
    area = answers.area;
    limitStr = String(answers.limit);
  }

  const limit = parseInt(limitStr, 10);
  if (isNaN(limit) || limit <= 0) {
    logger.error('--limit は正の整数を指定してください');
    process.exit(1);
  }

  try {
    const companies = await findCompanies(industry, area, {
      limit,
      skipAnalyzer,
      skipSheets: dryRun,
    });
    logger.success(`${companies.length} 件の企業情報を取得しました`);
  } catch (err) {
    logger.error(`エラーが発生しました: ${err.message}`);
    process.exit(1);
  }
}
