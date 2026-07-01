import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../../config/index.js', () => ({
  env: { isDryRun: false, gmailFrom: 'sender@example.com' },
}));

vi.mock('../../sheets/index.js', () => ({
  createSendHistoryService: vi.fn(),
  createSheetsService: vi.fn(),
  createReplyHistoryService: vi.fn(),
}));

vi.mock('../../gmail/index.js', () => ({
  createGmailReader: vi.fn(),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { checkRepliesCommand } from './check-replies.js';
import {
  createSendHistoryService,
  createSheetsService,
  createReplyHistoryService,
} from '../../sheets/index.js';
import { createGmailReader } from '../../gmail/index.js';

// ─── モックオブジェクト ───────────────────────────────────────────────────────

const mockSendHistory = {
  getSuccessRows: vi.fn(),
};
const mockSheetsService = {
  getAllCompanies: vi.fn(),
  updateCompanyByCompanyId: vi.fn(),
};
const mockGmailReader = {
  findReplies: vi.fn(),
};
const mockReplyHistory = {
  ensureSheet: vi.fn(),
  log: vi.fn(),
};

// ─── テストデータ ─────────────────────────────────────────────────────────────

function makeSuccessRow(overrides = {}) {
  return {
    companyId: 'C000001',
    companyName: 'テスト株式会社',
    email: 'test@example.co.jp',
    placeId: 'pl-001',
    messageId: 'msg-001',
    sentAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeReply(overrides = {}) {
  return {
    messageId: 'reply-001',
    fromEmail: 'client@example.co.jp',
    repliedAt: '2026-07-01T09:00:00.000Z',
    subject: 'Re: テスト',
    snippet: '返信本文',
    ...overrides,
  };
}

// ─── セットアップ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  createSendHistoryService.mockResolvedValue(mockSendHistory);
  createSheetsService.mockResolvedValue(mockSheetsService);
  createGmailReader.mockResolvedValue(mockGmailReader);
  createReplyHistoryService.mockResolvedValue(mockReplyHistory);

  mockSendHistory.getSuccessRows.mockResolvedValue([]);
  mockSheetsService.getAllCompanies.mockResolvedValue([]);
  mockSheetsService.updateCompanyByCompanyId.mockResolvedValue({});
  mockGmailReader.findReplies.mockResolvedValue([]);
  mockReplyHistory.ensureSheet.mockResolvedValue(undefined);
  mockReplyHistory.log.mockResolvedValue(undefined);
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('checkRepliesCommand', () => {
  describe('早期終了', () => {
    it('送信済みレコードがない場合は Gmail API を呼ばない', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([]);
      await checkRepliesCommand({});
      expect(createGmailReader).not.toHaveBeenCalled();
    });

    it('全企業が「返信あり」の場合は Gmail API を呼ばない', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '返信あり' },
      ]);
      await checkRepliesCommand({});
      expect(createGmailReader).not.toHaveBeenCalled();
    });
  });

  describe('dryRun モード', () => {
    it('Gmail API を呼ばない', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      await checkRepliesCommand({ dryRun: true });
      expect(createGmailReader).not.toHaveBeenCalled();
      expect(createReplyHistoryService).not.toHaveBeenCalled();
    });

    it('営業リストを更新しない', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      await checkRepliesCommand({ dryRun: true });
      expect(mockSheetsService.updateCompanyByCompanyId).not.toHaveBeenCalled();
    });
  });

  describe('返信検知', () => {
    it('返信が見つかった場合に営業リストを「返信あり」に更新する', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      mockGmailReader.findReplies.mockResolvedValue([makeReply()]);

      await checkRepliesCommand({});

      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ status: '返信あり', hasReply: '○' })
      );
    });

    it('返信が見つかった場合に返信履歴に追記する', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      mockGmailReader.findReplies.mockResolvedValue([makeReply()]);

      await checkRepliesCommand({});

      expect(mockReplyHistory.log).toHaveBeenCalledTimes(1);
      expect(mockReplyHistory.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sentMessageId: 'msg-001',
          replyMessageId: 'reply-001',
          fromEmail: 'client@example.co.jp',
        })
      );
    });

    it('返信が複数件ある場合はすべて返信履歴に追記する', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      mockGmailReader.findReplies.mockResolvedValue([
        makeReply({ messageId: 'r-1' }),
        makeReply({ messageId: 'r-2' }),
      ]);

      await checkRepliesCommand({});

      expect(mockReplyHistory.log).toHaveBeenCalledTimes(2);
    });

    it('返信がない企業は営業リストを更新しない', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([makeSuccessRow()]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      mockGmailReader.findReplies.mockResolvedValue([]);

      await checkRepliesCommand({});

      expect(mockSheetsService.updateCompanyByCompanyId).not.toHaveBeenCalled();
    });
  });

  describe('エラー耐性', () => {
    it('Gmail エラーが発生しても他の企業の処理を続ける', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([
        makeSuccessRow({
          companyId: 'C000001',
          messageId: 'msg-001',
          sentAt: '2026-07-01T10:00:00Z',
        }),
        makeSuccessRow({
          companyId: 'C000002',
          messageId: 'msg-002',
          sentAt: '2026-07-01T10:00:00Z',
        }),
      ]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
        { companyId: 'C000002', status: '送信済' },
      ]);
      mockGmailReader.findReplies
        .mockRejectedValueOnce(new Error('Gmail API error'))
        .mockResolvedValueOnce([makeReply()]);

      await checkRepliesCommand({});

      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledTimes(1);
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000002',
        expect.any(Object)
      );
    });
  });

  describe('重複排除', () => {
    it('同一企業の複数送信は最新の messageId を使う', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([
        makeSuccessRow({ messageId: 'msg-old', sentAt: '2026-06-01T10:00:00.000Z' }),
        makeSuccessRow({ messageId: 'msg-new', sentAt: '2026-07-01T10:00:00.000Z' }),
      ]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
      ]);
      mockGmailReader.findReplies.mockResolvedValue([]);

      await checkRepliesCommand({});

      expect(mockGmailReader.findReplies).toHaveBeenCalledTimes(1);
      expect(mockGmailReader.findReplies).toHaveBeenCalledWith('msg-new');
    });

    it('複数企業をそれぞれ独立して処理する', async () => {
      mockSendHistory.getSuccessRows.mockResolvedValue([
        makeSuccessRow({
          companyId: 'C000001',
          messageId: 'msg-001',
          sentAt: '2026-07-01T10:00:00Z',
        }),
        makeSuccessRow({
          companyId: 'C000002',
          messageId: 'msg-002',
          sentAt: '2026-07-01T10:00:00Z',
        }),
      ]);
      mockSheetsService.getAllCompanies.mockResolvedValue([
        { companyId: 'C000001', status: '送信済' },
        { companyId: 'C000002', status: '送信済' },
      ]);
      mockGmailReader.findReplies.mockResolvedValue([]);

      await checkRepliesCommand({});

      expect(mockGmailReader.findReplies).toHaveBeenCalledTimes(2);
    });
  });
});
