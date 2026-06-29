import { describe, it, expect } from 'vitest';
import { buildMimeMessage, encodeMimeMessage } from './mime.js';

const BOUNDARY = 'test_boundary_abc123';
const BASE_OPTS = {
  from: 'from@example.com',
  to: 'to@example.com',
  subject: 'テスト件名',
  textBody: 'テキスト本文',
  htmlBody: '<p>HTML本文</p>',
  _boundary: BOUNDARY,
};

// ─── buildMimeMessage ─────────────────────────────────────────────────────────

describe('buildMimeMessage', () => {
  // ── ヘッダー ────────────────────────────────────────────────────────────────

  it('From ヘッダーを含む', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain('From: from@example.com');
  });

  it('To ヘッダーを含む', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain('To: to@example.com');
  });

  it('日本語件名を RFC 2047 でエンコードする', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    // =?utf-8?B?...?= 形式が含まれる
    expect(msg).toMatch(/Subject: =\?utf-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });

  it('ASCII のみの件名はエンコードしない', () => {
    const msg = buildMimeMessage({ ...BASE_OPTS, subject: 'ASCII Subject' });
    expect(msg).toContain('Subject: ASCII Subject');
  });

  it('MIME-Version: 1.0 を含む', () => {
    expect(buildMimeMessage(BASE_OPTS)).toContain('MIME-Version: 1.0');
  });

  // ── 添付なし: multipart/alternative ─────────────────────────────────────────

  it('添付なし → Content-Type: multipart/alternative', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain('Content-Type: multipart/alternative');
  });

  it('boundary がヘッダーと本文に含まれる', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain(`boundary="${BOUNDARY}"`);
    expect(msg).toContain(`--${BOUNDARY}`);
  });

  it('text/plain パートを含む', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain('Content-Type: text/plain; charset=utf-8');
  });

  it('text/html パートを含む', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain('Content-Type: text/html; charset=utf-8');
  });

  it('本文は base64 エンコードされている', () => {
    const msg = buildMimeMessage(BASE_OPTS);
    expect(msg).toContain('Content-Transfer-Encoding: base64');
    // "テキスト本文" の base64 を含む
    const b64text = Buffer.from('テキスト本文', 'utf-8').toString('base64');
    expect(msg).toContain(b64text);
  });

  it('textBody のみでも動作する', () => {
    const msg = buildMimeMessage({ ...BASE_OPTS, htmlBody: '' });
    expect(msg).toContain('text/plain');
    expect(msg).not.toContain('text/html');
  });

  it('htmlBody のみでも動作する', () => {
    const msg = buildMimeMessage({ ...BASE_OPTS, textBody: '' });
    expect(msg).toContain('text/html');
    expect(msg).not.toContain('text/plain');
  });

  // ── 添付あり: multipart/mixed ─────────────────────────────────────────────

  it('添付あり → Content-Type: multipart/mixed', () => {
    const msg = buildMimeMessage({
      ...BASE_OPTS,
      attachments: [
        {
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          data: Buffer.from('pdf content'),
        },
      ],
    });
    expect(msg).toContain('Content-Type: multipart/mixed');
  });

  it('添付ファイルの Content-Disposition が attachment になる', () => {
    const msg = buildMimeMessage({
      ...BASE_OPTS,
      attachments: [
        {
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          data: Buffer.from('dummy'),
        },
      ],
    });
    expect(msg).toContain('Content-Disposition: attachment');
    expect(msg).toContain('report.pdf');
  });

  it('添付あり → 内側に multipart/alternative パートを含む', () => {
    const msg = buildMimeMessage({
      ...BASE_OPTS,
      attachments: [{ filename: 'f.pdf', mimeType: 'application/pdf', data: Buffer.from('x') }],
    });
    expect(msg).toContain('multipart/alternative');
    expect(msg).toContain('multipart/mixed');
  });
});

// ─── encodeMimeMessage ────────────────────────────────────────────────────────

describe('encodeMimeMessage', () => {
  it('base64url 文字列を返す（+ と / を含まない）', () => {
    const raw = buildMimeMessage(BASE_OPTS);
    const encoded = encodeMimeMessage(raw);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('デコードすると元の文字列に戻る', () => {
    const raw = buildMimeMessage(BASE_OPTS);
    const encoded = encodeMimeMessage(raw);
    const decoded = Buffer.from(encoded, 'base64url').toString();
    expect(decoded).toBe(raw);
  });
});
