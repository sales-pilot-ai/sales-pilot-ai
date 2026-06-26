import { BaseProvider } from './base.js';

/**
 * Google Maps Places API を使って業種・地域から企業リストを取得する Provider。
 *
 * 取得できる情報:
 *   - 企業名・住所・電話番号・WebサイトURL・営業時間
 *   - Google 評価・口コミ数（leadScore の算出に利用予定）
 *
 * @extends {BaseProvider}
 */
export class GoogleMapsProvider extends BaseProvider {
  constructor() {
    super('GoogleMaps');
  }

  /**
   * @param {string} industry
   * @param {string} area
   * @param {number} [limit=20]
   * @returns {Promise<import('../models/company.js').Company[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async find(industry, area, limit = 20) {
    // TODO: Phase 2 — Google Maps Places API (Nearby Search / Text Search) を実装
    throw new Error('GoogleMapsProvider.find() は未実装です。Phase 2 で実装予定。');
  }
}
