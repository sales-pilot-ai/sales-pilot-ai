import { describe, it, expect } from 'vitest';
import { GoogleSearchProvider } from './google-search.js';

describe('GoogleSearchProvider', () => {
  it('name が "GoogleSearch"', () => {
    expect(new GoogleSearchProvider().name).toBe('GoogleSearch');
  });

  it('find() が配列を resolve する（スタブ: 空配列）', async () => {
    const result = await new GoogleSearchProvider().find('飲食業', '大阪', 10);
    expect(Array.isArray(result)).toBe(true);
  });

  it('find() が引数を受け取っても reject しない', async () => {
    await expect(
      new GoogleSearchProvider().find('美容室', '東京都新宿区', 20)
    ).resolves.toBeDefined();
  });

  // TODO: Phase 2 実装後 — Custom Search レスポンスから Company を生成できることを検証
  // TODO: Phase 2 実装後 — limit を超えた件数を返さないことを検証
});
