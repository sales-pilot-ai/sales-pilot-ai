import { updateCompany } from '../models/company.js';
import { extractEmails, extractContactFormUrl, extractDescription } from './extractors.js';
import { logger } from '../utils/logger.js';

/**
 * 企業の Web サイトを fetch で取得し、Company の不足フィールドを補完する。
 *
 * 取得・補完フロー:
 *   1. websiteUrl が未設定なら即返却
 *   2. fetch でメインページの HTML を取得
 *   3. HTTP エラー / ネットワーク例外は logger.warn して元の Company をそのまま返す
 *   4. extractEmails / extractContactFormUrl / extractDescription で情報を抽出
 *   5. 空のフィールドのみ補完し、既存値は上書きしない
 *   6. 補完対象がなければ元の Company を返す（同一参照）
 *
 * fetch は DI で差し替え可能（fetchFn オプション）なため、
 * テスト時に HTTP 通信なしで動作を検証できる。
 */
export class WebsiteAnalyzer {
  /**
   * @param {{
   *   fetchFn?: typeof fetch,
   * }} [options]
   */
  constructor({ fetchFn } = {}) {
    this._fetch = fetchFn ?? fetch;
  }

  /**
   * @param {import('../models/company.js').Company} company
   * @returns {Promise<import('../models/company.js').Company>}
   */
  async analyze(company) {
    if (!company.websiteUrl) {
      return company;
    }

    let html;
    try {
      const res = await this._fetch(company.websiteUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (err) {
      logger.warn(`[WebsiteAnalyzer] 取得失敗 ${company.websiteUrl}: ${err.message}`);
      return company;
    }

    const emails = extractEmails(html);
    const contactFormUrl = extractContactFormUrl(html, company.websiteUrl);
    const description = extractDescription(html);

    const patches = {};
    if (!company.email && emails.length > 0) patches.email = emails[0];
    if (!company.contactFormUrl && contactFormUrl) patches.contactFormUrl = contactFormUrl;
    if (!company.memo && description) patches.memo = description;

    if (Object.keys(patches).length === 0) return company;

    logger.info(
      `[WebsiteAnalyzer] ${company.companyName}: [${Object.keys(patches).join(', ')}] を補完`
    );
    return updateCompany(company, patches);
  }
}
