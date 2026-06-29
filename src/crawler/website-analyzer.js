import { updateCompany } from '../models/company.js';
import { extractEmails, extractContactFormUrl, extractDescription } from './extractors.js';
import { logger } from '../utils/logger.js';

/**
 * 企業の Web サイトを fetch で取得し、Company の不足フィールドを補完する。
 *
 * 取得・補完フロー:
 *   1. websiteUrl が未設定なら即返却
 *   2. トップページを fetch → HTTP エラー / 例外は logger.warn して元の Company をそのまま返す
 *   3. トップページから extractEmails / extractContactFormUrl / extractDescription を実行
 *   4. email が取得できた場合はお問い合わせページの巡回をスキップ
 *   5. email が未取得かつ contactFormUrl が存在する場合のみお問い合わせページを fetch
 *   6. お問い合わせページからは extractEmails のみ実行
 *   7. お問い合わせページの fetch エラーはログ出力のみ（トップページ分のパッチは適用する）
 *   8. 空のフィールドのみ補完し、既存値は上書きしない
 *   9. 補完対象がなければ元の Company を返す（同一参照）
 *  10. 最大 2 ページ（トップ + お問い合わせ）のみ巡回
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

    // ── 1. トップページ取得 ────────────────────────────────────────────────────

    let topHtml;
    try {
      const res = await this._fetch(company.websiteUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      topHtml = await res.text();
    } catch (err) {
      logger.warn(`[WebsiteAnalyzer] 取得失敗 ${company.websiteUrl}: ${err.message}`);
      return company;
    }

    // ── 2. トップページから抽出 ────────────────────────────────────────────────

    const topEmails = extractEmails(topHtml);
    const contactFormUrl = extractContactFormUrl(topHtml, company.websiteUrl);
    const description = extractDescription(topHtml);

    const patches = {};
    if (!company.email && topEmails.length > 0) patches.email = topEmails[0];
    if (!company.contactFormUrl && contactFormUrl) patches.contactFormUrl = contactFormUrl;
    if (!company.memo && description) patches.memo = description;

    // ── 3. email 未取得かつ contactFormUrl ありの場合のみ 2 ページ目を巡回 ──

    const needsEmail = !company.email && !patches.email;
    const contactUrl = patches.contactFormUrl || company.contactFormUrl;

    if (needsEmail && contactUrl) {
      try {
        const res = await this._fetch(contactUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contactHtml = await res.text();
        const contactEmails = extractEmails(contactHtml);
        if (contactEmails.length > 0) patches.email = contactEmails[0];
      } catch (err) {
        logger.warn(
          `[WebsiteAnalyzer] 取得失敗（お問い合わせページ）${contactUrl}: ${err.message}`
        );
      }
    }

    // ── 4. パッチ適用 ─────────────────────────────────────────────────────────

    if (Object.keys(patches).length === 0) return company;

    logger.info(
      `[WebsiteAnalyzer] ${company.companyName}: [${Object.keys(patches).join(', ')}] を補完`
    );
    return updateCompany(company, patches);
  }
}
