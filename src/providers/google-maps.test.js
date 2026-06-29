import { describe, it, expect, vi } from 'vitest';
import { GoogleMapsProvider } from './google-maps.js';
import { createSearchOptions } from '../models/search-options.js';

// ─── モック設定 ────────────────────────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/index.js', () => ({
  settings: { crawler: { requestDelayMs: 0 } },
}));

// ─── モッククライアントファクトリ ──────────────────────────────────────────────

function makeClient({ textSearchResults = [], nextPageToken = null, detail = null } = {}) {
  return {
    apiKey: 'test_key',
    textSearch: vi.fn().mockResolvedValue({
      results: textSearchResults,
      nextPageToken,
    }),
    getDetail: vi.fn().mockResolvedValue(
      detail ?? {
        placeId: 'place_001',
        name: 'テスト株式会社',
        formattedAddress: '東京都渋谷区テスト1-1',
        formattedPhoneNumber: '03-1234-5678',
        website: 'https://test.co.jp',
        googleMapsUrl: 'https://maps.google.com/?cid=001',
        businessStatus: 'OPERATIONAL',
        types: ['company'],
      }
    ),
  };
}

const SEARCH_RESULT = {
  placeId: 'place_001',
  name: 'テスト株式会社',
  formattedAddress: '東京都渋谷区テスト1-1',
  businessStatus: 'OPERATIONAL',
  types: ['company'],
  rating: 4.0,
  userRatingsTotal: 100,
};

function opts(overrides = {}) {
  return createSearchOptions({ industry: '飲食', area: '東京', limit: 20, ...overrides });
}

// ─── コンストラクタ ────────────────────────────────────────────────────────────

describe('GoogleMapsProvider constructor', () => {
  it('name が "GoogleMaps" になる', () => {
    const provider = new GoogleMapsProvider({ client: makeClient() });
    expect(provider.name).toBe('GoogleMaps');
  });

  it('client を DI で差し替えられる', () => {
    const client = makeClient();
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    expect(provider._client).toBe(client);
  });

  it('delayMs を上書きできる', () => {
    const provider = new GoogleMapsProvider({ client: makeClient(), delayMs: 99 });
    expect(provider._delayMs).toBe(99);
  });
});

// ─── find ─────────────────────────────────────────────────────────────────────

describe('GoogleMapsProvider.find', () => {
  it('apiKey が空のとき例外を投げる', async () => {
    const client = { ...makeClient(), apiKey: '' };
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    await expect(provider.find(opts())).rejects.toThrow('GOOGLE_MAPS_API_KEY');
  });

  it('textSearch を "業種 地域" クエリで呼ぶ', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    await provider.find(opts({ industry: '飲食', area: '渋谷区' }));
    expect(client.textSearch).toHaveBeenCalledWith('飲食 渋谷区', null);
  });

  it('Company 配列を返す', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ limit: 5 }));
    expect(companies).toHaveLength(1);
    expect(companies[0].companyName).toBe('テスト株式会社');
  });

  it('industry が Company.industry に格納される', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const [company] = await provider.find(opts({ industry: '飲食' }));
    expect(company.industry).toBe('飲食');
  });

  it('excludeClosed=true のとき CLOSED_PERMANENTLY の企業を除外する', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    client.getDetail.mockResolvedValue({
      placeId: 'place_001',
      name: '閉店テスト',
      formattedAddress: '',
      formattedPhoneNumber: '',
      website: '',
      googleMapsUrl: '',
      businessStatus: 'CLOSED_PERMANENTLY',
      types: [],
    });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ excludeClosed: true }));
    expect(companies).toHaveLength(0);
  });

  it('excludeClosed=false のとき CLOSED_PERMANENTLY の企業を含める', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    client.getDetail.mockResolvedValue({
      placeId: 'place_001',
      name: '閉店テスト',
      formattedAddress: '',
      formattedPhoneNumber: '03-0000-0000',
      website: 'https://example.com',
      googleMapsUrl: '',
      businessStatus: 'CLOSED_PERMANENTLY',
      types: [],
    });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ excludeClosed: false }));
    expect(companies).toHaveLength(1);
  });

  it('websiteRequired=true のとき website のない企業を除外する', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    client.getDetail.mockResolvedValue({
      placeId: 'place_001',
      name: 'サイトなし企業',
      formattedAddress: '',
      formattedPhoneNumber: '03-0000-0000',
      website: '',
      googleMapsUrl: '',
      businessStatus: 'OPERATIONAL',
      types: [],
    });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ websiteRequired: true }));
    expect(companies).toHaveLength(0);
  });

  it('phoneRequired=true のとき電話番号のない企業を除外する', async () => {
    const client = makeClient({ textSearchResults: [SEARCH_RESULT] });
    client.getDetail.mockResolvedValue({
      placeId: 'place_001',
      name: '電話なし企業',
      formattedAddress: '',
      formattedPhoneNumber: '',
      website: 'https://example.com',
      googleMapsUrl: '',
      businessStatus: 'OPERATIONAL',
      types: [],
    });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ phoneRequired: true }));
    expect(companies).toHaveLength(0);
  });

  it('minRating を下回る企業を除外する', async () => {
    const lowRatedResult = { ...SEARCH_RESULT, rating: 2.5, userRatingsTotal: 10 };
    const client = makeClient({ textSearchResults: [lowRatedResult] });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ minRating: 3.0 }));
    expect(companies).toHaveLength(0);
  });

  it('minReviewCount を下回る企業を除外する', async () => {
    const fewReviewsResult = { ...SEARCH_RESULT, rating: 4.5, userRatingsTotal: 3 };
    const client = makeClient({ textSearchResults: [fewReviewsResult] });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ minReviewCount: 10 }));
    expect(companies).toHaveLength(0);
  });

  it('getDetail でエラーが起きた場合はスキップして続行する', async () => {
    const client = makeClient({
      textSearchResults: [
        { ...SEARCH_RESULT, placeId: 'err_id', name: 'エラー店' },
        { ...SEARCH_RESULT, placeId: 'ok_id', name: '正常店' },
      ],
    });
    client.getDetail.mockRejectedValueOnce(new Error('API エラー')).mockResolvedValueOnce({
      placeId: 'ok_id',
      name: '正常店',
      formattedAddress: '',
      formattedPhoneNumber: '',
      website: '',
      googleMapsUrl: '',
      businessStatus: 'OPERATIONAL',
      types: [],
    });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ limit: 10 }));
    expect(companies).toHaveLength(1);
    expect(companies[0].companyName).toBe('正常店');
  });

  it('結果が 0 件のとき空配列を返す', async () => {
    const client = makeClient({ textSearchResults: [] });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const companies = await provider.find(opts({ industry: '存在しない業種', area: '無人島' }));
    expect(companies).toHaveLength(0);
  });

  it('limit を超えて getDetail を呼ばない', async () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      ...SEARCH_RESULT,
      placeId: `place_${i}`,
      name: `企業${i}`,
    }));
    const client = makeClient({ textSearchResults: results });
    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    await provider.find(opts({ limit: 3 }));
    expect(client.getDetail).toHaveBeenCalledTimes(3);
  });
});

// ─── _toCompany ───────────────────────────────────────────────────────────────

describe('GoogleMapsProvider._toCompany', () => {
  const provider = new GoogleMapsProvider({ client: makeClient(), delayMs: 0 });

  const detail = {
    name: '詳細名前',
    formattedAddress: '詳細住所',
    formattedPhoneNumber: '03-9999-9999',
    website: 'https://detail.co.jp',
    googleMapsUrl: 'https://maps.google.com/?cid=999',
    businessStatus: 'OPERATIONAL',
    types: [],
  };

  it('detail.name を companyName に使う', () => {
    const company = provider._toCompany(SEARCH_RESULT, detail, '飲食');
    expect(company.companyName).toBe('詳細名前');
  });

  it('detail.name が空のとき searchResult.name を使う', () => {
    const company = provider._toCompany(
      { ...SEARCH_RESULT, name: '検索名前' },
      { ...detail, name: '' },
      '飲食'
    );
    expect(company.companyName).toBe('検索名前');
  });

  it('detail.website を websiteUrl に使う', () => {
    const company = provider._toCompany(SEARCH_RESULT, detail, '飲食');
    expect(company.websiteUrl).toBe('https://detail.co.jp');
  });

  it('detail.googleMapsUrl を googleMapsUrl に使う', () => {
    const company = provider._toCompany(SEARCH_RESULT, detail, '飲食');
    expect(company.googleMapsUrl).toBe('https://maps.google.com/?cid=999');
  });

  it('detail.formattedPhoneNumber を phone に使う', () => {
    const company = provider._toCompany(SEARCH_RESULT, detail, '飲食');
    expect(company.phone).toBe('03-9999-9999');
  });
});

// ─── _calcLeadScore ───────────────────────────────────────────────────────────

describe('GoogleMapsProvider._calcLeadScore', () => {
  const provider = new GoogleMapsProvider({ client: makeClient(), delayMs: 0 });

  it('rating が null のとき null を返す', () => {
    expect(provider._calcLeadScore(null, 100)).toBeNull();
  });

  it('rating が 0 のとき null を返す（falsy）', () => {
    expect(provider._calcLeadScore(0, 100)).toBeNull();
  });

  it('rating 4.0 / 100 件のスコアを正しく算出する', () => {
    // 4.0 * 10 + log10(100) * 10 = 40 + 20 = 60
    expect(provider._calcLeadScore(4.0, 100)).toBe(60);
  });

  it('評価数が 1 件でも動作する（log10(1) = 0）', () => {
    // 5.0 * 10 + 0 = 50
    expect(provider._calcLeadScore(5.0, 1)).toBe(50);
  });

  it('レビュースコアは 50 を超えない（対数キャップ）', () => {
    // log10(10_000_000) * 10 = 70 → cap 50 → 5.0 * 10 + 50 = 100
    expect(provider._calcLeadScore(5.0, 10_000_000)).toBe(100);
  });

  it('userRatingsTotal が null のとき 1 として扱われる', () => {
    expect(provider._calcLeadScore(4.0, null)).toBe(40);
  });

  it('結果が整数に丸められる', () => {
    const score = provider._calcLeadScore(3.3, 50);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ─── _collectSearchResults ────────────────────────────────────────────────────

describe('GoogleMapsProvider._collectSearchResults', () => {
  it('nextPageToken があるとき 2 ページ目を取得する', async () => {
    const page1 = [{ ...SEARCH_RESULT, placeId: 'p1', name: '企業1' }];
    const page2 = [{ ...SEARCH_RESULT, placeId: 'p2', name: '企業2' }];

    const client = {
      apiKey: 'test_key',
      textSearch: vi
        .fn()
        .mockResolvedValueOnce({ results: page1, nextPageToken: 'tok_abc' })
        .mockResolvedValueOnce({ results: page2, nextPageToken: null }),
      getDetail: vi.fn(),
    };

    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const results = await provider._collectSearchResults('飲食 東京', 10);

    expect(results).toHaveLength(2);
    expect(client.textSearch).toHaveBeenCalledTimes(2);
    expect(client.textSearch).toHaveBeenNthCalledWith(2, '飲食 東京', 'tok_abc');
  });

  it('limit に達したらページネーションを打ち切る', async () => {
    const page1 = Array.from({ length: 3 }, (_, i) => ({
      ...SEARCH_RESULT,
      placeId: `p${i}`,
    }));

    const client = {
      apiKey: 'test_key',
      textSearch: vi.fn().mockResolvedValue({ results: page1, nextPageToken: 'tok_more' }),
      getDetail: vi.fn(),
    };

    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const results = await provider._collectSearchResults('飲食 東京', 3);

    expect(results).toHaveLength(3);
    expect(client.textSearch).toHaveBeenCalledTimes(1);
  });

  it('limit より多い結果はスライスされる', async () => {
    const page1 = Array.from({ length: 5 }, (_, i) => ({
      ...SEARCH_RESULT,
      placeId: `p${i}`,
    }));

    const client = {
      apiKey: 'test_key',
      textSearch: vi.fn().mockResolvedValue({ results: page1, nextPageToken: null }),
      getDetail: vi.fn(),
    };

    const provider = new GoogleMapsProvider({ client, delayMs: 0 });
    const results = await provider._collectSearchResults('飲食 東京', 2);

    expect(results).toHaveLength(2);
  });
});
