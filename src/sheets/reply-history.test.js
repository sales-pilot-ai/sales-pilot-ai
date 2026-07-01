import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../config/index.js', () => ({
  env: { spreadsheetId: 'mock-spreadsheet-id' },
}));

vi.mock('./auth.js', () => ({
  createAuth: vi.fn().mockResolvedValue({}),
}));

vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn().mockReturnValue({}),
    auth: { OAuth2: vi.fn() },
  },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import {
  REPLY_HISTORY_HEADERS,
  REPLY_HISTORY_SHEET,
  ReplyHistoryService,
  createReplyHistoryService,
} from './reply-history.js';
import { HistoryService } from './history-service.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

function makeSheetsApi({ sheetTitles = [] } = {}) {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: { sheets: sheetTitles.map((t) => ({ properties: { title: t } })) },
      }),
      batchUpdate: vi.fn().mockResolvedValue({}),
      values: {
        update: vi.fn().mockResolvedValue({}),
        append: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({ data: { values: [] } }),
      },
    },
  };
}

function makeRecord(overrides = {}) {
  return {
    detectedAt: '2026-07-01T10:00:00.000Z',
    company: {
      companyId: 'C000001',
      placeId: 'ChIJtest',
      companyName: '株式会社テスト',
      email: 'test@example.co.jp',
    },
    sentMessageId: 'sent-msg-001',
    replyMessageId: 'reply-msg-001',
    repliedAt: '2026-07-01T08:00:00.000Z',
    fromEmail: 'client@example.co.jp',
    subject: 'Re: 【ご提案】テスト',
    snippet: '返信本文の抜粋です',
    ...overrides,
  };
}

// ─── REPLY_HISTORY_HEADERS ────────────────────────────────────────────────────

describe('REPLY_HISTORY_HEADERS', () => {
  it('12列を持つ', () => {
    expect(REPLY_HISTORY_HEADERS).toHaveLength(12);
  });

  it('必須列を含む', () => {
    const required = [
      '検知日時',
      '企業ID',
      'Place ID',
      '会社名',
      'メールアドレス',
      '送信 Message ID',
      '返信 Message ID',
      '返信日時',
      '返信者',
      '件名',
      '内容概要',
      '返信要約',
    ];
    for (const col of required) {
      expect(REPLY_HISTORY_HEADERS).toContain(col);
    }
  });
});

// ─── ReplyHistoryService ──────────────────────────────────────────────────────

describe('ReplyHistoryService', () => {
  let api;
  let svc;

  beforeEach(() => {
    api = makeSheetsApi({ sheetTitles: ['返信履歴'] });
    svc = new ReplyHistoryService({ sheetsApi: api, spreadsheetId: 'sp-id' });
  });

  describe('constructor', () => {
    it('HistoryService を継承する', () => {
      expect(svc).toBeInstanceOf(HistoryService);
    });

    it('sheetName が "返信履歴"', () => {
      expect(svc._sheetName).toBe(REPLY_HISTORY_SHEET);
    });

    it('headers が REPLY_HISTORY_HEADERS', () => {
      expect(svc._headers).toBe(REPLY_HISTORY_HEADERS);
    });
  });

  describe('log', () => {
    it('appendRow を 1 回呼ぶ', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      await svc.log(makeRecord());
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('12列のデータを appendRow に渡す', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      await svc.log(makeRecord());
      const [row] = spy.mock.calls[0];
      expect(row).toHaveLength(12);
    });

    it('検知日時・企業ID・送信 Message ID・返信 Message ID が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      await svc.log(makeRecord());
      const [row] = spy.mock.calls[0];
      expect(row).toContain('2026-07-01T10:00:00.000Z');
      expect(row).toContain('C000001');
      expect(row).toContain('sent-msg-001');
      expect(row).toContain('reply-msg-001');
    });

    it('replySummary を省略すると空文字になる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      await svc.log(makeRecord());
      const [row] = spy.mock.calls[0];
      const summaryIdx = REPLY_HISTORY_HEADERS.indexOf('返信要約');
      expect(row[summaryIdx]).toBe('');
    });

    it('replySummary を指定できる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      await svc.log(makeRecord({ replySummary: '要約テキスト' }));
      const [row] = spy.mock.calls[0];
      const summaryIdx = REPLY_HISTORY_HEADERS.indexOf('返信要約');
      expect(row[summaryIdx]).toBe('要約テキスト');
    });

    it('company.placeId が undefined のとき空文字になる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      const record = makeRecord();
      delete record.company.placeId;
      await svc.log(record);
      const [row] = spy.mock.calls[0];
      const placeIdx = REPLY_HISTORY_HEADERS.indexOf('Place ID');
      expect(row[placeIdx]).toBe('');
    });

    it('fromEmail・subject・snippet が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      await svc.log(makeRecord());
      const [row] = spy.mock.calls[0];
      expect(row).toContain('client@example.co.jp');
      expect(row).toContain('Re: 【ご提案】テスト');
      expect(row).toContain('返信本文の抜粋です');
    });
  });
});

// ─── createReplyHistoryService ────────────────────────────────────────────────

describe('createReplyHistoryService', () => {
  it('ReplyHistoryService インスタンスを返す', async () => {
    const svc = await createReplyHistoryService();
    expect(svc).toBeInstanceOf(ReplyHistoryService);
  });
});
