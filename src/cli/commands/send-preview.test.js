import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockPrompt } = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

vi.mock('chalk', () => ({
  default: Object.assign((s) => s, {
    bold: (s) => s,
    dim: (s) => s,
    cyan: (s) => s,
    green: Object.assign((s) => s, { bold: (s) => s }),
    yellow: (s) => s,
  }),
}));

vi.mock('./email-builder.js', () => ({
  buildEmailContent: vi.fn(),
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { buildEmailContent } from './email-builder.js';
import { buildPreviewItems, renderPreview, confirmSend, runPreview } from './send-preview.js';
import { SEND_STATUS } from '../../constants/index.js';

// ─── セットアップ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  buildEmailContent.mockResolvedValue({
    subject: 'テスト件名',
    textBody: '本文1行目\n本文2行目\n本文3行目',
    htmlBody: undefined,
  });
});

// ─── テストデータ ─────────────────────────────────────────────────────────────

function makeCompany(overrides = {}) {
  return {
    companyId: 'C000001',
    companyName: '株式会社テスト',
    email: 'test@example.co.jp',
    status: '',
    ...overrides,
  };
}

const TEMPLATES = {
  textTemplate: 'テンプレート',
  htmlTemplate: null,
  subjectTemplate: null,
};

// ─── buildPreviewItems ────────────────────────────────────────────────────────

describe('buildPreviewItems', () => {
  describe('送信対象の分類', () => {
    it('メールあり・未送信は targets に入る', async () => {
      const companies = [makeCompany()];
      const { targets, skips } = await buildPreviewItems(companies, TEMPLATES);
      expect(targets).toHaveLength(1);
      expect(skips).toHaveLength(0);
    });

    it('targets に subject と textBody が含まれる', async () => {
      const companies = [makeCompany()];
      const { targets } = await buildPreviewItems(companies, TEMPLATES);
      expect(targets[0].subject).toBe('テスト件名');
      expect(targets[0].textBody).toBe('本文1行目\n本文2行目\n本文3行目');
    });
  });

  describe('送信対象外の分類', () => {
    it('メールなしは skips に入り reason が "メールなし"', async () => {
      const companies = [makeCompany({ email: '' })];
      const { targets, skips } = await buildPreviewItems(companies, TEMPLATES);
      expect(targets).toHaveLength(0);
      expect(skips).toHaveLength(1);
      expect(skips[0].reason).toBe('メールなし');
    });

    it('送信済は skips に入り reason が "送信済"', async () => {
      const companies = [makeCompany({ status: SEND_STATUS.SENT })];
      const { skips } = await buildPreviewItems(companies, TEMPLATES);
      expect(skips[0].reason).toBe(SEND_STATUS.SENT);
    });

    it('返信ありは skips に入り reason が "返信あり"', async () => {
      const companies = [makeCompany({ status: SEND_STATUS.REPLIED })];
      const { skips } = await buildPreviewItems(companies, TEMPLATES);
      expect(skips[0].reason).toBe(SEND_STATUS.REPLIED);
    });

    it('配信停止は skips に入る', async () => {
      const companies = [makeCompany({ status: SEND_STATUS.UNSUBSCRIBED })];
      const { skips } = await buildPreviewItems(companies, TEMPLATES);
      expect(skips).toHaveLength(1);
    });
  });

  describe('force オプション', () => {
    it('force=false のとき送信済は skips', async () => {
      const companies = [makeCompany({ status: SEND_STATUS.SENT })];
      const { targets, skips } = await buildPreviewItems(companies, TEMPLATES, { force: false });
      expect(targets).toHaveLength(0);
      expect(skips).toHaveLength(1);
    });

    it('force=true のとき送信済は targets', async () => {
      const companies = [makeCompany({ status: SEND_STATUS.SENT })];
      const { targets } = await buildPreviewItems(companies, TEMPLATES, { force: true });
      expect(targets).toHaveLength(1);
    });

    it('force=true でも返信ありは skips のまま', async () => {
      const companies = [makeCompany({ status: SEND_STATUS.REPLIED })];
      const { skips } = await buildPreviewItems(companies, TEMPLATES, { force: true });
      expect(skips).toHaveLength(1);
    });
  });

  describe('複数企業の混在', () => {
    it('対象 2件・対象外 2件が正しく分類される', async () => {
      const companies = [
        makeCompany({ companyId: 'C000001', email: 'a@example.com' }),
        makeCompany({ companyId: 'C000002', email: '' }),
        makeCompany({ companyId: 'C000003', email: 'c@example.com' }),
        makeCompany({ companyId: 'C000004', email: 'd@example.com', status: SEND_STATUS.SENT }),
      ];
      const { targets, skips } = await buildPreviewItems(companies, TEMPLATES);
      expect(targets).toHaveLength(2);
      expect(skips).toHaveLength(2);
    });
  });

  describe('buildEmailContent の呼び出し', () => {
    it('targets の数だけ buildEmailContent を呼ぶ', async () => {
      const companies = [
        makeCompany({ companyId: 'C000001' }),
        makeCompany({ companyId: 'C000002' }),
        makeCompany({ companyId: 'C000003', email: '' }),
      ];
      await buildPreviewItems(companies, TEMPLATES);
      expect(buildEmailContent).toHaveBeenCalledTimes(2);
    });
  });
});

// ─── renderPreview ────────────────────────────────────────────────────────────

describe('renderPreview', () => {
  const targets = [
    {
      company: makeCompany({ companyId: 'C000001', companyName: '株式会社ターゲット' }),
      subject: 'テスト件名',
      textBody: '本文1\n本文2\n本文3',
    },
  ];
  const skips = [
    {
      company: makeCompany({ companyId: 'C000002', companyName: '株式会社スキップ' }),
      reason: 'メールなし',
    },
  ];

  it('console.log を呼ぶ', () => {
    renderPreview(targets, skips);
    expect(console.log).toHaveBeenCalled();
  });

  it('送信対象企業名が出力に含まれる', () => {
    renderPreview(targets, skips);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toContain('株式会社ターゲット');
  });

  it('件名が出力に含まれる', () => {
    renderPreview(targets, skips);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toContain('テスト件名');
  });

  it('メールアドレスが出力に含まれる', () => {
    renderPreview(targets, skips);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toContain('test@example.co.jp');
  });

  it('送信対象外企業名が出力に含まれる', () => {
    renderPreview(targets, skips);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toContain('株式会社スキップ');
  });

  it('スキップ理由が出力に含まれる', () => {
    renderPreview(targets, skips);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toContain('メールなし');
  });

  it('送信対象 0件のとき "送信対象なし" を表示する', () => {
    renderPreview([], []);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toContain('送信対象なし');
  });

  it('skips が空のとき "送信対象外" セクションを出力しない', () => {
    renderPreview(targets, []);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).not.toContain('送信対象外');
  });

  it('本文が BODY_PREVIEW_LINES（5行）を超えたとき省略表示する', () => {
    const longBody = Array.from({ length: 10 }, (_, i) => `行${i + 1}`).join('\n');
    renderPreview([{ ...targets[0], textBody: longBody }], []);
    const output = console.log.mock.calls.flat().join('\n');
    expect(output).toMatch(/全10行/);
  });
});

// ─── confirmSend ─────────────────────────────────────────────────────────────

describe('confirmSend', () => {
  it('Y を選択した場合 true を返す', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: true });
    const result = await confirmSend();
    expect(result).toBe(true);
  });

  it('N を選択した場合 false を返す', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: false });
    const result = await confirmSend();
    expect(result).toBe(false);
  });

  it('inquirer.prompt を 1 回呼ぶ', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: true });
    await confirmSend();
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });
});

// ─── runPreview ───────────────────────────────────────────────────────────────

describe('runPreview', () => {
  it('targets が 0件のとき false を返す（確認プロンプトを出さない）', async () => {
    const companies = [makeCompany({ email: '' })];
    const result = await runPreview(companies, TEMPLATES);
    expect(result).toBe(false);
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('targets があるとき confirmSend を呼ぶ', async () => {
    const companies = [makeCompany()];
    mockPrompt.mockResolvedValueOnce({ confirmed: true });
    const result = await runPreview(companies, TEMPLATES);
    expect(result).toBe(true);
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('N を選択した場合 false を返す', async () => {
    const companies = [makeCompany()];
    mockPrompt.mockResolvedValueOnce({ confirmed: false });
    const result = await runPreview(companies, TEMPLATES);
    expect(result).toBe(false);
  });
});
