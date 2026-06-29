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
  return { ok: true, json: () => Promise.resolve(data) };
}

function httpError(status) {
  return { ok: false, status };
}

const TEXT_SEARCH_OK = {
  status: 'OK',
  results: [
    {
      place_id: 'place_abc',
      name: 'テストレストラン',
      formatted_address: '東京都渋谷区テスト1-1',
      business_status: 'OPERATIONAL',
      types: ['restaurant', 'food'],
      rating: 4.2,
      user_ratings_total: 150,
    },
  ],
  next_page_token: null,
};

const DETAIL_OK = {
  status: 'OK',
  result: {
    place_id: 'place_abc',
    name: 'テストレストラン',
    formatted_address: '東京都渋谷区テスト1-1',
    formatted_phone_number: '03-1234-5678',
    website: 'https://test-restaurant.com',
    url: 'https://maps.google.com/?cid=12345',
    business_status: 'OPERATIONAL',
    types: ['restaurant', 'food'],
  },
};

const client = new PlacesClient('test_api_key');

// ─── PlacesClient.textSearch ──────────────────────────────────────────────────

describe('PlacesClient.textSearch', () => {
  it('正しい URL（textsearch）で fetch を呼ぶ', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京');
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('textsearch');
    expect(url).toContain('query=');
    expect(url).toContain('test_api_key');
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
    mockFetch.mockResolvedValueOnce(okResponse({ ...TEXT_SEARCH_OK, next_page_token: 'tok123' }));
    const result = await client.textSearch('飲食店 東京');
    expect(result.nextPageToken).toBe('tok123');
  });

  it('ZERO_RESULTS のとき空配列を返す', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ status: 'ZERO_RESULTS', results: [] }));
    const result = await client.textSearch('該当なし 北海道無人島');
    expect(result.results).toHaveLength(0);
    expect(result.nextPageToken).toBeNull();
  });

  it('pageToken を URL パラメータに含める', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(TEXT_SEARCH_OK));
    await client.textSearch('飲食店 東京', 'page_token_abc');
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('pagetoken=page_token_abc');
  });

  it('API エラーステータスで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ status: 'INVALID_REQUEST', error_message: 'Missing query' })
    );
    await expect(client.textSearch('飲食店 東京')).rejects.toThrow('INVALID_REQUEST');
  });

  it('HTTP エラーで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(httpError(500));
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
  it('正しい URL（details）で fetch を呼ぶ', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(DETAIL_OK));
    await client.getDetail('place_abc');
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('details');
    expect(url).toContain('place_id=place_abc');
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
    mockFetch.mockResolvedValueOnce(
      okResponse({ status: 'OK', result: { place_id: 'x', name: 'テスト' } })
    );
    const detail = await client.getDetail('x');
    expect(detail.formattedPhoneNumber).toBe('');
    expect(detail.website).toBe('');
    expect(detail.googleMapsUrl).toBe('');
  });

  it('API エラーステータスで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ status: 'NOT_FOUND' }));
    await expect(client.getDetail('invalid_id')).rejects.toThrow('NOT_FOUND');
  });

  it('HTTP エラーで例外を投げる', async () => {
    mockFetch.mockResolvedValueOnce(httpError(403));
    await expect(client.getDetail('place_abc')).rejects.toThrow('HTTP エラー: 403');
  });
});
