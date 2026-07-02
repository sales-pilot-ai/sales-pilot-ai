import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const {
  mockFindCompanies,
  mockPromptFindOptions,
  mockConfirmFindExecution,
  mockAppendCompanies,
  mockReviewCompanies,
  mockPromptReviewDecision,
  mockPrintReviewSummary,
} = vi.hoisted(() => ({
  mockFindCompanies: vi.fn(),
  mockPromptFindOptions: vi.fn(),
  mockConfirmFindExecution: vi.fn(),
  mockAppendCompanies: vi.fn(),
  mockReviewCompanies: vi.fn(),
  mockPromptReviewDecision: vi.fn(),
  mockPrintReviewSummary: vi.fn(),
}));

vi.mock('../../crawler/find.js', () => ({
  findCompanies: mockFindCompanies,
}));

vi.mock('../../sheets/index.js', () => ({
  appendCompanies: mockAppendCompanies,
}));

vi.mock('./find-review.js', () => ({
  reviewCompanies: mockReviewCompanies,
  promptReviewDecision: mockPromptReviewDecision,
  printReviewSummary: mockPrintReviewSummary,
}));

vi.mock('../prompts.js', () => ({
  promptFindOptions: mockPromptFindOptions,
  confirmFindExecution: mockConfirmFindExecution,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { findCommand } = await import('./find.js');
const { logger } = await import('../../utils/logger.js');

// ─── セットアップ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockFindCompanies.mockResolvedValue([]);
  mockConfirmFindExecution.mockResolvedValue(true);
  mockReviewCompanies.mockResolvedValue({ approved: [], skippedCount: 0, remainingCount: 0 });
  mockAppendCompanies.mockResolvedValue({ appended: 0, merged: 0 });
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('findCommand', () => {
  describe('非対話モード（--industry と --area が両方指定済み）', () => {
    it('promptFindOptions を呼ばない', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).not.toHaveBeenCalled();
    });

    it('confirmFindExecution を呼ぶ', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockConfirmFindExecution).toHaveBeenCalledOnce();
    });

    it('confirmFindExecution に industry・area・limit を渡す', async () => {
      await findCommand({
        industry: '美容室',
        area: '大阪',
        limit: '10',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockConfirmFindExecution).toHaveBeenCalledWith(
        '美容室',
        '大阪',
        10,
        expect.any(Object)
      );
    });

    it('--dry-run が confirmFindExecution の skipSheets に渡る', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: true,
      });
      expect(mockConfirmFindExecution).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        { skipSheets: true }
      );
    });

    it('findCompanies に industry・area・limit を渡す', async () => {
      await findCommand({
        industry: '美容室',
        area: '大阪',
        limit: '10',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockFindCompanies).toHaveBeenCalledWith('美容室', '大阪', {
        limit: 10,
        skipAnalyzer: false,
        skipSheets: false,
      });
    });

    it('--dry-run が skipSheets に変換される', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: true,
      });
      expect(mockFindCompanies).toHaveBeenCalledWith(
        '飲食店',
        '東京',
        expect.objectContaining({ skipSheets: true })
      );
    });

    it('--skip-analyzer が skipAnalyzer に変換される', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: true,
        dryRun: false,
      });
      expect(mockFindCompanies).toHaveBeenCalledWith(
        '飲食店',
        '東京',
        expect.objectContaining({ skipAnalyzer: true })
      );
    });

    it('成功時に件数を logger.success で出力する', async () => {
      mockFindCompanies.mockResolvedValue([{}, {}]);
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('2 件'));
    });
  });

  describe('対話モード（--industry または --area が未指定）', () => {
    it('industry が未指定のとき promptFindOptions を呼ぶ', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '飲食店', area: '東京', limit: 20 });
      await findCommand({
        industry: undefined,
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).toHaveBeenCalledOnce();
    });

    it('area が未指定のとき promptFindOptions を呼ぶ', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '飲食店', area: '東京', limit: 20 });
      await findCommand({
        industry: '飲食店',
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).toHaveBeenCalledOnce();
    });

    it('両方未指定のとき promptFindOptions を呼ぶ', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '飲食店', area: '東京', limit: 20 });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).toHaveBeenCalledOnce();
    });

    it('提供済みの industry を defaultIndustry として渡す', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '美容室', area: '大阪', limit: 20 });
      await findCommand({
        industry: '美容室',
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({ defaultIndustry: '美容室' })
      );
    });

    it('提供済みの area を defaultArea として渡す', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '飲食店', area: '東京', limit: 20 });
      await findCommand({
        industry: undefined,
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({ defaultArea: '東京' })
      );
    });

    it('--limit の値を defaultLimit として渡す', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '飲食店', area: '東京', limit: 5 });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '5',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockPromptFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({ defaultLimit: 5 })
      );
    });

    it('対話後も confirmFindExecution を呼ぶ', async () => {
      mockPromptFindOptions.mockResolvedValue({ industry: '飲食店', area: '東京', limit: 20 });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockConfirmFindExecution).toHaveBeenCalledOnce();
    });

    it('対話で得た値を findCompanies に渡す', async () => {
      mockPromptFindOptions.mockResolvedValue({
        industry: '整骨院',
        area: '神奈川県横浜市',
        limit: 8,
      });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockFindCompanies).toHaveBeenCalledWith(
        '整骨院',
        '神奈川県横浜市',
        expect.objectContaining({ limit: 8 })
      );
    });
  });

  describe('キャンセル', () => {
    it('confirmFindExecution が false のとき findCompanies を実行しない', async () => {
      mockConfirmFindExecution.mockResolvedValue(false);
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockFindCompanies).not.toHaveBeenCalled();
    });

    it('confirmFindExecution が false のとき "キャンセルしました" をログ出力する', async () => {
      mockConfirmFindExecution.mockResolvedValue(false);
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(logger.info).toHaveBeenCalledWith('キャンセルしました');
    });
  });

  describe('--review モード', () => {
    it('review 指定時は skipSheets を true にして findCompanies を呼ぶ（自動保存を止める）', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
        review: true,
      });
      expect(mockFindCompanies).toHaveBeenCalledWith(
        '飲食店',
        '東京',
        expect.objectContaining({ skipSheets: true })
      );
    });

    it('reviewCompanies に findCompanies の結果と promptReviewDecision を渡す', async () => {
      const companies = [{ companyId: 'C1' }, { companyId: 'C2' }];
      mockFindCompanies.mockResolvedValue(companies);

      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
        review: true,
      });

      expect(mockReviewCompanies).toHaveBeenCalledWith(companies, mockPromptReviewDecision);
    });

    it('承認された企業のみ appendCompanies に渡す', async () => {
      const approved = [{ companyId: 'C1' }];
      mockReviewCompanies.mockResolvedValue({ approved, skippedCount: 1, remainingCount: 0 });
      mockAppendCompanies.mockResolvedValue({ appended: 1, merged: 0 });

      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
        review: true,
      });

      expect(mockAppendCompanies).toHaveBeenCalledWith(approved);
    });

    it('承認が0件のときは appendCompanies を呼ばない', async () => {
      mockReviewCompanies.mockResolvedValue({ approved: [], skippedCount: 3, remainingCount: 0 });

      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
        review: true,
      });

      expect(mockAppendCompanies).not.toHaveBeenCalled();
    });

    it('--dry-run 併用時は承認企業があっても appendCompanies を呼ばない', async () => {
      const approved = [{ companyId: 'C1' }];
      mockReviewCompanies.mockResolvedValue({ approved, skippedCount: 0, remainingCount: 0 });

      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: true,
        review: true,
      });

      expect(mockAppendCompanies).not.toHaveBeenCalled();
    });

    it('appendCompanies の appended/merged を printReviewSummary に渡す', async () => {
      const approved = [{ companyId: 'C1' }, { companyId: 'C2' }];
      mockReviewCompanies.mockResolvedValue({ approved, skippedCount: 8, remainingCount: 35 });
      mockAppendCompanies.mockResolvedValue({ appended: 15, merged: 2 });

      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
        review: true,
      });

      expect(mockPrintReviewSummary).toHaveBeenCalledWith({
        addedCount: 15,
        mergedCount: 2,
        skippedCount: 8,
        remainingCount: 35,
      });
    });

    it('承認0件のとき printReviewSummary に addedCount 0 / mergedCount 0 を渡す', async () => {
      mockReviewCompanies.mockResolvedValue({ approved: [], skippedCount: 5, remainingCount: 0 });

      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
        review: true,
      });

      expect(mockPrintReviewSummary).toHaveBeenCalledWith({
        addedCount: 0,
        mergedCount: 0,
        skippedCount: 5,
        remainingCount: 0,
      });
    });

    it('review 未指定時は reviewCompanies を呼ばない', async () => {
      await findCommand({
        industry: '飲食店',
        area: '東京',
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockReviewCompanies).not.toHaveBeenCalled();
    });
  });

  describe('エラー処理', () => {
    it('--limit が不正なとき process.exit(1) を呼ぶ', async () => {
      await expect(
        findCommand({
          industry: '飲食店',
          area: '東京',
          limit: 'abc',
          skipAnalyzer: false,
          dryRun: false,
        })
      ).rejects.toThrow('process.exit');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('--limit'));
    });

    it('findCompanies が例外を投げたとき process.exit(1) を呼ぶ', async () => {
      mockFindCompanies.mockRejectedValue(new Error('API 障害'));
      await expect(
        findCommand({
          industry: '飲食店',
          area: '東京',
          limit: '20',
          skipAnalyzer: false,
          dryRun: false,
        })
      ).rejects.toThrow('process.exit');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('API 障害'));
    });
  });
});
