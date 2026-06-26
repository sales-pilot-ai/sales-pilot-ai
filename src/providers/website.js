import { BaseProvider } from './base.js';

/**
 * Playwright を使って企業 Web サイトを直接スクレイピングする Provider。
 *
 * 取得できる情報:
 *   - メールアドレス・お問い合わせフォームURL・Instagram/TikTok リンク
 *   - 担当者名・従業員数・店舗数（サイト構造に依存）
 *
 * 他の Provider がURLリストを取得した後、詳細情報を補完する目的で使用する。
 *
 * @extends {BaseProvider}
 */
export class WebsiteProvider extends BaseProvider {
  constructor() {
    super('Website');
  }

  /**
   * @param {string} industry
   * @param {string} area
   * @param {number} [limit=20]
   * @returns {Promise<import('../models/company.js').Company[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async find(industry, area, limit = 20) {
    // TODO: Phase 2 — Playwright でサイトをクロールして企業情報を抽出
    throw new Error('WebsiteProvider.find() は未実装です。Phase 2 で実装予定。');
  }
}
