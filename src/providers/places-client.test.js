import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlacesClient } from './places-client.js';

// ─── fetch モック ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function okResponse(data) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function errorResponse(status, message = '') {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: status, message, status: 'ERROR' } }),
  };
}

// Places API (New) レスポンス形式
const TEXT_SEARCH_OK = {
  places: [
    {
      id: 'place_abc',
      displayName: { text: 'テストレストラン', languageCode: 'ja' },
      formattedAddress: '東京都渋谷区テスト1-1',
      businessStatus: 'OPERATIONAL',
      types: ['restaurant', 'food'],
      rating: 4.2,
      userRatingCount: 150,
    },
  ],
};

const DETAIL_OK = {
  id: 'place_abc',
  name: 'places/place_abc',
  displayName: { text: 'テストレストラン', languageCode: 'ja' },
  formattedAddress: '東京都渋谷区テスト1-1',
  internationalPhoneNumber: '03-1234-5678',
  websiteUri: 'https://test-restaurant.com',
  googleMapsUri: 'https://maps.google.com/?cid=12345',
  businessStatus: 'OPERATIONAL',
  types: ['restaurant', 'food'],
};

const client = new PlacesClient('test_api_key');

// ─── PlacesClient.textSearch ──────────────────────────────────────────────────

describe('PlacesClient.textSearch', () => {
  it('Places API (New) エンドポイント（places.googleapis.com）で POST する', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('places.googleapis.com/v1/places:searchText');
    expect(options.method).toBe('POST');
  });

  it('X-Goog-Api-Key ヘッダーを送る', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Goog-Api-Key']).toBe('test_api_key');
  });

  it('X-Goog-FieldMask ヘッダーを送る', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Goog-FieldMask']).toContain('places.id');
    expect(headers['X-Goog-FieldMask']).toContain('places.displayName');
  });

  it('textQuery をリクエストボディに含める', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.textQuery).toBe('飲食店 東京');
    expect(body.languageCode).toBe('ja');
  });

  it('pageToken をリクエストボディに含める（URL パラメータではない）', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京', 'next_page_token_xyz');

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.pageToken).toBe('next_page_token_xyz');
    expect(url).not.toContain('pagetoken');
  });

  it('結果を camelCase に正規化して返す', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    const result = await client.textSearch('飲食店 東京');

    expect(result.results[0]).toMatchObject({
      placeId: 'place_abc',
      name: 'テストレストラン',
      formattedAddress: '東京都渋谷区テスト1-1',
      businessStatus: 'OPERATIONAL',
      types: ['restaurant', 'food'],
      rating: 4.2,
      userRatingsTotal: 150,
    });
  });

  it('nextPageToken を返す', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ ...TEXT_SEARCH_OK, nextPageToken: 'tok_next_123' })
    );
    const result = await client.textSearch('飲食店 東京');
    expect(result.nextPageToken).toBe('tok_next_123');
  });

  it('nextPageToken がないとき null を返す', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    const result = await client.textSearch('飲食店 東京');
    expect(result.nextPageToken).toBeNull();
  });

  it('results が空のとき（ZERO_RESULTS 相当）空配列を返す', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ places: [] }));
    const result = await client.textSearch('該当なし 北海道無人島');
    expect(result.results).toHaveLength(0);
    expect(result.nextPageToken).toBeNull();
  });

  it('places キーが欠けているとき空配列を返す', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const result = await client.textSearch('テスト');
    expect(result.results).toHaveLength(0);
  });

  it('HTTP 403 エラー（API キー不正）で例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, 'API key not valid'));
    await expect(client.textSearch('飲食店 東京')).rejects.toThrow('HTTP エラー: 403');
  });

  it('HTTP 500 エラーで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));
    await expect(client.textSearch('飲食店 東京')).rejects.toThrow('HTTP エラー: 500');
  });

  it('apiKey が空のとき fetch を呼ばずに例外を投げる', async () => {
    const clientWithoutKey = new PlacesClient('');
    await expect(clientWithoutKey.textSearch('飲食店')).rejects.toThrow('GOOGLE_MAPS_API_KEY');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── PlacesClient.getDetail ───────────────────────────────────────────────────

describe('PlacesClient.getDetail', () => {
  it('Places API (New) の詳細エンドポイントで GET する', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(DETAIL_OK));
    await client.getDetail('place_abc');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('places.googleapis.com/v1/places/place_abc');
    expect(options?.method).toBeUndefined();
  });

  it('X-Goog-Api-Key ヘッダーを送る', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(DETAIL_OK));
    await client.getDetail('place_abc');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Goog-Api-Key']).toBe('test_api_key');
  });

  it('X-Goog-FieldMask ヘッダーを送る', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(DETAIL_OK));
    await client.getDetail('place_abc');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Goog-FieldMask']).toContain('displayName');
    expect(headers['X-Goog-FieldMask']).toContain('internationalPhoneNumber');
  });

  it('結果を camelCase に正規化して返す', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(DETAIL_OK));
    const detail = await client.getDetail('place_abc');

    expect(detail).toMatchObject({
      placeId: 'place_abc',
      name: 'テストレストラン',
      formattedAddress: '東京都渋谷区テスト1-1',
      formattedPhoneNumber: '03-1234-5678',
      website: 'https://test-restaurant.com',
      googleMapsUrl: 'https://maps.google.com/?cid=12345',
      businessStatus: 'OPERATIONAL',
      types: ['restaurant', 'food'],
    });
  });

  it('省略フィールドは空文字になる', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ id: 'x', displayName: { text: 'テスト' } }));
    const detail = await client.getDetail('x');
    expect(detail.formattedPhoneNumber).toBe('');
    expect(detail.website).toBe('');
    expect(detail.googleMapsUrl).toBe('');
  });

  it('HTTP 404 エラーで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'Place not found'));
    await expect(client.getDetail('invalid_id')).rejects.toThrow('HTTP エラー: 404');
  });

  it('HTTP 403 エラーで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403));
    await expect(client.getDetail('place_abc')).rejects.toThrow('HTTP エラー: 403');
  });

  it('エラーメッセージが含まれる場合それを付与する', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, 'API key invalid'));
    await expect(client.getDetail('place_abc')).rejects.toThrow('API key invalid');
  });
});
