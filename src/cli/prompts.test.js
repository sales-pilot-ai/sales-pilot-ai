import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockPrompt } = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

vi.mock('chalk', () => ({
  default: Object.assign((s) => s, {
    cyan: (s) => s,
    bold: (s) => s,
    dim: (s) => s,
    red: (s) => s,
  }),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { promptFindOptions, confirmFindExecution } = await import('./prompts.js');

// ─── セットアップ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── promptFindOptions ────────────────────────────────────────────────────────

describe('promptFindOptions', () => {
  describe('デフォルトなし（3 項目すべて入力）', () => {
    it('industry・area・limit の 3 問を渡す', async () => {
      mockPrompt.mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 10 });

      await promptFindOptions();

      const [questions] = mockPrompt.mock.calls[0];
      expect(questions).toHaveLength(3);
      expect(questions.map((q) => q.name)).toEqual(['industry', 'area', 'limit']);
    });

    it('入力された値を返す', async () => {
      mockPrompt.mockResolvedValueOnce({ industry: '飲食店', area: '東京都渋谷区', limit: 15 });

      const result = await promptFindOptions();
      expect(result.industry).toBe('飲食店');
      expect(result.area).toBe('東京都渋谷区');
      expect(result.limit).toBe(15);
    });

    it('confirmed フィールドは含まない', async () => {
      mockPrompt.mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 20 });

      const result = await promptFindOptions();
      expect(result).not.toHaveProperty('confirmed');
    });

    it('inquirer.prompt を 1 回だけ呼ぶ', async () => {
      mockPrompt.mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 20 });

      await promptFindOptions();
      expect(mockPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('defaultIndustry あり（area + limit の 2 問）', () => {
    it('industry 問を含まない 2 問を渡す', async () => {
      mockPrompt.mockResolvedValueOnce({ area: '大阪', limit: 20 });

      await promptFindOptions({ defaultIndustry: '美容室' });

      const [questions] = mockPrompt.mock.calls[0];
      expect(questions).toHaveLength(2);
      expect(questions.map((q) => q.name)).toEqual(['area', 'limit']);
    });

    it('defaultIndustry を返り値の industry に使う', async () => {
      mockPrompt.mockResolvedValueOnce({ area: '大阪', limit: 20 });

      const result = await promptFindOptions({ defaultIndustry: '美容室' });
      expect(result.industry).toBe('美容室');
    });
  });

  describe('defaultArea あり（industry + limit の 2 問）', () => {
    it('area 問を含まない 2 問を渡す', async () => {
      mockPrompt.mockResolvedValueOnce({ industry: '飲食店', limit: 20 });

      await promptFindOptions({ defaultArea: '東京' });

      const [questions] = mockPrompt.mock.calls[0];
      expect(questions).toHaveLength(2);
      expect(questions.map((q) => q.name)).toEqual(['industry', 'limit']);
    });
  });

  describe('defaultLimit', () => {
    it('limit 問の default 値に defaultLimit を渡す', async () => {
      mockPrompt.mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 5 });

      await promptFindOptions({ defaultLimit: 5 });

      const [questions] = mockPrompt.mock.calls[0];
      const limitQ = questions.find((q) => q.name === 'limit');
      expect(limitQ.default).toBe(5);
    });
  });
});

// ─── confirmFindExecution ─────────────────────────────────────────────────────

describe('confirmFindExecution', () => {
  beforeEach(() => {
    process.env.SPREADSHEET_ID = 'test_sheet_id';
    process.env.SHEET_NAME = 'テストシート';
  });

  afterEach(() => {
    delete process.env.SPREADSHEET_ID;
    delete process.env.SHEET_NAME;
  });

  it('inquirer.prompt を 1 回呼ぶ', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: true });

    await confirmFindExecution('飲食店', '東京', 20);
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('confirmed が true のとき true を返す', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: true });

    const result = await confirmFindExecution('飲食店', '東京', 20);
    expect(result).toBe(true);
  });

  it('confirmed が false のとき false を返す', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: false });

    const result = await confirmFindExecution('飲食店', '東京', 20);
    expect(result).toBe(false);
  });

  it('skipSheets=true のとき console.log に "dry-run" を含む行を出力する', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: true });

    await confirmFindExecution('飲食店', '東京', 20, { skipSheets: true });

    const logCalls = console.log.mock.calls.flat().join(' ');
    expect(logCalls).toContain('dry-run');
  });

  it('SPREADSHEET_ID 未設定のとき "(未設定)" を表示する', async () => {
    delete process.env.SPREADSHEET_ID;
    mockPrompt.mockResolvedValueOnce({ confirmed: true });

    await confirmFindExecution('飲食店', '東京', 20);

    const logCalls = console.log.mock.calls.flat().join(' ');
    expect(logCalls).toContain('(未設定)');
  });
});
