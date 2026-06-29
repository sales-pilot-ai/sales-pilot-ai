/**
 * GmailMailer のユニットテスト。
 *
 * googleapis は一切モックしない。
 * GmailMailer のコンストラクタに mock gmailApi を注入する（DI）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GmailMailer } from './mailer.js';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn() },
}));

const { logger } = await import('../utils/logger.js');

// ─── モック API ファクトリ ────────────────────────────────────────────────────

function createMockGmailApi(messageId = 'msg_test_id_001') {
  return {
    users: {
      messages: {
        send: vi.fn().mockResolvedValue({ data: { id: messageId } }),
      },
    },
  };
}

// ─── GmailMailer コンストラクタ ───────────────────────────────────────────────

describe('GmailMailer コンストラクタ', () => {
  it('gmailApi が未指定のとき Error をスローする', () => {
    expect(() => new GmailMailer()).toThrow('gmailApi は必須です');
  });

  it('from を省略すると process.env.GMAIL_FROM を使う', () => {
    process.env.GMAIL_FROM = 'env@example.com';
    const mailer = new GmailMailer({ gmailApi: createMockGmailApi() });
    expect(mailer._from).toBe('env@example.com');
    delete process.env.GMAIL_FROM;
  });
});

// ─── send ─────────────────────────────────────────────────────────────────────

describe('GmailMailer.send', () => {
  let api;
  let mailer;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockGmailApi();
    mailer = new GmailMailer({ gmailApi: api, from: 'sender@example.com' });
  });

  // ── dry-run ──────────────────────────────────────────────────────────────────

  it('dryRun=true のとき API を呼ばない', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト', dryRun: true });
    expect(api.users.messages.send).not.toHaveBeenCalled();
  });

  it('dryRun=true のとき { messageId: null, dryRun: true } を返す', async () => {
    const result = await mailer.send({ to: 'to@example.com', subject: 'テスト', dryRun: true });
    expect(result).toEqual({ messageId: null, dryRun: true });
  });

  it('dryRun=true のとき logger.warn を出力する', async () => {
    await mailer.send({
      to: 'to@example.com',
      subject: 'テスト',
      textBody: '本文',
      dryRun: true,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('to@example.com'));
  });

  it('dryRun=true でも logger.warn に件名が含まれる', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト件名', dryRun: true });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('テスト件名'));
  });

  // ── 送信 ─────────────────────────────────────────────────────────────────────

  it('Gmail API を 1 回呼ぶ', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' });
    expect(api.users.messages.send).toHaveBeenCalledOnce();
  });

  it('userId: "me" で API を呼ぶ', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' });
    const call = api.users.messages.send.mock.calls[0][0];
    expect(call.userId).toBe('me');
  });

  it('requestBody.raw が文字列として渡される', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' });
    const call = api.users.messages.send.mock.calls[0][0];
    expect(typeof call.requestBody.raw).toBe('string');
  });

  it('requestBody.raw が base64url エンコードされている（+ / を含まない）', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' });
    const raw = api.users.messages.send.mock.calls[0][0].requestBody.raw;
    expect(raw).not.toContain('+');
    expect(raw).not.toContain('/');
  });

  it('messageId を返す', async () => {
    const result = await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' });
    expect(result).toEqual({ messageId: 'msg_test_id_001' });
  });

  it('送信成功後に logger.success を出力する', async () => {
    await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' });
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('to@example.com'));
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('msg_test_id_001'));
  });

  // ── エラー ────────────────────────────────────────────────────────────────────

  it('from が空のとき Error をスローする', async () => {
    const m = new GmailMailer({ gmailApi: api, from: '' });
    await expect(m.send({ to: 'to@example.com', subject: 'テスト' })).rejects.toThrow('GMAIL_FROM');
  });

  it('API が例外をスローしたとき例外を伝播する', async () => {
    api.users.messages.send.mockRejectedValue(new Error('API Error'));
    await expect(
      mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文' })
    ).rejects.toThrow('API Error');
  });

  // ── 添付ファイル ──────────────────────────────────────────────────────────────

  it('attachments が渡されても API を 1 回だけ呼ぶ', async () => {
    const attachments = [
      { filename: 'file.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf data') },
    ];
    await mailer.send({ to: 'to@example.com', subject: 'テスト', textBody: '本文', attachments });
    expect(api.users.messages.send).toHaveBeenCalledOnce();
  });

  it('dryRun のとき添付ファイル名を logger.warn に出力する', async () => {
    const attachments = [
      { filename: 'report.pdf', mimeType: 'application/pdf', data: Buffer.from('x') },
    ];
    await mailer.send({
      to: 'to@example.com',
      subject: 'テスト',
      textBody: '本文',
      attachments,
      dryRun: true,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('report.pdf'));
  });
});
