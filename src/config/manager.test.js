import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockReadFileSync, mockWriteFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { CONFIG_KEYS, CONFIG_LABELS, getCurrentValue, getAllSettings, updateSetting } =
  await import('./manager.js');

// ─── テストデータ ─────────────────────────────────────────────────────────────

const MOCK_SETTINGS = {
  sheets: {
    headerRow: true,
    columns: {},
    approvalValue: '○',
  },
  crawler: { defaultLimit: 20, requestDelayMs: 1500 },
  mailer: { sendIntervalMs: 3000 },
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPREADSHEET_ID;
  delete process.env.SHEET_NAME;
  delete process.env.GMAIL_FROM;
  delete process.env.MEETING_URL;
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('CONFIG_KEYS', () => {
  it('6 つのキーを含む', () => {
    expect(CONFIG_KEYS).toHaveLength(6);
    expect(CONFIG_KEYS).toContain('SPREADSHEET_ID');
    expect(CONFIG_KEYS).toContain('DEFAULT_LIMIT');
  });
});

describe('CONFIG_LABELS', () => {
  it('全キーにラベルが対応している', () => {
    for (const key of CONFIG_KEYS) {
      expect(CONFIG_LABELS[key]).toBeTruthy();
    }
  });
});

describe('getCurrentValue', () => {
  it('.env キー: process.env から読む', () => {
    process.env.SPREADSHEET_ID = 'sheet_abc';
    expect(getCurrentValue('SPREADSHEET_ID')).toBe('sheet_abc');
  });

  it('.env キー: 未設定なら空文字を返す', () => {
    expect(getCurrentValue('SPREADSHEET_ID')).toBe('');
  });

  it('settings.json キー: DEFAULT_LIMIT をファイルから読む', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_SETTINGS));
    expect(getCurrentValue('DEFAULT_LIMIT')).toBe('20');
  });

  it('settings.json キー: REQUEST_DELAY_MS をファイルから読む', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_SETTINGS));
    expect(getCurrentValue('REQUEST_DELAY_MS')).toBe('1500');
  });
});

describe('getAllSettings', () => {
  it('全キーのオブジェクトを返す', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_SETTINGS));
    process.env.SPREADSHEET_ID = 'sid';
    process.env.GMAIL_FROM = 'a@b.com';

    const result = getAllSettings();

    expect(result.SPREADSHEET_ID).toBe('sid');
    expect(result.GMAIL_FROM).toBe('a@b.com');
    expect(result.DEFAULT_LIMIT).toBe('20');
    expect(result.REQUEST_DELAY_MS).toBe('1500');
  });
});

describe('updateSetting', () => {
  describe('.env キー', () => {
    it('既存キーを上書きして .env を書く', () => {
      mockReadFileSync.mockReturnValue('SPREADSHEET_ID=old\nSHEET_NAME=営業リスト\n');
      updateSetting('SPREADSHEET_ID', 'new_id');
      expect(mockWriteFileSync).toHaveBeenCalledOnce();
      const [, content] = mockWriteFileSync.mock.calls[0];
      expect(content).toContain('SPREADSHEET_ID=new_id');
      expect(content).not.toContain('SPREADSHEET_ID=old');
    });

    it('存在しないキーを末尾に追加する', () => {
      mockReadFileSync.mockReturnValue('SHEET_NAME=Sheet1\n');
      updateSetting('SPREADSHEET_ID', 'brand_new');
      const [, content] = mockWriteFileSync.mock.calls[0];
      expect(content).toContain('SPREADSHEET_ID=brand_new');
    });

    it('process.env にも反映する', () => {
      mockReadFileSync.mockReturnValue('');
      updateSetting('GMAIL_FROM', 'test@example.com');
      expect(process.env.GMAIL_FROM).toBe('test@example.com');
    });
  });

  describe('settings.json キー', () => {
    it('DEFAULT_LIMIT を数値で書き込む', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_SETTINGS));
      updateSetting('DEFAULT_LIMIT', '30');
      const [, content] = mockWriteFileSync.mock.calls[0];
      expect(JSON.parse(content).crawler.defaultLimit).toBe(30);
    });

    it('REQUEST_DELAY_MS を数値で書き込む', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_SETTINGS));
      updateSetting('REQUEST_DELAY_MS', '2000');
      const [, content] = mockWriteFileSync.mock.calls[0];
      expect(JSON.parse(content).crawler.requestDelayMs).toBe(2000);
    });
  });

  describe('エラー処理', () => {
    it('未知のキーで例外を投げる', () => {
      expect(() => updateSetting('UNKNOWN_KEY', 'value')).toThrow(
        '未知の設定キーです: UNKNOWN_KEY'
      );
    });
  });
});
