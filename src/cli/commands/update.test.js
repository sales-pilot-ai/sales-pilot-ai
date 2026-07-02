import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../../sheets/index.js', () => ({
  createSheetsService: vi.fn(),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { updateCommand } from './update.js';
import { createSheetsService } from '../../sheets/index.js';

// ─── モックオブジェクト ───────────────────────────────────────────────────────

const mockSheetsService = {
  getAllCompanies: vi.fn(),
  updateCompanyByCompanyId: vi.fn(),
};

function makeCompany(overrides = {}) {
  return {
    companyId: 'C000001',
    companyName: 'テスト株式会社',
    memo: '',
    ...overrides,
  };
}

let exitSpy;

beforeEach(() => {
  vi.clearAllMocks();
  createSheetsService.mockResolvedValue(mockSheetsService);
  mockSheetsService.getAllCompanies.mockResolvedValue([makeCompany()]);
  mockSheetsService.updateCompanyByCompanyId.mockResolvedValue({});
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('updateCommand', () => {
  describe('バリデーション', () => {
    it('オプションが 1 つも指定されない場合はエラー終了する', async () => {
      await updateCommand('C000001', {});
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockSheetsService.updateCompanyByCompanyId).not.toHaveBeenCalled();
    });

    it('--won と --lost を同時に指定した場合はエラー終了する', async () => {
      await updateCommand('C000001', { won: true, lost: true });
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockSheetsService.updateCompanyByCompanyId).not.toHaveBeenCalled();
    });

    it('--meeting が YYYY-MM-DD 形式でない場合はエラー終了する', async () => {
      await updateCommand('C000001', { meeting: '2026/07/10' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockSheetsService.updateCompanyByCompanyId).not.toHaveBeenCalled();
    });

    it('存在しない companyId の場合はエラー終了する', async () => {
      mockSheetsService.getAllCompanies.mockResolvedValue([]);
      await updateCommand('C999999', { won: true });
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockSheetsService.updateCompanyByCompanyId).not.toHaveBeenCalled();
    });
  });

  describe('商談日の設定', () => {
    it('--meeting で商談日を設定する', async () => {
      await updateCommand('C000001', { meeting: '2026-07-10' });
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ meetingDate: '2026-07-10' })
      );
    });
  });

  describe('成約の記録', () => {
    it('--won で成約として記録する', async () => {
      await updateCommand('C000001', { won: true });
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ closed: '成約' })
      );
    });
  });

  describe('失注の記録', () => {
    it('--lost（理由なし）で失注として記録する', async () => {
      await updateCommand('C000001', { lost: true });
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ closed: '失注' })
      );
    });

    it('--lost <理由> を指定するとメモに失注理由が追記される', async () => {
      await updateCommand('C000001', { lost: '予算合わず' });
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ closed: '失注', memo: '失注理由: 予算合わず' })
      );
    });

    it('既存メモがある場合は末尾に追記する', async () => {
      mockSheetsService.getAllCompanies.mockResolvedValue([makeCompany({ memo: '担当: 山田様' })]);
      await updateCommand('C000001', { lost: '予算合わず' });
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ memo: '担当: 山田様 / 失注理由: 予算合わず' })
      );
    });
  });

  describe('メモの追記', () => {
    it('--memo でメモを追記する', async () => {
      await updateCommand('C000001', { memo: '契約書送付済み' });
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledWith(
        'C000001',
        expect.objectContaining({ memo: '契約書送付済み' })
      );
    });
  });

  describe('新しい API コール', () => {
    it('getAllCompanies と updateCompanyByCompanyId のみを呼ぶ', async () => {
      await updateCommand('C000001', { won: true });
      expect(mockSheetsService.getAllCompanies).toHaveBeenCalledTimes(1);
      expect(mockSheetsService.updateCompanyByCompanyId).toHaveBeenCalledTimes(1);
    });
  });

  describe('エラー耐性', () => {
    it('updateCompanyByCompanyId がエラーを投げた場合はプロセスを終了する', async () => {
      mockSheetsService.updateCompanyByCompanyId.mockRejectedValue(new Error('Sheets API error'));
      await updateCommand('C000001', { won: true });
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
