import { BaseProvider } from './base.js';
import { logger } from '../utils/logger.js';

/**
 * Google Custom Search JSON API を使って業種・地域から企業リストを取得する Provider。
 *
 * 取得できる情報:
 *   - 企業名・WebサイトURL・スニペット（会社概要の抽出に利用）
 *
 * @extends {BaseProvider}
 */
export class GoogleSearchProvider extends BaseProvider {
  constructor() {
    super('GoogleSearch');
  }

  /**
   * @param {string} industry
   * @param {string} area
   * @param {number} [limit=20]
   * @returns {Promise<import('../models/company.js').Company[]>}
   */
  async find(industry, area, limit = 20) {
    logger.info(`[GoogleSearch] 「${industry}」×「${area}」(上限: ${limit}件) を検索中...`);
    // TODO: Phase 2 — Google Custom Search JSON API を実装
    logger.warn('[GoogleSearch] Google Custom Search API は未実装です（Phase 2 で実装予定）');
    return [];
  }
}
