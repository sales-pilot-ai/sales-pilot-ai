import { describe, it, expect } from 'vitest';
import { GoogleMapsProvider } from './google-maps.js';

describe('GoogleMapsProvider', () => {
  it('name が "GoogleMaps"', () => {
    expect(new GoogleMapsProvider().name).toBe('GoogleMaps');
  });

  it('find() が配列を resolve する（スタブ: 空配列）', async () => {
    const result = await new GoogleMapsProvider().find('IT', '東京', 5);
    expect(Array.isArray(result)).toBe(true);
  });

  it('find() が引数を受け取っても reject しない', async () => {
    await expect(new GoogleMapsProvider().find('飲食店', '渋谷区', 10)).resolves.toBeDefined();
  });

  // TODO: Phase 2 実装後 — Places API レスポンスから Company を生成できることを検証
  // TODO: Phase 2 実装後 — limit を超えた件数を返さないことを検証
  // TODO: Phase 2 実装後 — leadScore が評価数・評点から計算されることを検証
});
