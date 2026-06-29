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

// トップページ: email あり + contactFormUrl あり + description あり
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

// トップページ: email なし + contactFormUrl あり + description あり
const TOP_NO_EMAIL = `
<html>
<head>
  <meta name="description" content="トップページの概要です。">
</head>
<body>
  <a href="/contact">お問い合わせ</a>
</body>
</html>
`;

// トップページ: email なし + contactFormUrl なし + description あり
const TOP_NO_EMAIL_NO_CONTACT = `
<html>
<head>
  <meta name="description" content="トップページの概要です。">
</head>
<body>
  <p>電話でのお問い合わせのみ受け付けています。</p>
</body>
</html>
`;

// お問い合わせページ: email あり
const CONTACT_HTML = `
<html>
<body>
  <a href="mailto:contact@example.co.jp">メールでのお問い合わせ</a>
  <form action="/send"><input type="submit" value="送信"></form>
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

  // ── 2 ページ目の巡回（Issue #010） ───────────────────────────────────────────

  it('トップページに email があれば お問い合わせページを fetch しない', async () => {
    // FULL_HTML には email が含まれるので 2 ページ目は不要
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('email 未取得 かつ contactFormUrl あり → お問い合わせページを fetch する', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL));
      if (url === 'https://example.co.jp/contact') return Promise.resolve(okHtml(CONTACT_HTML));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://example.co.jp');
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://example.co.jp/contact');
  });

  it('お問い合わせページから email を補完する', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL));
      if (url === 'https://example.co.jp/contact') return Promise.resolve(okHtml(CONTACT_HTML));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result.email).toBe('contact@example.co.jp');
  });

  it('contactFormUrl がなければ お問い合わせページを fetch しない', async () => {
    mockFetch.mockResolvedValue(okHtml(TOP_NO_EMAIL_NO_CONTACT));
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('company.email が既にある場合は お問い合わせページを fetch しない', async () => {
    // TOP_NO_EMAIL には contactFormUrl があるが、company.email は設定済み
    mockFetch.mockResolvedValue(okHtml(TOP_NO_EMAIL));
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      email: 'existing@example.co.jp',
    });
    await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('お問い合わせページの HTTP エラーでも トップページのパッチは適用する', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL));
      if (url === 'https://example.co.jp/contact') return Promise.resolve(httpError(500));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    // トップページの contactFormUrl と memo は補完される
    expect(result.contactFormUrl).toBe('https://example.co.jp/contact');
    expect(result.memo).toBe('トップページの概要です。');
    // email は取得できない
    expect(result.email).toBe('');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('お問い合わせページ'));
  });

  it('お問い合わせページの fetch 例外でも トップページのパッチは適用する', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL));
      if (url === 'https://example.co.jp/contact')
        return Promise.reject(new Error('Connection refused'));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result.contactFormUrl).toBe('https://example.co.jp/contact');
    expect(result.memo).toBe('トップページの概要です。');
    expect(result.email).toBe('');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('お問い合わせページ'));
  });

  it('トップページで取得した memo は お問い合わせページ巡回後も保持される', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL));
      if (url === 'https://example.co.jp/contact') return Promise.resolve(okHtml(CONTACT_HTML));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    const result = await analyzer.analyze(company);
    expect(result.memo).toBe('トップページの概要です。');
    expect(result.email).toBe('contact@example.co.jp');
  });

  it('company.contactFormUrl が既にある場合はそれを 2 ページ目として使う', async () => {
    // トップページ: email なし・contactFormUrl なし（HTML からは抽出されない）
    // company.contactFormUrl が既にセット済み
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL_NO_CONTACT));
      if (url === 'https://example.co.jp/form') return Promise.resolve(okHtml(CONTACT_HTML));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    const company = createCompany({
      companyName: 'テスト',
      websiteUrl: 'https://example.co.jp',
      contactFormUrl: 'https://example.co.jp/form',
    });
    const result = await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.email).toBe('contact@example.co.jp');
  });

  it('合計 2 ページのみ fetch する（3 ページ目は fetch しない）', async () => {
    // お問い合わせページに別の contactFormUrl があっても追加で fetch しない
    const contactWithAnotherLink = `
      <html><body>
        <a href="mailto:contact@example.co.jp">メール</a>
        <a href="/another-contact">別のお問い合わせ</a>
      </body></html>
    `;
    mockFetch.mockImplementation((url) => {
      if (url === 'https://example.co.jp') return Promise.resolve(okHtml(TOP_NO_EMAIL));
      if (url === 'https://example.co.jp/contact')
        return Promise.resolve(okHtml(contactWithAnotherLink));
      return Promise.reject(new Error(`3 ページ目は fetch してはいけない: ${url}`));
    });
    const company = createCompany({ companyName: 'テスト', websiteUrl: 'https://example.co.jp' });
    await analyzer.analyze(company);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
