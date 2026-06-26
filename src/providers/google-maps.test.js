import { describe, it, expect } from 'vitest';
import { GoogleMapsProvider } from './google-maps.js';

describe('GoogleMapsProvider', () => {
  it('name が "GoogleMaps"', () => {
    expect(new GoogleMapsProvider().name).toBe('GoogleMaps');
  });

  it('find() のエラーメッセージに "GoogleMapsProvider" が含まれる', async () => {
    await expect(new GoogleMapsProvider().find('IT', '東京', 5)).rejects.toThrow(
      'GoogleMapsProvider'
    );
  });

  it('find() のエラーメッセージに "Phase 2" が含まれる', async () => {
    await expect(new GoogleMapsProvider().find('IT', '東京', 5)).rejects.toThrow('Phase 2');
  });

  // TODO: Phase 2 実装後 — Places API レスポンスから Company を生成できることを検証
  // TODO: Phase 2 実装後 — limit を超えた件数を返さないことを検証
  // TODO: Phase 2 実装後 — leadScore が評価数・評点から計算されることを検証
});
