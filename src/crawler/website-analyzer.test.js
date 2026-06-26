import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompany } from '../models/company.js';
import { WebsiteAnalyzer, buildPatches, applyPatches } from './website-analyzer.js';

// ─── Playwright モック ────────────────────────────────────────────────────────
// vi.mock はファイル先頭に巻き上げられるため、vi.hoisted で変数を先行定義する

const { MAIN_HTML, CONTACT_HTML } = vi.hoisted(() => ({
  MAIN_HTML: `
<html><body>
  <a href="mailto:info@example.co.jp">メール</a>
  <a href="/contact">お問い合わせ</a>
  <a href="https://www.instagram.com/example_jp">Instagram</a>
  <a href="https://www.tiktok.com/@example">TikTok</a>
  <td>従業員数：100名</td>
  <td>全国5店舗</td>
</body></html>
`,
  CONTACT_HTML: `
<html><body>
  <a href="mailto:contact@example.co.jp">直接メール</a>
  <form action="/send"><input type="text" name="name"></form>
</body></html>
`,
}));

vi.mock('playwright', () => {
  const mockPage = {
    setDefaultTimeout: vi.fn(),
    goto: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue(MAIN_HTML),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  };
});

// ─── buildPatches ─────────────────────────────────────────────────────────────

describe('buildPatches', () => {
  it('空のフィールドにのみパッチを当てる', () => {
    const company = createCompany({ companyName: 'テスト' });
    const raw = {
      email: 'info@example.co.jp',
      contactFormUrl: 'https://example.co.jp/contact',
      instagram: 'https://www.instagram.com/example',
      tiktok: '',
      employeeCount: 50,
      storeCount: null,
    };
    const patches = buildPatches(company, raw);
    expect(patches.email).toBe('info@example.co.jp');
    expect(patches.contactFormUrl).toBe('https://example.co.jp/contact');
    expect(patches.instagram).toBe('https://www.instagram.com/example');
    expect(patches).not.toHaveProperty('tiktok');
    expect(patches.employeeCount).toBe(50);
    expect(patches).not.toHaveProperty('storeCount');
  });

  it('既に値があるフィールドは上書きしない', () => {
    const company = createCompany({
      companyName: 'テスト',
      email: 'existing@example.co.jp',
    });
    const patches = buildPatches(company, { email: 'new@example.co.jp' });
    expect(patches).not.toHaveProperty('email');
  });

  it('全フィールドが埋まっていれば空オブジェクトを返す', () => {
    const company = createCompany({
      companyName: 'テスト',
      email: 'info@example.co.jp',
      contactFormUrl: 'https://example.co.jp/contact',
      instagram: 'https://www.instagram.com/example',
      tiktok: 'https://www.tiktok.com/@example',
      employeeCount: 50,
      storeCount: 3,
    });
    const raw = {
      email: 'other@example.co.jp',
      contactFormUrl: 'https://example.co.jp/form',
      instagram: 'https://www.instagram.com/other',
      tiktok: 'https://www.tiktok.com/@other',
      employeeCount: 99,
      storeCount: 10,
    };
    expect(buildPatches(company, raw)).toEqual({});
  });
});

// ─── applyPatches ─────────────────────────────────────────────────────────────

describe('applyPatches', () => {
  it('patches を Company に適用した新しい Company を返す', () => {
    const company = createCompany({ companyName: 'テスト' });
    const result = applyPatches(company, { email: 'info@example.co.jp' });
    expect(result.email).toBe('info@example.co.jp');
    expect(result.companyName).toBe('テスト'); // 他フィールドは保持
  });

  it('patches が空なら元の Company をそのまま返す（同一参照）', () => {
    const company = createCompany({ companyName: 'テスト' });
    const result = applyPatches(company, {});
    expect(result).toBe(company);
  });

  it('元の Company は変更されない（immutable）', () => {
    const company = createCompany({ companyName: 'テスト' });
    applyPatches(company, { email: 'new@example.co.jp' });
    expect(company.email).toBe('');
  });
});

// ─── WebsiteAnalyzer ─────────────────────────────────────────────────────────

describe('WebsiteAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new WebsiteAnalyzer({ headless: true });
    vi.clearAllMocks();
  });

  // ── スキップ条件 ─────────────────────────────────────────────────────────────

  it('websiteUrl が空のとき Company をそのまま返す', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: '' });
    const result = await analyzer.analyze(company);
    expect(result).toBe(company);
  });

  it('全対象フィールドが補完済みのとき Playwright を起動しない', async () => {
    const { chromium } = await import('playwright');
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      email: 'a@a.com',
      contactFormUrl: 'https://example.co.jp/contact',
      instagram: 'https://www.instagram.com/x',
      tiktok: 'https://www.tiktok.com/@x',
      employeeCount: 10,
      storeCount: 2,
    });
    await analyzer.analyze(company);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  // ── analyzePage（モックページ注入）─────────────────────────────────────────

  it('メインページから全フィールドを補完できる', async () => {
    const mockPage = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(MAIN_HTML),
    };
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
    });
    const result = await analyzer.analyzePage(company, mockPage);
    expect(result.email).toBe('info@example.co.jp');
    expect(result.contactFormUrl).toBe('https://example.co.jp/contact');
    expect(result.instagram).toBe('https://www.instagram.com/example_jp');
    expect(result.tiktok).toBe('https://www.tiktok.com/@example');
    expect(result.employeeCount).toBe(100);
    expect(result.storeCount).toBe(5);
  });

  it('既に email がある場合は上書きしない', async () => {
    const mockPage = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(MAIN_HTML),
    };
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      email: 'kept@example.co.jp',
    });
    const result = await analyzer.analyzePage(company, mockPage);
    expect(result.email).toBe('kept@example.co.jp');
  });

  it('情報が取得できなくても元の Company を返す（エラーなし）', async () => {
    const mockPage = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue('<html><body><p>情報なし</p></body></html>'),
    };
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
    });
    const result = await analyzer.analyzePage(company, mockPage);
    expect(result.companyName).toBe('テスト');
    expect(result.email).toBe('');
  });

  it('コンタクトページからメールアドレスを補完する（2ページ訪問）', async () => {
    let callCount = 0;
    const mockPage = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockImplementation(async () => {
        callCount++;
        // 1回目: メインページ（contact リンクあり、email なし）
        // 2回目: コンタクトページ（email あり）
        return callCount === 1
          ? '<a href="/contact">お問い合わせ</a><p>会社概要</p>'
          : CONTACT_HTML;
      }),
    };
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
    });
    const result = await analyzer.analyzePage(company, mockPage);
    expect(result.email).toBe('contact@example.co.jp');
    expect(callCount).toBe(2); // 2ページ訪問された
  });

  it('visitContactPage: false のとき2ページ目を訪問しない', async () => {
    const noSubpageAnalyzer = new WebsiteAnalyzer({ visitContactPage: false });
    let callCount = 0;
    const mockPage = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockImplementation(async () => {
        callCount++;
        return '<a href="/contact">お問い合わせ</a>';
      }),
    };
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
    });
    await noSubpageAnalyzer.analyzePage(company, mockPage);
    expect(callCount).toBe(1); // メインページのみ
  });
});
