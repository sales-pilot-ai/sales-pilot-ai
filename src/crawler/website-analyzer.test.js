import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompany } from '../models/company.js';
import { WebsiteAnalyzer } from './website-analyzer.js';

// ─── モック設定 ────────────────────────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

const { logger } = await import('../utils/logger.js');

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function okHtml(html) {
  return { ok: true, text: () => Promise.resolve(html) };
}

function httpError(status) {
  return { ok: false, status };
}

const FULL_HTML = `
<html>
<head>
  <meta name="description" content="テスト会社の概要です。">
</head>
<body>
  <a href="mailto:info@example.co.jp">メール</a>
  <a href="/contact">お問い合わせ</a>
</body>
</html>
`;

// ─── WebsiteAnalyzer ─────────────────────────────────────────────────────────

describe('WebsiteAnalyzer.analyze', () => {
  let mockFetch;
  let analyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn().mockResolvedValue(okHtml(FULL_HTML));
    analyzer = new WebsiteAnalyzer({ fetchFn: mockFetch });
  });

  // ── スキップ条件 ──────────────────────────────────────────────────────────────

  it('websiteUrl が空のとき fetch を呼ばず元の Company を返す', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: '' });
    const result = await analyzer.analyze(company);
    expect(result).toBe(company);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── fetch 呼び出し ────────────────────────────────────────────────────────────

  it('fetch を websiteUrl で呼ぶ', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledWith('https://example.co.jp');
  });

  // ── 補完 ─────────────────────────────────────────────────────────────────────

  it('メールアドレスを company.email に補完する', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result.email).toBe('info@example.co.jp');
  });

  it('contactFormUrl を補完する', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result.contactFormUrl).toBe('https://example.co.jp/contact');
  });

  it('meta description を company.memo に補完する', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result.memo).toBe('テスト会社の概要です。');
  });

  // ── 既存値の保護 ──────────────────────────────────────────────────────────────

  it('既に email がある場合は上書きしない', async () => {
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      email: 'kept@example.co.jp',
    });
    const result = await analyzer.analyze(company);
    expect(result.email).toBe('kept@example.co.jp');
  });

  it('既に contactFormUrl がある場合は上書きしない', async () => {
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      contactFormUrl: 'https://example.co.jp/kept-form',
    });
    const result = await analyzer.analyze(company);
    expect(result.contactFormUrl).toBe('https://example.co.jp/kept-form');
  });

  it('既に memo がある場合は上書きしない', async () => {
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      memo: '既存メモ',
    });
    const result = await analyzer.analyze(company);
    expect(result.memo).toBe('既存メモ');
  });

  // ── エラー処理 ────────────────────────────────────────────────────────────────

  it('HTTP エラーのとき logger.warn を出力して元の Company を返す', async () => {
    mockFetch.mockResolvedValue(httpError(404));
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result).toBe(company);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('取得失敗'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('https://example.co.jp'));
  });

  it('fetch が例外を投げたとき logger.warn を出力して元の Company を返す', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result).toBe(company);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('取得失敗'));
  });

  // ── 同一参照・新オブジェクト ──────────────────────────────────────────────────

  it('補完対象がない場合は元の Company を返す（同一参照）', async () => {
    mockFetch.mockResolvedValue(okHtml('<html><body><p>情報なし</p></body></html>'));
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result).toBe(company);
  });

  it('補完した場合は新しい Company オブジェクトを返す', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result).not.toBe(company);
  });

  it('補完後も元の Company は変更されない（immutable）', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(company.email).toBe('');
  });

  // ── 補完ログ ──────────────────────────────────────────────────────────────────

  it('補完が発生したとき logger.info を出力する', async () => {
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('テスト'));
  });

  it('補完対象がない場合は logger.info を出力しない', async () => {
    mockFetch.mockResolvedValue(okHtml('<html><body></body></html>'));
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
