import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockFindCompanies, mockPromptFindOptions } = vi.hoisted(() => ({
  mockFindCompanies: vi.fn(),
  mockPromptFindOptions: vi.fn(),
}));

vi.mock('../../crawler/find.js', () => ({
  findCompanies: mockFindCompanies,
}));

vi.mock('../prompts.js', () => ({
  promptFindOptions: mockPromptFindOptions,
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
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: true,
      });
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
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: true,
      });
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
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: true,
      });
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
      mockPromptFindOptions.mockResolvedValue({
        industry: '美容室',
        area: '大阪',
        limit: 20,
        confirmed: true,
      });
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
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: true,
      });
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
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 5,
        confirmed: true,
      });
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

    it('confirmed: true のとき findCompanies を実行する', async () => {
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: true,
      });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockFindCompanies).toHaveBeenCalledOnce();
    });

    it('confirmed: false のとき findCompanies を実行しない', async () => {
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: false,
      });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(mockFindCompanies).not.toHaveBeenCalled();
    });

    it('confirmed: false のとき "キャンセルしました" をログ出力する', async () => {
      mockPromptFindOptions.mockResolvedValue({
        industry: '飲食店',
        area: '東京',
        limit: 20,
        confirmed: false,
      });
      await findCommand({
        industry: undefined,
        area: undefined,
        limit: '20',
        skipAnalyzer: false,
        dryRun: false,
      });
      expect(logger.info).toHaveBeenCalledWith('キャンセルしました');
    });

    it('対話で得た値を findCompanies に渡す', async () => {
      mockPromptFindOptions.mockResolvedValue({
        industry: '整骨院',
        area: '神奈川県横浜市',
        limit: 8,
        confirmed: true,
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
