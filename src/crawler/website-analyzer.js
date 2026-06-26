import { chromium } from 'playwright';
import { updateCompany } from '../models/company.js';
import { logger } from '../utils/logger.js';
import { extractAll, extractContactFormUrl } from './extractors.js';

/** WebsiteAnalyzer が補完を試みるフィールド */
const TARGET_FIELDS = [
  'email',
  'contactFormUrl',
  'instagram',
  'tiktok',
  'employeeCount',
  'storeCount',
];

// ─── Patch helpers ────────────────────────────────────────────────────────────

/**
 * 抽出結果をフィルタして「今の Company に適用すべき更新」だけを返す。
 * - 既にある値は上書きしない
 * - 空文字・null の抽出結果は適用しない
 *
 * @param {import('../models/company.js').Company} company
 * @param {Record<string, unknown>} raw - extractAll の返り値
 * @returns {Partial<import('../models/company.js').Company>}
 */
export function buildPatches(company, raw) {
  /** @type {Record<string, unknown>} */
  const patches = {};

  for (const field of TARGET_FIELDS) {
    const current = company[field];
    const extracted = raw[field];

    const isMissing = current === null || current === '' || current === undefined;
    const hasValue = extracted !== null && extracted !== '' && extracted !== undefined;

    if (isMissing && hasValue) {
      patches[field] = extracted;
    }
  }

  return patches;
}

/**
 * Company に patches を適用して新しい Company を返す。
 * 適用すべき変更がなければ元の Company をそのまま返す。
 *
 * @param {import('../models/company.js').Company} company
 * @param {Partial<import('../models/company.js').Company>} patches
 * @returns {import('../models/company.js').Company}
 */
export function applyPatches(company, patches) {
  if (Object.keys(patches).length === 0) return company;
  return updateCompany(company, patches);
}

// ─── WebsiteAnalyzer ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} WebsiteAnalyzerOptions
 * @property {boolean} [headless=true]       - ブラウザをヘッドレスで起動するか
 * @property {number}  [timeout=15000]       - ページ読み込みタイムアウト（ms）
 * @property {boolean} [visitContactPage=true] - コンタクトページも訪問するか
 */

/**
 * 企業の Web サイトを Playwright で訪問し、Company の不足フィールドを補完する。
 *
 * 動作フロー:
 *   1. websiteUrl が未設定 or 全フィールド補完済みなら即返却
 *   2. メインページを訪問して extractAll で情報抽出
 *   3. email / contactFormUrl がまだ不足していればコンタクトページも訪問
 *   4. buildPatches → applyPatches で Company を更新
 */
export class WebsiteAnalyzer {
  /** @param {WebsiteAnalyzerOptions} [options] */
  constructor(options = {}) {
    this.headless = options.headless ?? true;
    this.timeout = options.timeout ?? 15_000;
    this.visitContactPage = options.visitContactPage ?? true;
  }

  /**
   * @param {import('../models/company.js').Company} company
   * @returns {Promise<import('../models/company.js').Company>}
   */
  async analyze(company) {
    if (!company.websiteUrl) {
      logger.warn(`[WebsiteAnalyzer] websiteUrl 未設定のためスキップ: ${company.companyName}`);
      return company;
    }

    if (this.#isSufficient(company)) {
      logger.info(`[WebsiteAnalyzer] 補完不要（全フィールド補完済み）: ${company.companyName}`);
      return company;
    }

    const browser = await chromium.launch({ headless: this.headless });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeout);

      const result = await this.#analyzePage(company, page);

      const filled = Object.keys(result).filter(
        (k) => TARGET_FIELDS.includes(k) && result[k] !== company[k]
      );
      if (filled.length > 0) {
        logger.success(`[WebsiteAnalyzer] ${company.companyName}: [${filled.join(', ')}] を補完`);
      }

      return result;
    } catch (err) {
      logger.warn(`[WebsiteAnalyzer] 解析失敗 ${company.websiteUrl}: ${err.message}`);
      return company;
    } finally {
      await browser.close();
    }
  }

  /**
   * ページオブジェクトを受け取って解析を行う。
   * テスト時はこのメソッドにモックページを渡すことで Playwright 不要でテスト可能。
   *
   * @param {import('../models/company.js').Company} company
   * @param {import('playwright').Page} page
   * @returns {Promise<import('../models/company.js').Company>}
   */
  async analyzePage(company, page) {
    return this.#analyzePage(company, page);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** @param {import('../models/company.js').Company} company */
  #isSufficient(company) {
    return TARGET_FIELDS.every((field) => {
      const val = company[field];
      return val !== null && val !== '' && val !== undefined;
    });
  }

  /**
   * @param {import('../models/company.js').Company} company
   * @param {import('playwright').Page} page
   * @returns {Promise<import('../models/company.js').Company>}
   */
  async #analyzePage(company, page) {
    await page.goto(company.websiteUrl, { waitUntil: 'domcontentloaded' });
    const mainHtml = await page.content();
    const mainRaw = extractAll(mainHtml, company.websiteUrl);
    let patches = buildPatches(company, mainRaw);

    // email / contactFormUrl がまだ不足 → コンタクトページを訪問
    const afterMain = applyPatches(company, patches);
    if (this.visitContactPage && this.#needsContactPage(afterMain)) {
      const contactUrl =
        patches.contactFormUrl || extractContactFormUrl(mainHtml, company.websiteUrl);

      if (contactUrl && contactUrl !== company.websiteUrl) {
        try {
          await page.goto(contactUrl, { waitUntil: 'domcontentloaded' });
          const contactHtml = await page.content();
          const contactRaw = extractAll(contactHtml, contactUrl);
          const contactPatches = buildPatches(afterMain, contactRaw);
          patches = { ...patches, ...contactPatches };
        } catch {
          // コンタクトページのナビゲーション失敗は無視
        }
      }
    }

    return applyPatches(company, patches);
  }

  /** @param {import('../models/company.js').Company} company */
  #needsContactPage(company) {
    return !company.email || !company.contactFormUrl;
  }
}
