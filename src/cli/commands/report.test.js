import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../../sheets/index.js', () => ({
  createSheetsService: vi.fn(),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { reportCommand } from './report.js';
import { createSheetsService } from '../../sheets/index.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

const mockSheetsService = {
  getStats: vi.fn(),
};

function makeStats(overrides = {}) {
  return {
    totalCompanies: 10,
    sentCount: 5,
    sendRate: 50,
    waitingCount: 3,
    repliedCount: 2,
    replyRate: 40,
    meetingCount: 1,
    closedCount: 1,
    lostCount: 0,
    unsubscribedCount: 1,
    ...overrides,
  };
}

let logSpy;

beforeEach(() => {
  vi.clearAllMocks();
  createSheetsService.mockResolvedValue(mockSheetsService);
  mockSheetsService.getStats.mockResolvedValue(makeStats());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

function loggedText() {
  return logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('reportCommand', () => {
  it('新しい API コールを追加せず getStats のみを呼ぶ', async () => {
    await reportCommand();
    expect(mockSheetsService.getStats).toHaveBeenCalledTimes(1);
  });

  it('ヘッダーにタイトルと生成日時を表示する', async () => {
    await reportCommand();
    const text = loggedText();
    expect(text).toContain('Sales Pilot AI — 営業レポート');
    expect(text).toMatch(/生成日時: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it('総合セクションに送信率を表示する', async () => {
    await reportCommand();
    const text = loggedText();
    expect(text).toContain('【総合】');
    expect(text).toContain('総企業数: 10件');
    expect(text).toContain('送信済件数: 5件');
    expect(text).toContain('送信率: 50.0%');
    expect(text).toContain('送信待ち件数: 3件');
  });

  it('返信セクションに返信率を表示する', async () => {
    await reportCommand();
    const text = loggedText();
    expect(text).toContain('【返信】');
    expect(text).toContain('返信件数: 2件');
    expect(text).toContain('返信率: 40.0%');
  });

  it('営業セクションに失注と配信停止を区別して表示する', async () => {
    mockSheetsService.getStats.mockResolvedValue(
      makeStats({ closedCount: 4, lostCount: 0, unsubscribedCount: 2 })
    );
    await reportCommand();
    const text = loggedText();
    expect(text).toContain('【営業】');
    expect(text).toContain('成約件数: 4件');
    expect(text).toContain('失注件数: 0件');
    expect(text).toContain('配信停止件数: 2件');
  });

  it('getStats がエラーを投げた場合はプロセスを終了する', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    mockSheetsService.getStats.mockRejectedValue(new Error('Sheets API error'));

    await reportCommand();

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
