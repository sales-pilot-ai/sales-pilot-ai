import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockPrompt, mockGetAllSettings, mockUpdateSetting } = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
  mockGetAllSettings: vi.fn(),
  mockUpdateSetting: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: mockPrompt,
    Separator: class {
      constructor(text) {
        this.type = 'separator';
        this.separator = text || '──────────────';
      }
    },
  },
}));

vi.mock('../../config/manager.js', () => ({
  CONFIG_KEYS: [
    'SPREADSHEET_ID',
    'SHEET_NAME',
    'GMAIL_FROM',
    'MEETING_URL',
    'DEFAULT_LIMIT',
    'REQUEST_DELAY_MS',
  ],
  CONFIG_LABELS: {
    SPREADSHEET_ID: 'Google Sheets ID',
    SHEET_NAME: 'Sheet名',
    GMAIL_FROM: 'Gmail送信元',
    MEETING_URL: 'Meeting URL',
    DEFAULT_LIMIT: 'デフォルト取得件数',
    REQUEST_DELAY_MS: 'WebsiteAnalyzer待機時間(ms)',
  },
  getAllSettings: mockGetAllSettings,
  updateSetting: mockUpdateSetting,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn() },
}));

vi.mock('chalk', () => ({
  default: Object.assign((s) => s, { cyan: (s) => s, dim: (s) => s, bold: (s) => s }),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { configCommand } = await import('./config.js');
const { logger } = await import('../../utils/logger.js');

// ─── セットアップ ─────────────────────────────────────────────────────────────

const CURRENT_SETTINGS = {
  SPREADSHEET_ID: 'current_id',
  SHEET_NAME: '営業リスト',
  GMAIL_FROM: 'old@example.com',
  MEETING_URL: '',
  DEFAULT_LIMIT: '20',
  REQUEST_DELAY_MS: '1500',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllSettings.mockReturnValue({ ...CURRENT_SETTINGS });
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('configCommand', () => {
  it('起動時に getAllSettings を呼ぶ', async () => {
    // 即座に終了を選択
    mockPrompt.mockResolvedValueOnce({ key: null });

    await configCommand();
    expect(mockGetAllSettings).toHaveBeenCalledOnce();
  });

  it('"終了" を選択するとループを抜ける', async () => {
    mockPrompt.mockResolvedValueOnce({ key: null });

    await configCommand();
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  it('キー選択 → 値入力 → updateSetting を呼ぶ', async () => {
    mockPrompt
      .mockResolvedValueOnce({ key: 'SPREADSHEET_ID' }) // キー選択
      .mockResolvedValueOnce({ value: 'new_id' }) // 値入力
      .mockResolvedValueOnce({ key: null }); // 終了

    await configCommand();
    expect(mockUpdateSetting).toHaveBeenCalledWith('SPREADSHEET_ID', 'new_id');
  });

  it('保存後に success ログを出す', async () => {
    mockPrompt
      .mockResolvedValueOnce({ key: 'GMAIL_FROM' })
      .mockResolvedValueOnce({ value: 'new@example.com' })
      .mockResolvedValueOnce({ key: null });

    await configCommand();
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Gmail送信元'));
  });

  it('複数設定を連続して変更できる', async () => {
    mockGetAllSettings
      .mockReturnValueOnce({ ...CURRENT_SETTINGS })
      .mockReturnValueOnce({ ...CURRENT_SETTINGS, SPREADSHEET_ID: 'new_id' })
      .mockReturnValueOnce({ ...CURRENT_SETTINGS });

    mockPrompt
      .mockResolvedValueOnce({ key: 'SPREADSHEET_ID' })
      .mockResolvedValueOnce({ value: 'new_id' })
      .mockResolvedValueOnce({ key: 'GMAIL_FROM' })
      .mockResolvedValueOnce({ value: 'new@example.com' })
      .mockResolvedValueOnce({ key: null });

    await configCommand();
    expect(mockUpdateSetting).toHaveBeenCalledTimes(2);
    expect(mockUpdateSetting).toHaveBeenNthCalledWith(1, 'SPREADSHEET_ID', 'new_id');
    expect(mockUpdateSetting).toHaveBeenNthCalledWith(2, 'GMAIL_FROM', 'new@example.com');
  });

  it('終了時に logger.info を呼ぶ', async () => {
    mockPrompt.mockResolvedValueOnce({ key: null });

    await configCommand();
    expect(logger.info).toHaveBeenCalledWith('設定を終了しました');
  });
});
