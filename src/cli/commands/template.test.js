import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const {
  mockPrompt,
  mockListTemplates,
  mockGetTemplate,
  mockCreateTemplate,
  mockUpdateTemplate,
  mockDuplicateTemplate,
  mockDeleteTemplate,
} = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
  mockListTemplates: vi.fn(),
  mockGetTemplate: vi.fn(),
  mockCreateTemplate: vi.fn(),
  mockUpdateTemplate: vi.fn(),
  mockDuplicateTemplate: vi.fn(),
  mockDeleteTemplate: vi.fn(),
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

vi.mock('../../templates/manager.js', () => ({
  listTemplates: mockListTemplates,
  getTemplate: mockGetTemplate,
  createTemplate: mockCreateTemplate,
  updateTemplate: mockUpdateTemplate,
  duplicateTemplate: mockDuplicateTemplate,
  deleteTemplate: mockDeleteTemplate,
}));

vi.mock('../../config/index.js', () => ({
  settings: { mailer: { defaultTemplate: 'initial_contact' } },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn() },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const {
  templateListCommand,
  templateShowCommand,
  templateCreateCommand,
  templateEditCommand,
  templateDuplicateCommand,
  templateDeleteCommand,
} = await import('./template.js');
const { logger } = await import('../../utils/logger.js');

// ─── テストヘルパー ───────────────────────────────────────────────────────────

function makeTemplateMeta(overrides = {}) {
  return {
    name: 'initial_contact',
    displayName: '初回営業',
    description: '新規開拓の初回コンタクトメール',
    hasHtml: true,
    updatedAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeTemplateFull(overrides = {}) {
  return {
    name: 'initial_contact',
    displayName: '初回営業',
    description: '説明',
    subject: '件名です',
    textBody: '本文です',
    htmlBody: '<p>HTML本文</p>',
    ...overrides,
  };
}

let exitSpy;
let logSpy;

beforeEach(() => {
  vi.clearAllMocks();
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

function loggedText() {
  return logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('templateListCommand', () => {
  it('テンプレートが無い場合は案内を表示する', async () => {
    mockListTemplates.mockReturnValue([]);
    await templateListCommand();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('sales-pilot template create'));
  });

  it('デフォルトテンプレートに ★ と (default) を付ける', async () => {
    mockListTemplates.mockReturnValue([
      makeTemplateMeta({ name: 'initial_contact' }),
      makeTemplateMeta({ name: 'second_follow_up', displayName: '2回目フォロー' }),
    ]);
    await templateListCommand();
    const text = loggedText();
    expect(text).toContain('★ initial_contact (default)');
    expect(text).toContain('  second_follow_up');
    expect(text).not.toContain('second_follow_up (default)');
  });
});

describe('templateShowCommand', () => {
  it('件名・テキスト本文・HTML本文を表示する', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull());
    await templateShowCommand('initial_contact');
    const text = loggedText();
    expect(text).toContain('件名です');
    expect(text).toContain('本文です');
    expect(text).toContain('<p>HTML本文</p>');
  });

  it('デフォルトテンプレートには ★ (default) を表示する', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull({ name: 'initial_contact' }));
    await templateShowCommand('initial_contact');
    expect(loggedText()).toContain('★ (default)');
  });

  it('存在しないテンプレートは process.exit(1)', async () => {
    mockGetTemplate.mockImplementation(() => {
      throw new Error('テンプレートが見つかりません: unknown');
    });
    await templateShowCommand('unknown');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('templateCreateCommand', () => {
  it('入力内容で createTemplate を呼ぶ（HTML無し）', async () => {
    mockPrompt.mockResolvedValueOnce({
      name: 'second_follow_up',
      displayName: '2回目フォロー',
      description: '',
      subject: '件名',
      textBody: '本文',
      wantsHtml: false,
    });

    await templateCreateCommand();

    expect(mockCreateTemplate).toHaveBeenCalledWith({
      name: 'second_follow_up',
      displayName: '2回目フォロー',
      description: '',
      subject: '件名',
      textBody: '本文',
      htmlBody: null,
    });
  });

  it('wantsHtml が true のとき追加でHTML入力を求める', async () => {
    mockPrompt
      .mockResolvedValueOnce({
        name: 'second_follow_up',
        displayName: '2回目フォロー',
        description: '',
        subject: '件名',
        textBody: '本文',
        wantsHtml: true,
      })
      .mockResolvedValueOnce({ htmlBody: '<p>本文</p>' });

    await templateCreateCommand();

    expect(mockCreateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ htmlBody: '<p>本文</p>' })
    );
  });

  it('createTemplate が例外を投げた場合は process.exit(1)', async () => {
    mockPrompt.mockResolvedValueOnce({
      name: 'x',
      displayName: 'x',
      description: '',
      subject: 's',
      textBody: 't',
      wantsHtml: false,
    });
    mockCreateTemplate.mockImplementation(() => {
      throw new Error('テンプレート「x」は既に存在します');
    });

    await templateCreateCommand();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('templateEditCommand', () => {
  it('存在しないテンプレートは process.exit(1)', async () => {
    mockGetTemplate.mockImplementation(() => {
      throw new Error('テンプレートが見つかりません: unknown');
    });
    await templateEditCommand('unknown');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('「終了」を選ぶと即座にループを抜ける', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull());
    mockPrompt.mockResolvedValueOnce({ field: null });

    await templateEditCommand('initial_contact');

    expect(mockUpdateTemplate).not.toHaveBeenCalled();
  });

  it('件名を選択すると updateTemplate に subject を渡す', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull());
    mockUpdateTemplate.mockReturnValue(makeTemplateFull({ subject: '新件名' }));
    mockPrompt
      .mockResolvedValueOnce({ field: 'subject' })
      .mockResolvedValueOnce({ value: '新件名' })
      .mockResolvedValueOnce({ field: null });

    await templateEditCommand('initial_contact');

    expect(mockUpdateTemplate).toHaveBeenCalledWith('initial_contact', { subject: '新件名' });
  });

  it('本文（HTML）を選択すると editor タイプで更新する', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull());
    mockUpdateTemplate.mockReturnValue(makeTemplateFull());
    mockPrompt
      .mockResolvedValueOnce({ field: 'htmlBody' })
      .mockResolvedValueOnce({ value: '<p>新HTML</p>' })
      .mockResolvedValueOnce({ field: null });

    await templateEditCommand('initial_contact');

    expect(mockUpdateTemplate).toHaveBeenCalledWith('initial_contact', {
      htmlBody: '<p>新HTML</p>',
    });
  });
});

describe('templateDuplicateCommand', () => {
  it('displayName/description を渡して duplicateTemplate を呼ぶ', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull({ displayName: '初回営業' }));
    mockPrompt.mockResolvedValueOnce({ displayName: '2回目フォロー', description: '説明' });
    mockDuplicateTemplate.mockReturnValue(makeTemplateFull({ name: 'second_follow_up' }));

    await templateDuplicateCommand('initial_contact', 'second_follow_up');

    expect(mockDuplicateTemplate).toHaveBeenCalledWith('initial_contact', 'second_follow_up', {
      displayName: '2回目フォロー',
      description: '説明',
    });
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('second_follow_up'));
  });

  it('複製元が存在しない場合は process.exit(1)', async () => {
    mockGetTemplate.mockImplementation(() => {
      throw new Error('テンプレートが見つかりません: unknown');
    });
    await templateDuplicateCommand('unknown', 'new_name');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('templateDeleteCommand', () => {
  it('確認後に deleteTemplate を呼ぶ', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull({ name: 'second_follow_up' }));
    mockPrompt.mockResolvedValueOnce({ confirmed: true });

    await templateDeleteCommand('second_follow_up');

    expect(mockDeleteTemplate).toHaveBeenCalledWith('second_follow_up');
  });

  it('確認をキャンセルすると deleteTemplate を呼ばない', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull({ name: 'second_follow_up' }));
    mockPrompt.mockResolvedValueOnce({ confirmed: false });

    await templateDeleteCommand('second_follow_up');

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });

  it('現在のデフォルトテンプレートは削除できない', async () => {
    mockGetTemplate.mockReturnValue(makeTemplateFull({ name: 'initial_contact' }));

    await templateDeleteCommand('initial_contact');

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('削除できません'));
  });

  it('存在しないテンプレートは process.exit(1)', async () => {
    mockGetTemplate.mockImplementation(() => {
      throw new Error('テンプレートが見つかりません: unknown');
    });
    await templateDeleteCommand('unknown');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
