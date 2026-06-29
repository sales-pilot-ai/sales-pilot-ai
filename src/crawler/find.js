import { GoogleMapsProvider } from '../providers/google-maps.js';
import { GoogleSearchProvider } from '../providers/google-search.js';
import { createSearchOptions } from '../models/search-options.js';
import { WebsiteAnalyzer } from './website-analyzer.js';
import { appendCompanies } from '../sheets/index.js';
import { logger } from '../utils/logger.js';

// ─── Provider 一覧 ────────────────────────────────────────────────────────────
// 新しい Provider を追加する際はここへ追加するだけでよい。findCompanies の変更は不要。

const PROVIDERS = [new GoogleMapsProvider(), new GoogleSearchProvider()];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * websiteUrl（なければ companyName）をキーとして重複を除去する。
 * キーが空の企業はスキップされる。
 * @param {import('../models/company.js').Company[]} companies
 * @returns {import('../models/company.js').Company[]}
 */
export function deduplicateCompanies(companies) {
  const seen = new Set();
  return companies.filter((company) => {
    const key = company.websiteUrl || company.companyName;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * 業種・地域を指定して企業リストを取得し、情報を補完してスプレッドシートへ保存する。
 *
 * フロー:
 *   1. PROVIDERS の各 Provider で企業リスト収集（新 Provider は PROVIDERS 定数へ追加）
 *   2. 重複除去 → limit に切り詰め
 *   3. WebsiteAnalyzer で不足フィールドを直列補完（for-of + await）
 *   4. Google Sheets へ追記
 *
 * @param {string} industry 業種（例: "飲食店"）
 * @param {string} area 地域（例: "東京都渋谷区"）
 * @param {{
 *   limit?: number,
 *   skipAnalyzer?: boolean,
 *   skipSheets?: boolean,
 * }} [options]
 * @returns {Promise<import('../models/company.js').Company[]>}
 */
export async function findCompanies(industry, area, options = {}) {
  const { limit = 20, skipAnalyzer = false, skipSheets = false } = options;

  logger.step(`「${industry}」×「${area}」で企業を検索します（上限: ${limit}件）`);

  const searchOptions = createSearchOptions({ industry, area, limit });

  // 1. Provider ごとに取得して結合
  const rawCompanies = [];

  for (const provider of PROVIDERS) {
    try {
      logger.info(`[${provider.name}] 検索中...`);
      const results = await provider.find(searchOptions);
      logger.success(`[${provider.name}] ${results.length} 件取得`);
      rawCompanies.push(...results);
    } catch (err) {
      logger.warn(`[${provider.name}] スキップ: ${err.message}`);
    }
  }

  // 2. 重複除去 → 件数制限
  const unique = deduplicateCompanies(rawCompanies);
  const limited = unique.slice(0, limit);
  logger.info(`取得: ${limited.length} 件（重複除去後）`);

  if (limited.length === 0) {
    logger.warn('企業が見つかりませんでした');
    return [];
  }

  // 3. WebsiteAnalyzer で不足フィールドを補完
  let companies = limited;
  if (!skipAnalyzer) {
    logger.step('WebsiteAnalyzer で情報を補完中...');
    const analyzer = new WebsiteAnalyzer();
    const enriched = [];
    // 直列実行（for-of + await）: 将来的に requestDelayMs や並列数制御を挟みやすい
    for (const [i, company] of limited.entries()) {
      logger.info(`  [${i + 1}/${limited.length}] ${company.companyName}`);
      enriched.push(await analyzer.analyze(company));
    }
    companies = enriched;
  }

  // 4. Google Sheets へ保存
  if (!skipSheets) {
    logger.step('Google Sheets へ保存中...');
    await appendCompanies(companies);
    logger.success('スプレッドシートへ保存しました');
  }

  logger.success(`完了: ${companies.length} 件`);
  return companies;
}
