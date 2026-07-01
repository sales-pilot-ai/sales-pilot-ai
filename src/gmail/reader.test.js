import { describe, it, expect, vi } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../sheets/auth.js', () => ({
  createAuth: vi.fn().mockResolvedValue({}),
}));

vi.mock('googleapis', () => ({
  google: {
    gmail: vi.fn().mockReturnValue({}),
    auth: { OAuth2: vi.fn() },
  },
}));

vi.mock('../config/index.js', () => ({
  env: { gmailFrom: 'sender@example.com' },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { GmailReader, createGmailReader } from './reader.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

function makeGmailApi({ threadId = 'thread-001', messages = [] } = {}) {
  return {
    users: {
      messages: {
        get: vi.fn().mockResolvedValue({
          data: { id: 'msg-001', threadId },
        }),
      },
      threads: {
        get: vi.fn().mockResolvedValue({
          data: { id: threadId, messages },
        }),
      },
    },
  };
}

function makeMessage({
  id,
  fromEmail = 'reply@example.com',
  subject = 'Re: テスト',
  internalDate = '1751000000000',
  snippet = '返信本文のスニペット',
} = {}) {
  return {
    id,
    snippet,
    internalDate,
    payload: {
      headers: [
        { name: 'From', value: fromEmail },
        { name: 'Date', value: 'Wed, 01 Jul 2026 10:00:00 +0900' },
        { name: 'Subject', value: subject },
      ],
    },
  };
}

// ─── GmailReader ─────────────────────────────────────────────────────────────

describe('GmailReader', () => {
  describe('constructor', () => {
    it('gmailApi がないと例外を投げる', () => {
      expect(() => new GmailReader({})).toThrow('gmailApi は必須です');
    });

    it('gmailApi を受け取りインスタンスを返す', () => {
      const reader = new GmailReader({ gmailApi: makeGmailApi(), senderEmail: 'x@x.com' });
      expect(reader).toBeInstanceOf(GmailReader);
    });
  });

  describe('getThreadId', () => {
    it('messageId から threadId を返す', async () => {
      const api = makeGmailApi({ threadId: 'thread-xyz' });
      const reader = new GmailReader({ gmailApi: api, senderEmail: '' });
      const result = await reader.getThreadId('msg-001');
      expect(result).toBe('thread-xyz');
    });

    it('users.messages.get を format=minimal で呼ぶ', async () => {
      const api = makeGmailApi();
      const reader = new GmailReader({ gmailApi: api, senderEmail: '' });
      await reader.getThreadId('msg-001');
      const call = api.users.messages.get.mock.calls[0][0];
      expect(call.format).toBe('minimal');
      expect(call.id).toBe('msg-001');
    });
  });

  describe('getThreadMessages', () => {
    it('スレッドのメッセージ配列を返す', async () => {
      const msgs = [makeMessage({ id: 'msg-001' }), makeMessage({ id: 'msg-002' })];
      const api = makeGmailApi({ messages: msgs });
      const reader = new GmailReader({ gmailApi: api, senderEmail: '' });
      const result = await reader.getThreadMessages('thread-001');
      expect(result).toHaveLength(2);
    });

    it('メッセージがない場合は空配列を返す', async () => {
      const api = makeGmailApi({ messages: [] });
      const reader = new GmailReader({ gmailApi: api, senderEmail: '' });
      const result = await reader.getThreadMessages('thread-001');
      expect(result).toEqual([]);
    });

    it('users.threads.get を format=metadata で呼ぶ', async () => {
      const api = makeGmailApi({ messages: [] });
      const reader = new GmailReader({ gmailApi: api, senderEmail: '' });
      await reader.getThreadMessages('thread-001');
      const call = api.users.threads.get.mock.calls[0][0];
      expect(call.format).toBe('metadata');
    });
  });

  describe('findReplies', () => {
    it('送信元メッセージ自身（id 一致）を除外する', async () => {
      const sentMsg = makeMessage({ id: 'msg-001', fromEmail: 'other@example.com' });
      const api = makeGmailApi({ messages: [sentMsg] });
      const reader = new GmailReader({ gmailApi: api, senderEmail: 'sender@example.com' });
      const replies = await reader.findReplies('msg-001');
      expect(replies).toHaveLength(0);
    });

    it('senderEmail を含む From のメッセージを除外する', async () => {
      const selfMsg = makeMessage({ id: 'msg-002', fromEmail: 'Sender Name <sender@example.com>' });
      const api = makeGmailApi({
        messages: [
          { id: 'msg-001', snippet: '', internalDate: '0', payload: { headers: [] } },
          selfMsg,
        ],
      });
      const reader = new GmailReader({ gmailApi: api, senderEmail: 'sender@example.com' });
      const replies = await reader.findReplies('msg-001');
      expect(replies).toHaveLength(0);
    });

    it('第三者からのメッセージを返信として返す', async () => {
      const replyMsg = makeMessage({
        id: 'msg-002',
        fromEmail: 'client@co.jp',
        subject: 'Re: テスト件名',
      });
      const api = makeGmailApi({
        messages: [
          { id: 'msg-001', snippet: '', internalDate: '0', payload: { headers: [] } },
          replyMsg,
        ],
      });
      const reader = new GmailReader({ gmailApi: api, senderEmail: 'sender@example.com' });
      const replies = await reader.findReplies('msg-001');
      expect(replies).toHaveLength(1);
      expect(replies[0].fromEmail).toBe('client@co.jp');
      expect(replies[0].subject).toBe('Re: テスト件名');
      expect(replies[0].messageId).toBe('msg-002');
    });

    it('snippet を 200 文字以内に切り詰める', async () => {
      const longSnippet = 'あ'.repeat(300);
      const replyMsg = makeMessage({ id: 'msg-002', snippet: longSnippet });
      const api = makeGmailApi({
        messages: [
          { id: 'msg-001', snippet: '', internalDate: '0', payload: { headers: [] } },
          replyMsg,
        ],
      });
      const reader = new GmailReader({ gmailApi: api, senderEmail: 'sender@example.com' });
      const replies = await reader.findReplies('msg-001');
      expect(replies[0].snippet.length).toBeLessThanOrEqual(200);
    });

    it('repliedAt に ISO 8601 文字列を返す', async () => {
      const replyMsg = makeMessage({ id: 'msg-002', internalDate: '1751000000000' });
      const api = makeGmailApi({
        messages: [
          { id: 'msg-001', snippet: '', internalDate: '0', payload: { headers: [] } },
          replyMsg,
        ],
      });
      const reader = new GmailReader({ gmailApi: api, senderEmail: 'sender@example.com' });
      const replies = await reader.findReplies('msg-001');
      expect(replies[0].repliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('senderEmail が空のとき全メッセージを返信として扱う', async () => {
      const msg2 = makeMessage({ id: 'msg-002', fromEmail: 'anyone@example.com' });
      const api = makeGmailApi({
        messages: [
          { id: 'msg-001', snippet: '', internalDate: '0', payload: { headers: [] } },
          msg2,
        ],
      });
      const reader = new GmailReader({ gmailApi: api, senderEmail: '' });
      const replies = await reader.findReplies('msg-001');
      expect(replies).toHaveLength(1);
    });

    it('返信が複数件ある場合はすべて返す', async () => {
      const api = makeGmailApi({
        messages: [
          { id: 'msg-001', snippet: '', internalDate: '0', payload: { headers: [] } },
          makeMessage({ id: 'msg-002' }),
          makeMessage({ id: 'msg-003' }),
        ],
      });
      const reader = new GmailReader({ gmailApi: api, senderEmail: 'sender@example.com' });
      const replies = await reader.findReplies('msg-001');
      expect(replies).toHaveLength(2);
    });
  });
});

// ─── createGmailReader ────────────────────────────────────────────────────────

describe('createGmailReader', () => {
  it('GmailReader インスタンスを返す', async () => {
    const reader = await createGmailReader();
    expect(reader).toBeInstanceOf(GmailReader);
  });
});
