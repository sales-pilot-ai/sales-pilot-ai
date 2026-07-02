import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockPrompt } = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import {
  formatCandidate,
  promptReviewDecision,
  reviewCompanies,
  printReviewSummary,
} from './find-review.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

function makeCompany(overrides = {}) {
  return {
    companyId: 'C000001',
    companyName: 'テスト株式会社',
    email: 'info@example.com',
    websiteUrl: 'https://example.com',
    location: '東京都渋谷区',
    phone: '03-1234-5678',
    industry: '飲食店',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('formatCandidate', () => {
  it('会社名/メール/URL/住所/電話/業種を表示する', () => {
    const text = formatCandidate(makeCompany(), 0, 3);
    expect(text).toContain('[1/3]');
    expect(text).toContain('会社名: テスト株式会社');
    expect(text).toContain('メール: info@example.com');
    expect(text).toContain('URL: https://example.com');
    expect(text).toContain('住所: 東京都渋谷区');
    expect(text).toContain('電話: 03-1234-5678');
    expect(text).toContain('業種: 飲食店');
  });

  it('フィールドが欠落していても空文字にフォールバックする', () => {
    const text = formatCandidate(makeCompany({ email: undefined, phone: undefined }), 1, 5);
    expect(text).toContain('[2/5]');
    expect(text).toContain('メール: ');
    expect(text).toContain('電話: ');
  });
});

describe('promptReviewDecision', () => {
  it('inquirer の expand タイプで y/n/q を尋ねる', async () => {
    mockPrompt.mockResolvedValue({ decision: 'y' });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const decision = await promptReviewDecision(makeCompany(), 0, 1);

    expect(decision).toBe('y');
    expect(mockPrompt).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'expand',
        choices: [
          expect.objectContaining({ key: 'y', value: 'y' }),
          expect.objectContaining({ key: 'n', value: 'n' }),
          expect.objectContaining({ key: 'q', value: 'q' }),
        ],
      }),
    ]);
  });
});

describe('reviewCompanies', () => {
  it('企業が0件の場合は即座に空の結果を返す', async () => {
    const promptDecision = vi.fn();
    const result = await reviewCompanies([], promptDecision);
    expect(result).toEqual({ approved: [], skippedCount: 0, remainingCount: 0 });
    expect(promptDecision).not.toHaveBeenCalled();
  });

  it('y と判断した企業を approved に積む', async () => {
    const companies = [makeCompany({ companyId: 'C1' }), makeCompany({ companyId: 'C2' })];
    const promptDecision = vi.fn().mockResolvedValueOnce('y').mockResolvedValueOnce('y');

    const result = await reviewCompanies(companies, promptDecision);

    expect(result.approved.map((c) => c.companyId)).toEqual(['C1', 'C2']);
    expect(result.skippedCount).toBe(0);
    expect(result.remainingCount).toBe(0);
  });

  it('n と判断した企業は approved に積まず skippedCount を増やす', async () => {
    const companies = [makeCompany({ companyId: 'C1' }), makeCompany({ companyId: 'C2' })];
    const promptDecision = vi.fn().mockResolvedValueOnce('n').mockResolvedValueOnce('y');

    const result = await reviewCompanies(companies, promptDecision);

    expect(result.approved.map((c) => c.companyId)).toEqual(['C2']);
    expect(result.skippedCount).toBe(1);
    expect(result.remainingCount).toBe(0);
  });

  it('q で終了した場合、それまでに y と判断した企業は approved に残る', async () => {
    const companies = [
      makeCompany({ companyId: 'C1' }),
      makeCompany({ companyId: 'C2' }),
      makeCompany({ companyId: 'C3' }),
      makeCompany({ companyId: 'C4' }),
      makeCompany({ companyId: 'C5' }),
    ];
    const promptDecision = vi
      .fn()
      .mockResolvedValueOnce('y') // C1
      .mockResolvedValueOnce('y') // C2
      .mockResolvedValueOnce('q'); // C3 の判断時点で終了

    const result = await reviewCompanies(companies, promptDecision);

    expect(result.approved.map((c) => c.companyId)).toEqual(['C1', 'C2']);
    expect(result.skippedCount).toBe(0);
    // C3, C4, C5 の3件が残件数（q を選んだ C3 自身も未決定として残件数に含む）
    expect(result.remainingCount).toBe(3);
    expect(promptDecision).toHaveBeenCalledTimes(3);
  });

  it('最初の1件目で q を選ぶと全件が残件数になる', async () => {
    const companies = [makeCompany({ companyId: 'C1' }), makeCompany({ companyId: 'C2' })];
    const promptDecision = vi.fn().mockResolvedValueOnce('q');

    const result = await reviewCompanies(companies, promptDecision);

    expect(result.approved).toEqual([]);
    expect(result.remainingCount).toBe(2);
  });
});

describe('printReviewSummary', () => {
  it('追加件数・重複更新件数・スキップ件数・残件数を表示する', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printReviewSummary({ addedCount: 15, mergedCount: 2, skippedCount: 8, remainingCount: 35 });

    const text = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(text).toContain('追加件数    : 15件');
    expect(text).toContain('重複更新件数: 2件');
    expect(text).toContain('スキップ件数: 8件');
    expect(text).toContain('残件数      : 35件');

    logSpy.mockRestore();
  });
});
