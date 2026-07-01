import { BaseProvider } from './base.js';
import { PlacesClient } from './places-client.js';
import { createCompany } from '../models/company.js';
import { createSearchOptions } from '../models/search-options.js';
import { logger } from '../utils/logger.js';
import { settings } from '../config/index.js';

/**
 * Google Maps Places API を使って企業リストを取得する Provider。
 *
 * 取得できる情報: 企業名 / 住所 / 電話番号 / 公式サイト URL /
 *                Google Maps URL / 営業状態 / カテゴリ / リードスコア
 *
 * HTTP 通信は {@link PlacesClient} が担い、このクラスはオーケストレーションと
 * Company マッピングのみを行う。PlacesClient は DI 可能なため単体テストが容易。
 *
 * @extends {BaseProvider}
 */
export class GoogleMapsProvider extends BaseProvider {
  /**
   * @param {{
   *   apiKey?: string,
   *   client?: PlacesClient,
   *   delayMs?: number,
   * }} [options]
   */
  constructor({ apiKey, client, delayMs } = {}) {
    super('GoogleMaps');
    this._client = client ?? new PlacesClient(apiKey ?? process.env.GOOGLE_MAPS_API_KEY ?? '');
    this._delayMs = delayMs ?? settings.crawler.requestDelayMs;
  }

  /**
   * 検索条件をもとに企業を検索し、Company 配列を返す。
   *
   * 1. Places Text Search でページネーションしながら最大 limit 件収集
   * 2. 各結果に対して Place Details API を呼び出して連絡先を補完
   * 3. SearchOptions のフィルタ条件を適用（閉業除外・最低評価・サイト必須など）
   *
   * @param {import('../models/search-options.js').SearchOptions} rawOptions
   * @returns {Promise<import('../models/company.js').Company[]>}
   */
  async find(rawOptions = {}) {
    if (!this._client.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY が .env に設定されていません');
    }

    const opts = createSearchOptions(rawOptions);
    const {
      industry,
      area,
      limit,
      excludeClosed,
      websiteRequired,
      phoneRequired,
      minRating,
      minReviewCount,
    } = opts;

    const query = `${industry} ${area}`;
    logger.info(`[GoogleMaps] "${query}" を検索中（上限: ${limit} 件）`);

    const searchResults = await this._collectSearchResults(query, limit);
    logger.info(`[GoogleMaps] ${searchResults.length} 件の検索結果を取得。詳細情報を取得中...`);

    const companies = [];
    for (const result of searchResults) {
      await this._sleep(this._delayMs);
      try {
        const detail = await this._client.getDetail(result.placeId);

        if (excludeClosed && detail.businessStatus === 'CLOSED_PERMANENTLY') continue;
        if (websiteRequired && !detail.website) continue;
        if (phoneRequired && !detail.formattedPhoneNumber) continue;
        if (minRating !== null && (result.rating === null || result.rating < minRating)) continue;
        if (
          minReviewCount !== null &&
          (result.userRatingsTotal === null || result.userRatingsTotal < minReviewCount)
        )
          continue;

        companies.push(this._toCompany(result, detail, industry));
      } catch (err) {
        logger.warn(`[GoogleMaps] ${result.name} の詳細取得をスキップ: ${err.message}`);
      }
    }

    return companies;
  }

  /**
   * ページネーションを処理して limit 件分の検索結果を収集する。
   * @param {string} query
   * @param {number} limit
   */
  async _collectSearchResults(query, limit) {
    const results = [];
    let pageToken = null;

    do {
      // next_page_token の有効化には数秒かかるため、次ページ取得前に待機する
      if (pageToken) await this._sleep(this._delayMs);
      const page = await this._client.textSearch(query, pageToken);
      results.push(...page.results);
      pageToken = page.nextPageToken;
    } while (pageToken && results.length < limit);

    return results.slice(0, limit);
  }

  /**
   * @param {object} searchResult  Text Search の結果（評価データを含む）
   * @param {object} detail        Place Details の結果（連絡先データを含む）
   * @param {string} industry      検索時の業種
   * @returns {import('../models/company.js').Company}
   */
  _toCompany(searchResult, detail, industry) {
    return createCompany({
      placeId: detail.placeId || searchResult.placeId || '',
      companyName: detail.name || searchResult.name,
      industry,
      websiteUrl: detail.website,
      phone: detail.formattedPhoneNumber,
      location: detail.formattedAddress || searchResult.formattedAddress,
      googleMapsUrl: detail.googleMapsUrl,
      leadScore: this._calcLeadScore(searchResult.rating, searchResult.userRatingsTotal),
    });
  }

  /**
   * Google の評点・評価数からリードスコア（0〜100 程度）を算出する。
   * 評点（5 段階） × 10 を基本点、評価数の対数で最大 50 点加算。
   * @param {number|null} rating
   * @param {number|null} userRatingsTotal
   * @returns {number|null}
   */
  _calcLeadScore(rating, userRatingsTotal) {
    if (!rating) return null;
    const ratingScore = rating * 10;
    const reviewScore = Math.min(Math.log10(Math.max(userRatingsTotal ?? 1, 1)) * 10, 50);
    return Math.round(ratingScore + reviewScore);
  }

  /** @param {number} ms */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
