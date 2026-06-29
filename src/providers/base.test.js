import { describe, it, expect } from 'vitest';
import { BaseProvider } from './base.js';
import { GoogleMapsProvider } from './google-maps.js';
import { GoogleSearchProvider } from './google-search.js';
import { WebsiteProvider } from './website.js';
import { createSearchOptions } from '../models/search-options.js';

// ─── 共通契約テスト ───────────────────────────────────────────────────────────
// 全 Provider が満たすべきインターフェースを検証する。
// 新しい Provider を追加する際はここに追加すること。

/**
 * 全 Provider が満たすべき共通インターフェース契約。
 * find() の戻り値（resolve/reject）は Provider ごとに異なるためここでは検証しない。
 * @param {new () => BaseProvider} Provider
 */
function itBehavesLikeProvider(Provider) {
  it('BaseProvider のサブクラスである', () => {
    expect(new Provider()).toBeInstanceOf(BaseProvider);
  });

  it('name プロパティが空でない文字列', () => {
    const provider = new Provider();
    expect(typeof provider.name).toBe('string');
    expect(provider.name.length).toBeGreaterThan(0);
  });

  it('find() が Promise を返す', async () => {
    const provider = new Provider();
    const result = provider.find(createSearchOptions({ industry: 'IT', area: '東京', limit: 10 }));
    expect(result).toBeInstanceOf(Promise);
    await result.catch(() => {}); // 未処理 rejection を抑制
  });
}

// ─── BaseProvider ─────────────────────────────────────────────────────────────

describe('BaseProvider', () => {
  it('直接インスタンス化すると TypeError を投げる', () => {
    expect(() => new BaseProvider('test')).toThrow(TypeError);
  });

  it('直接インスタンス化のエラーメッセージに "直接インスタンス化" が含まれる', () => {
    expect(() => new BaseProvider('test')).toThrow('直接インスタンス化');
  });

  it('サブクラスは正常にインスタンス化できる', () => {
    class ConcreteProvider extends BaseProvider {
      constructor() {
        super('Concrete');
      }
    }
    expect(() => new ConcreteProvider()).not.toThrow();
  });

  it('find() をオーバーライドしなければエラーを投げる', async () => {
    class IncompleteProvider extends BaseProvider {
      constructor() {
        super('Incomplete');
      }
    }
    const provider = new IncompleteProvider();
    await expect(provider.find('IT', '東京', 10)).rejects.toThrow(
      'IncompleteProvider.find() は未実装です'
    );
  });

  it('find() をオーバーライドした場合は正常に動作する', async () => {
    class WorkingProvider extends BaseProvider {
      constructor() {
        super('Working');
      }
      async find(_options) {
        return [];
      }
    }
    const provider = new WorkingProvider();
    await expect(
      provider.find(createSearchOptions({ industry: 'IT', area: '東京', limit: 10 }))
    ).resolves.toEqual([]);
  });
});

// ─── 全 Provider の契約テスト ─────────────────────────────────────────────────

describe('GoogleMapsProvider — 共通契約', () => {
  itBehavesLikeProvider(GoogleMapsProvider);
});

describe('GoogleMapsProvider — 固有動作', () => {
  it('apiKey 未設定のとき find() が reject する', async () => {
    const provider = new GoogleMapsProvider({ client: { apiKey: '' }, delayMs: 0 });
    await expect(
      provider.find(createSearchOptions({ industry: '飲食店', area: '東京都渋谷区', limit: 10 }))
    ).rejects.toThrow('GOOGLE_MAPS_API_KEY');
  });

  it('name が "GoogleMaps"', () => {
    expect(new GoogleMapsProvider().name).toBe('GoogleMaps');
  });
});

describe('GoogleSearchProvider — 共通契約', () => {
  itBehavesLikeProvider(GoogleSearchProvider);
});

describe('GoogleSearchProvider — 固有動作', () => {
  it('find() が配列を resolve する（スタブ: 空配列）', async () => {
    const provider = new GoogleSearchProvider();
    const result = await provider.find('美容室', '大阪府', 5);
    expect(Array.isArray(result)).toBe(true);
  });

  it('name が "GoogleSearch"', () => {
    expect(new GoogleSearchProvider().name).toBe('GoogleSearch');
  });
});

describe('WebsiteProvider — 共通契約', () => {
  itBehavesLikeProvider(WebsiteProvider);
});

describe('WebsiteProvider — 固有動作', () => {
  it('find() が未実装エラーを reject する', async () => {
    const provider = new WebsiteProvider();
    await expect(provider.find('IT', '東京', 10)).rejects.toThrow('未実装');
  });
});
