import { describe, it, expect } from 'vitest';
import { GoogleSearchProvider } from './google-search.js';
import { createSearchOptions } from '../models/search-options.js';

describe('GoogleSearchProvider', () => {
  it('name が "GoogleSearch"', () => {
    expect(new GoogleSearchProvider().name).toBe('GoogleSearch');
  });

  it('find() が配列を resolve する（スタブ: 空配列）', async () => {
    const result = await new GoogleSearchProvider().find(
      createSearchOptions({ industry: '飲食業', area: '大阪', limit: 10 })
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it('find() が SearchOptions を受け取っても reject しない', async () => {
    await expect(
      new GoogleSearchProvider().find(
        createSearchOptions({ industry: '美容室', area: '東京都新宿区', limit: 20 })
      )
    ).resolves.toBeDefined();
  });

  // TODO: Phase 2 実装後 — Custom Search レスポンスから Company を生成できることを検証
  // TODO: Phase 2 実装後 — limit を超えた件数を返さないことを検証
});
