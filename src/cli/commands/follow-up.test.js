import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../../sheets/index.js', () => ({
  createSheetsService: vi.fn(),
  FOLLOW_UP_CATEGORIES: ['meetingToday', 'waitingUrgent', 'meetingTomorrow', 'waitingWarning'],
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { followUpCommand } from './follow-up.js';
import { createSheetsService } from '../../sheets/index.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

const mockSheetsService = {
  getFollowUpList: vi.fn(),
};

function makeResult(overrides = {}) {
  return {
    referenceDate: '2026-07-02',
    meetingToday: [],
    meetingTomorrow: [],
    waitingUrgent: [],
    waitingWarning: [],
    ...overrides,
  };
}

let logSpy;

beforeEach(() => {
  vi.clearAllMocks();
  createSheetsService.mockResolvedValue(mockSheetsService);
  mockSheetsService.getFollowUpList.mockResolvedValue(makeResult());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

function loggedText() {
  return logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('followUpCommand', () => {
  it('新しい API コールを追加せず getFollowUpList のみを呼ぶ', async () => {
    await followUpCommand();
    expect(mockSheetsService.getFollowUpList).toHaveBeenCalledTimes(1);
  });

  it('ヘッダーにタイトルと基準日を表示する', async () => {
    await followUpCommand();
    const text = loggedText();
    expect(text).toContain('Sales Pilot AI — 今日のアクションリスト');
    expect(text).toContain('基準日: 2026-07-02');
  });

  it('4カテゴリすべてを見出し付きで表示する', async () => {
    await followUpCommand();
    const text = loggedText();
    expect(text).toContain('【本日の商談予定】(0件)');
    expect(text).toContain('【要フォロー（返信なし7日以上）】(0件)');
    expect(text).toContain('【明日の商談予定】(0件)');
    expect(text).toContain('【経過観察（返信なし3日以上）】(0件)');
  });

  it('該当なしのカテゴリには「該当なし」と表示する', async () => {
    await followUpCommand();
    expect(loggedText()).toContain('・該当なし');
  });

  it('商談予定の企業を商談日つきで表示する', async () => {
    mockSheetsService.getFollowUpList.mockResolvedValue(
      makeResult({
        meetingToday: [
          { companyId: 'C000001', companyName: 'テスト株式会社', meetingDate: '2026-07-02' },
        ],
      })
    );
    await followUpCommand();
    const text = loggedText();
    expect(text).toContain('・テスト株式会社 (C000001) — 商談日: 2026-07-02');
  });

  it('返信待ちの企業を経過日数つきで表示する', async () => {
    mockSheetsService.getFollowUpList.mockResolvedValue(
      makeResult({
        waitingUrgent: [
          {
            companyId: 'C000002',
            companyName: 'サンプル商事',
            sentDate: '2026-06-20',
            daysSinceSent: 12,
          },
        ],
      })
    );
    await followUpCommand();
    const text = loggedText();
    expect(text).toContain('・サンプル商事 (C000002) — 送信日: 2026-06-20（12日経過）');
  });

  it('getFollowUpList がエラーを投げた場合はプロセスを終了する', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    mockSheetsService.getFollowUpList.mockRejectedValue(new Error('Sheets API error'));

    await followUpCommand();

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
