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
import {
  buildPreviewItems,
  renderPreviewHeader,
  renderPreviewTable,
  renderTargetDetail,
  promptPreviewAction,
  promptPreviewNumber,
  promptDetailAction,
  runPreview,
} from './send-preview.js';
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

function loggedText() {
  return console.log.mock.calls.map((args) => args.join(' ')).join('\n');
}

// ─── buildPreviewItems（無改造・既存テストを維持） ─────────────────────────────

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

// ─── renderPreviewHeader ──────────────────────────────────────────────────────

describe('renderPreviewHeader', () => {
  it('テンプレートの表示名・内部名を表示する', () => {
    renderPreviewHeader({
      templateName: 'initial_contact',
      templateDisplayName: '初回営業',
      targetCount: 3,
      skipCount: 1,
    });
    const text = loggedText();
    expect(text).toContain('初回営業');
    expect(text).toContain('initial_contact');
  });

  it('送信対象件数・対象外件数を表示する', () => {
    renderPreviewHeader({
      templateName: 'x',
      templateDisplayName: 'X',
      targetCount: 3,
      skipCount: 1,
    });
    const text = loggedText();
    expect(text).toContain('3');
    expect(text).toContain('1');
  });

  it('excludedCount が0より大きいときのみ今回除外件数を表示する', () => {
    renderPreviewHeader({
      templateName: 'x',
      templateDisplayName: 'X',
      targetCount: 2,
      skipCount: 0,
      excludedCount: 1,
    });
    expect(loggedText()).toContain('今回除外');

    console.log.mockClear();
    renderPreviewHeader({ templateName: 'x', templateDisplayName: 'X', targetCount: 2, skipCount: 0 });
    expect(loggedText()).not.toContain('今回除外');
  });
});

// ─── renderPreviewTable ───────────────────────────────────────────────────────

describe('renderPreviewTable', () => {
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

  it('送信対象の会社名・メール・件名を表示する', () => {
    renderPreviewTable(targets, []);
    const text = loggedText();
    expect(text).toContain('株式会社ターゲット');
    expect(text).toContain('test@example.co.jp');
    expect(text).toContain('テスト件名');
  });

  it('送信対象外の会社名・理由を表示する', () => {
    renderPreviewTable(targets, skips);
    const text = loggedText();
    expect(text).toContain('株式会社スキップ');
    expect(text).toContain('メールなし');
  });

  it('送信対象 0件のとき「送信対象なし」を表示する', () => {
    renderPreviewTable([], []);
    expect(loggedText()).toContain('送信対象なし');
  });

  it('skips が空のとき「送信対象外」セクションを出力しない', () => {
    renderPreviewTable(targets, []);
    expect(loggedText()).not.toContain('送信対象外');
  });

  it('excluded を渡すと「今回のみ除外」セクションを表示する', () => {
    const excluded = [{ company: makeCompany({ companyId: 'C000003', companyName: '株式会社除外' }) }];
    renderPreviewTable(targets, [], excluded);
    const text = loggedText();
    expect(text).toContain('今回のみ除外');
    expect(text).toContain('株式会社除外');
    expect(text).toContain('営業リストは変更されません');
  });

  it('excluded を渡さない場合は「今回のみ除外」セクションを出力しない', () => {
    renderPreviewTable(targets, []);
    expect(loggedText()).not.toContain('今回のみ除外');
  });

  it('長い件名は省略表示する', () => {
    const longSubject = 'あ'.repeat(80);
    renderPreviewTable([{ ...targets[0], subject: longSubject }], []);
    expect(loggedText()).toContain('…');
  });
});

// ─── renderTargetDetail ───────────────────────────────────────────────────────

describe('renderTargetDetail', () => {
  it('件名・本文全文・HTML有無を表示する（省略しない）', () => {
    const longBody = Array.from({ length: 20 }, (_, i) => `行${i + 1}`).join('\n');
    const target = {
      company: makeCompany({ companyName: '株式会社詳細' }),
      subject: '詳細件名',
      textBody: longBody,
      htmlBody: '<p>html</p>',
    };
    renderTargetDetail(target, 1, 5);
    const text = loggedText();
    expect(text).toContain('株式会社詳細');
    expect(text).toContain('詳細件名');
    expect(text).toContain('行1');
    expect(text).toContain('行20');
    expect(text).toContain('HTML版: あり');
    expect(text).toContain('[2/5]');
  });

  it('htmlBody が無い場合は "HTML版: なし" と表示する', () => {
    const target = {
      company: makeCompany(),
      subject: 's',
      textBody: 't',
      htmlBody: undefined,
    };
    renderTargetDetail(target, 0, 1);
    expect(loggedText()).toContain('HTML版: なし');
  });
});

// ─── 対話プロンプト ─────────────────────────────────────────────────────────────

describe('promptPreviewAction', () => {
  it('選択結果を返す', async () => {
    mockPrompt.mockResolvedValueOnce({ action: 'send' });
    expect(await promptPreviewAction()).toBe('send');
  });
});

describe('promptPreviewNumber', () => {
  it('1-based の入力を 0-based に変換して返す', async () => {
    mockPrompt.mockResolvedValueOnce({ number: 2 });
    expect(await promptPreviewNumber(5)).toBe(1);
  });
});

describe('promptDetailAction', () => {
  it('選択結果を返す', async () => {
    mockPrompt.mockResolvedValueOnce({ action: 'exclude' });
    expect(await promptDetailAction()).toBe('exclude');
  });
});

// ─── runPreview ───────────────────────────────────────────────────────────────

describe('runPreview', () => {
  it('targets が 0件のときプロンプトを出さず confirmed:false を返す', async () => {
    const companies = [makeCompany({ email: '' })];
    const result = await runPreview(companies, TEMPLATES);
    expect(result).toEqual({ confirmed: false, excludedCompanyIds: [] });
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('「このまま送信する」を選ぶと confirmed:true を返す', async () => {
    const companies = [makeCompany()];
    mockPrompt.mockResolvedValueOnce({ action: 'send' });
    const result = await runPreview(companies, TEMPLATES);
    expect(result).toEqual({ confirmed: true, excludedCompanyIds: [] });
  });

  it('「キャンセル」を選ぶと confirmed:false を返す', async () => {
    const companies = [makeCompany()];
    mockPrompt.mockResolvedValueOnce({ action: 'cancel' });
    const result = await runPreview(companies, TEMPLATES);
    expect(result).toEqual({ confirmed: false, excludedCompanyIds: [] });
  });

  it('番号確認 → 一覧に戻る → 送信、で confirmed:true・除外なし', async () => {
    const companies = [makeCompany()];
    mockPrompt
      .mockResolvedValueOnce({ action: 'inspect' })
      .mockResolvedValueOnce({ number: 1 })
      .mockResolvedValueOnce({ action: 'back' })
      .mockResolvedValueOnce({ action: 'send' });

    const result = await runPreview(companies, TEMPLATES);

    expect(result).toEqual({ confirmed: true, excludedCompanyIds: [] });
  });

  it('番号確認 → 除外 → 送信、で除外した企業のIDが返る', async () => {
    const companies = [
      makeCompany({ companyId: 'C000001' }),
      makeCompany({ companyId: 'C000002', email: 'b@example.com' }),
    ];
    mockPrompt
      .mockResolvedValueOnce({ action: 'inspect' })
      .mockResolvedValueOnce({ number: 1 })
      .mockResolvedValueOnce({ action: 'exclude' })
      .mockResolvedValueOnce({ action: 'send' });

    const result = await runPreview(companies, TEMPLATES);

    expect(result).toEqual({ confirmed: true, excludedCompanyIds: ['C000001'] });
  });

  it('全社を除外すると自動的に confirmed:false になる', async () => {
    const companies = [makeCompany({ companyId: 'C000001' })];
    mockPrompt
      .mockResolvedValueOnce({ action: 'inspect' })
      .mockResolvedValueOnce({ number: 1 })
      .mockResolvedValueOnce({ action: 'exclude' });

    const result = await runPreview(companies, TEMPLATES);

    expect(result).toEqual({ confirmed: false, excludedCompanyIds: ['C000001'] });
  });

  it('除外後に一覧へ戻ると送信対象件数が更新される', async () => {
    const companies = [
      makeCompany({ companyId: 'C000001' }),
      makeCompany({ companyId: 'C000002', email: 'b@example.com' }),
    ];
    mockPrompt
      .mockResolvedValueOnce({ action: 'inspect' })
      .mockResolvedValueOnce({ number: 1 })
      .mockResolvedValueOnce({ action: 'exclude' })
      .mockResolvedValueOnce({ action: 'send' });

    console.log.mockClear();
    await runPreview(companies, TEMPLATES);

    const text = loggedText();
    // 除外後の再描画では送信対象は1件のみになっているはず
    expect(text).toContain('送信対象 1件');
  });
});
