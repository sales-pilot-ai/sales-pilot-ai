import { describe, it, expect } from 'vitest';
import { GoogleSearchProvider } from './google-search.js';

describe('GoogleSearchProvider', () => {
  it('name が "GoogleSearch"', () => {
    expect(new GoogleSearchProvider().name).toBe('GoogleSearch');
  });

  it('find() のエラーメッセージに "GoogleSearchProvider" が含まれる', async () => {
    await expect(new GoogleSearchProvider().find('飲食業', '大阪', 10)).rejects.toThrow(
      'GoogleSearchProvider'
    );
  });

  it('find() のエラーメッセージに "Phase 2" が含まれる', async () => {
    await expect(new GoogleSearchProvider().find('飲食業', '大阪', 10)).rejects.toThrow('Phase 2');
  });

  // TODO: Phase 2 実装後 — Custom Search レスポンスから Company を生成できることを検証
  // TODO: Phase 2 実装後 — limit を超えた件数を返さないことを検証
});
