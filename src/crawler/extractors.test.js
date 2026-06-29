import { describe, it, expect } from 'vitest';
import {
  resolveUrl,
  extractEmails,
  extractEmail,
  extractContactFormUrl,
  extractDescription,
  extractInstagram,
  extractTikTok,
  extractEmployeeCount,
  extractStoreCount,
  extractAll,
} from './extractors.js';

const BASE = 'https://example.co.jp';

// ─── resolveUrl ───────────────────────────────────────────────────────────────

describe('resolveUrl', () => {
  it('ルート相対パスを絶対URLに解決する', () => {
    expect(resolveUrl('/contact', BASE)).toBe('https://example.co.jp/contact');
  });

  it('絶対URLはそのまま返す', () => {
    expect(resolveUrl('https://other.co.jp/form', BASE)).toBe('https://other.co.jp/form');
  });

  it('空文字は "" を返す', () => {
    expect(resolveUrl('', BASE)).toBe('');
  });

  it('無効な href は "" を返す', () => {
    expect(resolveUrl('javascript:void(0)', BASE)).toBe('');
  });
});

// ─── extractEmails ────────────────────────────────────────────────────────────

describe('extractEmails', () => {
  it('mailto: リンクのメールアドレスを配列で返す', () => {
    const html = '<a href="mailto:info@example.co.jp">メール</a>';
    expect(extractEmails(html)).toEqual(['info@example.co.jp']);
  });

  it('複数の mailto: リンクをすべて返す', () => {
    const html = `
      <a href="mailto:info@example.co.jp">メール1</a>
      <a href="mailto:contact@example.co.jp">メール2</a>
    `;
    const result = extractEmails(html);
    expect(result).toContain('info@example.co.jp');
    expect(result).toContain('contact@example.co.jp');
  });

  it('テキスト内のメールアドレスも含める', () => {
    const html = '<p>メール: support@example.co.jp まで</p>';
    expect(extractEmails(html)).toContain('support@example.co.jp');
  });

  it('重複するアドレスは除去する', () => {
    const html = `
      <a href="mailto:info@example.co.jp">mailto</a>
      <p>info@example.co.jp</p>
    `;
    expect(extractEmails(html)).toHaveLength(1);
  });

  it('メールが存在しなければ空配列を返す', () => {
    expect(extractEmails('<p>電話でのお問い合わせ</p>')).toEqual([]);
  });

  it('画像ファイル名パターンは除外する', () => {
    const html = '<img src="logo@2x.png">';
    expect(extractEmails(html)).toEqual([]);
  });

  it('mailto: の query string を除いたアドレスを返す', () => {
    const html = '<a href="mailto:info@example.co.jp?subject=test">mail</a>';
    expect(extractEmails(html)).toContain('info@example.co.jp');
  });
});

// ─── extractEmail ─────────────────────────────────────────────────────────────

describe('extractEmail', () => {
  it('mailto: リンクからメールアドレスを抽出する', () => {
    const html = '<a href="mailto:info@example.co.jp">お問い合わせ</a>';
    expect(extractEmail(html)).toBe('info@example.co.jp');
  });

  it('mailto: に query string があっても正しく抽出する', () => {
    const html = '<a href="mailto:info@example.co.jp?subject=test">mail</a>';
    expect(extractEmail(html)).toBe('info@example.co.jp');
  });

  it('シングルクォートの mailto: にも対応する', () => {
    const html = "<a href='mailto:contact@example.co.jp'>メール</a>";
    expect(extractEmail(html)).toBe('contact@example.co.jp');
  });

  it('mailto: がなければテキスト内のメールを返す', () => {
    const html = '<p>メール: info@example.co.jp まで</p>';
    expect(extractEmail(html)).toBe('info@example.co.jp');
  });

  it('メールが存在しなければ "" を返す', () => {
    const html = '<p>連絡先はお電話にて</p>';
    expect(extractEmail(html)).toBe('');
  });

  it('タグ属性に含まれる偽メールパターンにヒットしない（mailto: を優先する）', () => {
    const html = '<img src="logo@2x.png"><a href="mailto:real@example.co.jp">mail</a>';
    expect(extractEmail(html)).toBe('real@example.co.jp');
  });
});

// ─── extractContactFormUrl ────────────────────────────────────────────────────

describe('extractContactFormUrl', () => {
  it('href に "contact" を含むリンクを返す', () => {
    const html = '<a href="/contact">Contact</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('https://example.co.jp/contact');
  });

  it('href に "inquiry" を含むリンクを返す', () => {
    const html = '<a href="/inquiry">Inquiry</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('https://example.co.jp/inquiry');
  });

  it('リンクテキストが "お問い合わせ" のリンクを返す', () => {
    const html = '<a href="/form">お問い合わせ</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('https://example.co.jp/form');
  });

  it('リンクテキストが "ご相談" のリンクを返す', () => {
    const html = '<a href="/consult">ご相談</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('https://example.co.jp/consult');
  });

  it('絶対URLのコンタクトリンクを返す', () => {
    const html = '<a href="https://example.co.jp/inquiry">お問い合わせ</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('https://example.co.jp/inquiry');
  });

  it('コンタクト系リンクがなければ "" を返す', () => {
    const html = '<a href="/products">製品一覧</a><a href="/about">会社概要</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('');
  });

  it('# アンカーはスキップする（コンタクトページではない）', () => {
    const html =
      '<a href="#contact-form">お問い合わせ</a><a href="/contact">お問い合わせページ</a>';
    expect(extractContactFormUrl(html, BASE)).toBe('https://example.co.jp/contact');
  });
});

// ─── extractDescription ───────────────────────────────────────────────────────

describe('extractDescription', () => {
  it('<meta name="description"> から説明を抽出する', () => {
    const html = '<meta name="description" content="テスト会社の公式サイトです。">';
    expect(extractDescription(html)).toBe('テスト会社の公式サイトです。');
  });

  it('属性順が逆（content が先）でも抽出する', () => {
    const html = '<meta content="コンテンツ先のdescription" name="description">';
    expect(extractDescription(html)).toBe('コンテンツ先のdescription');
  });

  it('meta name="description" がなければ og:description を返す', () => {
    const html = '<meta property="og:description" content="OG の説明文です。">';
    expect(extractDescription(html)).toBe('OG の説明文です。');
  });

  it('og:description も属性逆順に対応する', () => {
    const html = '<meta content="OG逆順" property="og:description">';
    expect(extractDescription(html)).toBe('OG逆順');
  });

  it('name="description" が優先される（og:description より先に返す）', () => {
    const html = `
      <meta name="description" content="通常description">
      <meta property="og:description" content="OGdescription">
    `;
    expect(extractDescription(html)).toBe('通常description');
  });

  it('前後の空白をトリムする', () => {
    const html = '<meta name="description" content="  空白あり  ">';
    expect(extractDescription(html)).toBe('空白あり');
  });

  it('description が存在しなければ "" を返す', () => {
    expect(extractDescription('<html><body><p>説明なし</p></body></html>')).toBe('');
  });
});

// ─── extractInstagram ─────────────────────────────────────────────────────────

describe('extractInstagram', () => {
  it('www.instagram.com の URL を抽出する', () => {
    const html = '<a href="https://www.instagram.com/example_jp">Instagram</a>';
    expect(extractInstagram(html)).toBe('https://www.instagram.com/example_jp');
  });

  it('末尾のスラッシュを除去する', () => {
    const html = '<a href="https://instagram.com/example_jp/">Follow us</a>';
    expect(extractInstagram(html)).toBe('https://instagram.com/example_jp');
  });

  it('投稿 URL（/p/）はマッチしない', () => {
    const html = '<a href="https://www.instagram.com/p/abc123">Post</a>';
    expect(extractInstagram(html)).toBe('');
  });

  it('リール URL（/reel/）はマッチしない', () => {
    const html = '<a href="https://www.instagram.com/reel/xyz">Reel</a>';
    expect(extractInstagram(html)).toBe('');
  });

  it('Instagram リンクがなければ "" を返す', () => {
    expect(extractInstagram('<p>No social</p>')).toBe('');
  });
});

// ─── extractTikTok ────────────────────────────────────────────────────────────

describe('extractTikTok', () => {
  it('tiktok.com/@ の URL を抽出する', () => {
    const html = '<a href="https://www.tiktok.com/@example_shop">TikTok</a>';
    expect(extractTikTok(html)).toBe('https://www.tiktok.com/@example_shop');
  });

  it('末尾のスラッシュを除去する', () => {
    const html = '<a href="https://tiktok.com/@brand/">Follow</a>';
    expect(extractTikTok(html)).toBe('https://tiktok.com/@brand');
  });

  it('TikTok リンクがなければ "" を返す', () => {
    expect(extractTikTok('<p>Hello</p>')).toBe('');
  });
});

// ─── extractEmployeeCount ─────────────────────────────────────────────────────

describe('extractEmployeeCount', () => {
  it('「従業員数：500名」を抽出する', () => {
    expect(extractEmployeeCount('<td>従業員数：500名</td>')).toBe(500);
  });

  it('「従業員数 : 1,200名」（カンマ区切り）を抽出する', () => {
    expect(extractEmployeeCount('<td>従業員数 : 1,200名</td>')).toBe(1200);
  });

  it('「社員数：50人」を抽出する', () => {
    expect(extractEmployeeCount('<p>社員数：50人</p>')).toBe(50);
  });

  it('「スタッフ数：30名」を抽出する', () => {
    expect(extractEmployeeCount('<p>スタッフ数：30名</p>')).toBe(30);
  });

  it('「約300名の従業員」を抽出する', () => {
    expect(extractEmployeeCount('<p>約300名の従業員が働いています</p>')).toBe(300);
  });

  it('「従業員数 約 2,000 名」（全角スペース区切り）を抽出する', () => {
    expect(extractEmployeeCount('<td>従業員数　2,000名</td>')).toBe(2000);
  });

  it('情報がなければ null を返す', () => {
    expect(extractEmployeeCount('<p>会社概要</p>')).toBeNull();
  });
});

// ─── extractStoreCount ───────────────────────────────────────────────────────

describe('extractStoreCount', () => {
  it('「店舗数：25」を抽出する', () => {
    expect(extractStoreCount('<td>店舗数：25</td>')).toBe(25);
  });

  it('「全国25店舗」を抽出する', () => {
    expect(extractStoreCount('<p>全国25店舗を展開中です</p>')).toBe(25);
  });

  it('「10店舗展開」を抽出する', () => {
    expect(extractStoreCount('<p>現在10店舗展開しています</p>')).toBe(10);
  });

  it('「直営店：5店舗」を抽出する', () => {
    expect(extractStoreCount('<td>直営店：5店舗</td>')).toBe(5);
  });

  it('情報がなければ null を返す', () => {
    expect(extractStoreCount('<p>事業概要</p>')).toBeNull();
  });
});

// ─── extractAll ───────────────────────────────────────────────────────────────

describe('extractAll', () => {
  it('全フィールドをまとめて抽出する', () => {
    const html = `
      <a href="mailto:info@example.co.jp">メール</a>
      <a href="/contact">お問い合わせ</a>
      <a href="https://www.instagram.com/example_jp">Instagram</a>
      <a href="https://www.tiktok.com/@example">TikTok</a>
      <td>従業員数：100名</td>
      <td>店舗数：5</td>
    `;
    const result = extractAll(html, BASE);
    expect(result.email).toBe('info@example.co.jp');
    expect(result.contactFormUrl).toBe('https://example.co.jp/contact');
    expect(result.instagram).toBe('https://www.instagram.com/example_jp');
    expect(result.tiktok).toBe('https://www.tiktok.com/@example');
    expect(result.employeeCount).toBe(100);
    expect(result.storeCount).toBe(5);
  });

  it('情報がない場合は空値を返す', () => {
    const result = extractAll('<p>Hello</p>', BASE);
    expect(result.email).toBe('');
    expect(result.contactFormUrl).toBe('');
    expect(result.instagram).toBe('');
    expect(result.tiktok).toBe('');
    expect(result.employeeCount).toBeNull();
    expect(result.storeCount).toBeNull();
  });
});
