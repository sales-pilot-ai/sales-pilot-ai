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
  }),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { promptFindOptions } = await import('./prompts.js');

// ─── テストデータ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('promptFindOptions', () => {
  describe('デフォルトなし（3 項目すべて入力）', () => {
    it('industry・area・limit の 3 問を含む配列を渡して inquirer.prompt を呼ぶ', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 10 })
        .mockResolvedValueOnce({ confirmed: true });

      await promptFindOptions();

      const [firstCallQuestions] = mockPrompt.mock.calls[0];
      expect(firstCallQuestions).toHaveLength(3);
      expect(firstCallQuestions.map((q) => q.name)).toEqual(['industry', 'area', 'limit']);
    });

    it('入力された値を返す', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', area: '東京都渋谷区', limit: 15 })
        .mockResolvedValueOnce({ confirmed: true });

      const result = await promptFindOptions();

      expect(result.industry).toBe('飲食店');
      expect(result.area).toBe('東京都渋谷区');
      expect(result.limit).toBe(15);
      expect(result.confirmed).toBe(true);
    });

    it('confirmed: false のとき false を返す', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 20 })
        .mockResolvedValueOnce({ confirmed: false });

      const result = await promptFindOptions();
      expect(result.confirmed).toBe(false);
    });
  });

  describe('defaultIndustry あり（area + limit の 2 問）', () => {
    it('industry 問を含まない 2 問を渡す', async () => {
      mockPrompt
        .mockResolvedValueOnce({ area: '大阪', limit: 20 })
        .mockResolvedValueOnce({ confirmed: true });

      await promptFindOptions({ defaultIndustry: '美容室' });

      const [questions] = mockPrompt.mock.calls[0];
      expect(questions).toHaveLength(2);
      expect(questions.map((q) => q.name)).toEqual(['area', 'limit']);
    });

    it('defaultIndustry を返り値の industry に使う', async () => {
      mockPrompt
        .mockResolvedValueOnce({ area: '大阪', limit: 20 })
        .mockResolvedValueOnce({ confirmed: true });

      const result = await promptFindOptions({ defaultIndustry: '美容室' });
      expect(result.industry).toBe('美容室');
    });
  });

  describe('defaultArea あり（industry + limit の 2 問）', () => {
    it('area 問を含まない 2 問を渡す', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', limit: 20 })
        .mockResolvedValueOnce({ confirmed: true });

      await promptFindOptions({ defaultArea: '東京' });

      const [questions] = mockPrompt.mock.calls[0];
      expect(questions).toHaveLength(2);
      expect(questions.map((q) => q.name)).toEqual(['industry', 'limit']);
    });

    it('defaultArea を返り値の area に使う', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', limit: 20 })
        .mockResolvedValueOnce({ confirmed: true });

      const result = await promptFindOptions({ defaultArea: '東京' });
      expect(result.area).toBe('東京');
    });
  });

  describe('defaultLimit', () => {
    it('limit 問の default 値に defaultLimit を渡す', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 5 })
        .mockResolvedValueOnce({ confirmed: true });

      await promptFindOptions({ defaultLimit: 5 });

      const [questions] = mockPrompt.mock.calls[0];
      const limitQuestion = questions.find((q) => q.name === 'limit');
      expect(limitQuestion.default).toBe(5);
    });
  });

  describe('確認プロンプト', () => {
    it('inquirer.prompt を合計 2 回呼ぶ（質問 + 確認）', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 20 })
        .mockResolvedValueOnce({ confirmed: true });

      await promptFindOptions();
      expect(mockPrompt).toHaveBeenCalledTimes(2);
    });

    it('確認プロンプトに confirmed フィールドがある', async () => {
      mockPrompt
        .mockResolvedValueOnce({ industry: '飲食店', area: '東京', limit: 20 })
        .mockResolvedValueOnce({ confirmed: true });

      await promptFindOptions();

      const [confirmQuestions] = mockPrompt.mock.calls[1];
      expect(confirmQuestions[0].name).toBe('confirmed');
      expect(confirmQuestions[0].type).toBe('confirm');
    });
  });
});
