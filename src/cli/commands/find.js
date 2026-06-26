import { findCompanies } from '../../crawler/index.js';
import { appendCompanies } from '../../sheets/index.js';
import { logger } from '../../utils/logger.js';

/**
 * @param {string} industry
 * @param {{ limit: string }} options
 */
export async function findCommand(industry, options) {
  const limit = parseInt(options.limit, 10);

  try {
    const companies = await findCompanies(industry, { limit });
    logger.success(`${companies.length}件の企業情報を取得しました`);

    await appendCompanies(companies);
    logger.success('スプレッドシートへの書き込みが完了しました');
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
