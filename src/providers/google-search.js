import { BaseProvider } from './base.js';

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
  // eslint-disable-next-line no-unused-vars
  async find(industry, area, limit = 20) {
    // TODO: Phase 2 — Google Custom Search JSON API を実装
    throw new Error('GoogleSearchProvider.find() は未実装です。Phase 2 で実装予定。');
  }
}
