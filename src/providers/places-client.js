const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAIL_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const DETAIL_FIELDS =
  'place_id,name,formatted_address,formatted_phone_number,website,url,business_status,types';

/**
 * Google Places API（Text Search / Place Details）の HTTP クライアント。
 *
 * このクラスは HTTP 通信のみを担う。オーケストレーション・Company マッピングは
 * {@link GoogleMapsProvider} が行う。DI によりテスト時にモック差し替え可能。
 */
export class PlacesClient {
  /**
   * @param {string} apiKey
   * @param {{ language?: string }} [options]
   */
  constructor(apiKey, { language = 'ja' } = {}) {
    this.apiKey = apiKey;
    this.language = language;
  }

  /**
   * Places Text Search API を呼び出してページ単位の結果を返す。
   *
   * @param {string} query  検索クエリ（例: "飲食店 東京都渋谷区"）
   * @param {string|null} [pageToken]  次ページトークン
   * @returns {Promise<{
   *   results: Array<{
   *     placeId: string,
   *     name: string,
   *     formattedAddress: string,
   *     businessStatus: string,
   *     types: string[],
   *     rating: number|null,
   *     userRatingsTotal: number|null,
   *   }>,
   *   nextPageToken: string|null,
   * }>}
   */
  async textSearch(query, pageToken = null) {
    if (!this.apiKey) throw new Error('GOOGLE_MAPS_API_KEY が .env に設定されていません');

    const params = new URLSearchParams({ query, language: this.language, key: this.apiKey });
    if (pageToken) params.set('pagetoken', pageToken);

    const res = await fetch(`${TEXT_SEARCH_URL}?${params}`);
    if (!res.ok) throw new Error(`Places Text Search HTTP エラー: ${res.status}`);

    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      const msg = data.error_message ? ` - ${data.error_message}` : '';
      throw new Error(`Places Text Search API エラー: ${data.status}${msg}`);
    }

    return {
      results: (data.results ?? []).map((r) => ({
        placeId: r.place_id,
        name: r.name ?? '',
        formattedAddress: r.formatted_address ?? '',
        businessStatus: r.business_status ?? '',
        types: r.types ?? [],
        rating: r.rating ?? null,
        userRatingsTotal: r.user_ratings_total ?? null,
      })),
      nextPageToken: data.next_page_token ?? null,
    };
  }

  /**
   * Place Details API を呼び出して詳細情報を返す。
   *
   * @param {string} placeId
   * @returns {Promise<{
   *   placeId: string,
   *   name: string,
   *   formattedAddress: string,
   *   formattedPhoneNumber: string,
   *   website: string,
   *   googleMapsUrl: string,
   *   businessStatus: string,
   *   types: string[],
   * }>}
   */
  async getDetail(placeId) {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: DETAIL_FIELDS,
      language: this.language,
      key: this.apiKey,
    });

    const res = await fetch(`${DETAIL_URL}?${params}`);
    if (!res.ok) throw new Error(`Place Details HTTP エラー: ${res.status}`);

    const data = await res.json();
    if (data.status !== 'OK') {
      const msg = data.error_message ? ` - ${data.error_message}` : '';
      throw new Error(`Place Details API エラー: ${data.status}${msg}`);
    }

    const r = data.result;
    return {
      placeId: r.place_id,
      name: r.name ?? '',
      formattedAddress: r.formatted_address ?? '',
      formattedPhoneNumber: r.formatted_phone_number ?? '',
      website: r.website ?? '',
      googleMapsUrl: r.url ?? '',
      businessStatus: r.business_status ?? '',
      types: r.types ?? [],
    };
  }
}
