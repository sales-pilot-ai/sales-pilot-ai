import { logger } from '../utils/logger.js';

export { WebsiteAnalyzer } from './website-analyzer.js';
export { extractAll } from './extractors.js';

/**
 * 業種キーワードから企業リストを取得する
 * @param {string} industry
 * @param {{ limit?: number }} options
 * @returns {Promise<import('../models/company.js').Company[]>}
 */
export async function findCompanies(industry, { limit = 20 } = {}) {
  logger.step(`「${industry}」で企業を検索中... (上限: ${limit}件)`);

  // TODO: Phase 2 — Provider を使って実装
  // 1. GoogleMapsProvider / GoogleSearchProvider で企業URL一覧を取得
  // 2. WebsiteAnalyzer で各企業サイトを補完
  // 3. 法人番号APIで企業名を正規化

  throw new Error('crawler は未実装です。Phase 2 で実装予定。');
}
