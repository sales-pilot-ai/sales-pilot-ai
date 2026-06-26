import { logger } from '../utils/logger.js';

/**
 * @typedef {Object} Company
 * @property {string} companyName
 * @property {string} industry
 * @property {string} websiteUrl
 * @property {string} email
 * @property {string} contactPerson
 * @property {string} location
 */

/**
 * 業種キーワードから企業リストを取得する
 * @param {string} industry
 * @param {{ limit?: number }} options
 * @returns {Promise<Company[]>}
 */
export async function findCompanies(industry, { limit = 20 } = {}) {
  logger.step(`「${industry}」で企業を検索中... (上限: ${limit}件)`);

  // TODO: 実装予定
  // 1. Google Custom Search API or スクレイピングで企業URL一覧を取得
  // 2. 各企業サイトからメールアドレス・所在地を抽出
  // 3. 法人番号APIで企業名を正規化

  throw new Error('crawler は未実装です。Phase 2 で実装予定。');
}
