import { findCompanies } from '../../crawler/find.js';
import { logger } from '../../utils/logger.js';

/**
 * @param {{
 *   industry: string,
 *   area: string,
 *   limit: string,
 *   skipAnalyzer: boolean,
 *   dryRun: boolean,
 * }} options
 */
export async function findCommand(options) {
  const limit = parseInt(options.limit, 10);
  if (isNaN(limit) || limit <= 0) {
    logger.error('--limit は正の整数を指定してください');
    process.exit(1);
  }

  try {
    const companies = await findCompanies(options.industry, options.area, {
      limit,
      skipAnalyzer: options.skipAnalyzer,
      skipSheets: options.dryRun,
    });
    logger.success(`${companies.length} 件の企業情報を取得しました`);
  } catch (err) {
    logger.error(`エラーが発生しました: ${err.message}`);
    process.exit(1);
  }
}
