// Places API (New) エンドポイント
// 旧 API（maps.googleapis.com/maps/api/place/...）は 2024 年以降の新規 API キーでは利用不可
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAIL_BASE_URL = 'https://places.googleapis.com/v1/places';

const TEXT_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.businessStatus',
  'places.types',
  'places.rating',
  'places.userRatingCount',
].join(',');

const DETAIL_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'businessStatus',
  'types',
].join(',');

/**
 * Google Places API (New) の HTTP クライアント。
 *
 * このクラスは HTTP 通信のみを担う。オーケストレーション・Company マッピングは
 * {@link GoogleMapsProvider} が行う。DI によりテスト時にモック差し替え可能。
 *
 * - Text Search: POST リクエスト + X-Goog-FieldMask ヘッダー
 * - Place Details: GET リクエスト + X-Goog-FieldMask ヘッダー
 * - 認証: X-Goog-Api-Key ヘッダー（URL パラメータではない）
 * - エラー: HTTP ステータスコードで判定（旧 API の status フィールドは不要）
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
   * Places Text Search (New) を呼び出してページ単位の結果を返す。
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

    const body = { textQuery: query, languageCode: this.language, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message ?? '';
      throw new Error(`Places Text Search HTTP エラー: ${res.status}${msg ? ` - ${msg}` : ''}`);
    }

    const data = await res.json();

    return {
      results: (data.places ?? []).map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? '',
        formattedAddress: p.formattedAddress ?? '',
        businessStatus: p.businessStatus ?? '',
        types: p.types ?? [],
        rating: p.rating ?? null,
        userRatingsTotal: p.userRatingCount ?? null,
      })),
      nextPageToken: data.nextPageToken ?? null,
    };
  }

  /**
   * Place Details (New) を呼び出して詳細情報を返す。
   *
   * @param {string} placeId  Text Search の結果に含まれる places.id
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
    const res = await fetch(`${DETAIL_BASE_URL}/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': DETAIL_FIELD_MASK,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message ?? '';
      throw new Error(`Place Details HTTP エラー: ${res.status}${msg ? ` - ${msg}` : ''}`);
    }

    const r = await res.json();

    return {
      placeId: r.id,
      name: r.displayName?.text ?? '',
      formattedAddress: r.formattedAddress ?? '',
      formattedPhoneNumber: r.internationalPhoneNumber ?? '',
      website: r.websiteUri ?? '',
      googleMapsUrl: r.googleMapsUri ?? '',
      businessStatus: r.businessStatus ?? '',
      types: r.types ?? [],
    };
  }
}
