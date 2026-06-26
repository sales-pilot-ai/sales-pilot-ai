import { describe, it, expect } from 'vitest';
import { WebsiteProvider } from './website.js';

describe('WebsiteProvider', () => {
  it('name が "Website"', () => {
    expect(new WebsiteProvider().name).toBe('Website');
  });

  it('find() のエラーメッセージに "WebsiteProvider" が含まれる', async () => {
    await expect(new WebsiteProvider().find('小売業', '名古屋', 5)).rejects.toThrow(
      'WebsiteProvider'
    );
  });

  it('find() のエラーメッセージに "Phase 2" が含まれる', async () => {
    await expect(new WebsiteProvider().find('小売業', '名古屋', 5)).rejects.toThrow('Phase 2');
  });

  // TODO: Phase 2 実装後 — URL リストを渡してメールアドレスを抽出できることを検証
  // TODO: Phase 2 実装後 — お問い合わせフォームURL・SNS リンクを抽出できることを検証
  // TODO: Phase 2 実装後 — Playwright が headless で動作することを E2E テストで検証
});
