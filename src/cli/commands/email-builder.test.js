import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../../personalizer/index.js', () => ({
  createPersonalizedContent: vi.fn(),
}));

vi.mock('../../config/index.js', () => ({
  env: {
    gmailName: 'テスト太郎',
    gmailFrom: 'test@example.com',
    meetingUrl: 'https://cal.example.com',
  },
}));

// テンプレートファイルの fs アクセスをモックしない（buildEmailContent の引数でテンプレートを渡す）

import { createPersonalizedContent } from '../../personalizer/index.js';
import { buildTextSignature, buildHtmlSignature, buildEmailContent } from './email-builder.js';

// ─── セットアップ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  createPersonalizedContent.mockResolvedValue({ introText: 'テスト紹介文' });
});

// ─── buildTextSignature ───────────────────────────────────────────────────────

describe('buildTextSignature', () => {
  it('-- から始まる署名を返す', () => {
    const sig = buildTextSignature();
    expect(sig.startsWith('--')).toBe(true);
  });

  it('gmailName と gmailFrom を含む', () => {
    const sig = buildTextSignature();
    expect(sig).toContain('テスト太郎');
    expect(sig).toContain('test@example.com');
  });
});

// ─── buildHtmlSignature ───────────────────────────────────────────────────────

describe('buildHtmlSignature', () => {
  it('gmailName を strong タグで含む', () => {
    const sig = buildHtmlSignature();
    expect(sig).toContain('<strong>テスト太郎</strong>');
  });

  it('gmailFrom を a タグで含む', () => {
    const sig = buildHtmlSignature();
    expect(sig).toContain('test@example.com');
    expect(sig).toContain('<a href="mailto:');
  });
});

// ─── buildEmailContent ────────────────────────────────────────────────────────

describe('buildEmailContent', () => {
  const company = {
    companyName: '株式会社サンプル',
    contactName: '田中',
    email: 'tanaka@sample.co.jp',
    industry: '美容',
  };

  const templates = {
    textTemplate: 'こんにちは{{contactName}}様。{{introText}}',
    htmlTemplate: null,
    subjectTemplate: null,
  };

  it('createPersonalizedContent を 1 回呼ぶ', async () => {
    await buildEmailContent(company, templates);
    expect(createPersonalizedContent).toHaveBeenCalledTimes(1);
    expect(createPersonalizedContent).toHaveBeenCalledWith(company);
  });

  it('subjectTemplate が null のときデフォルト件名を使う', async () => {
    const { subject } = await buildEmailContent(company, templates);
    expect(subject).toContain('株式会社サンプル');
    expect(subject).toContain('営業効率化');
  });

  it('subjectTemplate がある場合は変数を置換して使う', async () => {
    const tpl = { ...templates, subjectTemplate: '{{companyName}}へのご提案' };
    const { subject } = await buildEmailContent(company, tpl);
    expect(subject).toBe('株式会社サンプルへのご提案');
  });

  it('textBody にテンプレート変数が置換される', async () => {
    const { textBody } = await buildEmailContent(company, templates);
    expect(textBody).toContain('田中様');
    expect(textBody).toContain('テスト紹介文');
  });

  it('textBody の末尾に署名を含む', async () => {
    const { textBody } = await buildEmailContent(company, templates);
    expect(textBody).toContain('--');
    expect(textBody).toContain('テスト太郎');
  });

  it('htmlTemplate が null のとき htmlBody は undefined', async () => {
    const { htmlBody } = await buildEmailContent(company, templates);
    expect(htmlBody).toBeUndefined();
  });

  it('htmlTemplate がある場合は htmlBody を返す', async () => {
    const tpl = {
      ...templates,
      htmlTemplate: '<body>{{companyName}}</body>',
    };
    const { htmlBody } = await buildEmailContent(company, tpl);
    expect(htmlBody).toContain('株式会社サンプル');
  });

  it('contactName がない場合は "ご担当者" を使う', async () => {
    const noContact = { ...company, contactName: '' };
    const { textBody } = await buildEmailContent(noContact, templates);
    expect(textBody).toContain('ご担当者様');
  });
});
