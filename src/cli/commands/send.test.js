import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const {
  mockGetApprovedRows,
  mockUpdateStatus,
  mockCreateSendHistoryService,
  mockGenerateBatchId,
  mockCreateMailer,
  mockLoadEmailTemplates,
  mockBuildEmailContent,
  mockShouldSkip,
  mockRunPreview,
  mockListTemplates,
  mockTemplateExists,
} = vi.hoisted(() => ({
  mockGetApprovedRows: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockCreateSendHistoryService: vi.fn(),
  mockGenerateBatchId: vi.fn(() => 'batch-1'),
  mockCreateMailer: vi.fn(),
  mockLoadEmailTemplates: vi.fn(),
  mockBuildEmailContent: vi.fn(),
  mockShouldSkip: vi.fn(),
  mockRunPreview: vi.fn(),
  mockListTemplates: vi.fn(),
  mockTemplateExists: vi.fn(),
}));

vi.mock('../../sheets/index.js', () => ({
  getApprovedRows: mockGetApprovedRows,
  updateStatus: mockUpdateStatus,
  createSendHistoryService: mockCreateSendHistoryService,
  SEND_RESULT: { SUCCESS: 'SUCCESS', FAILED: 'FAILED', SKIPPED: 'SKIPPED' },
  generateBatchId: mockGenerateBatchId,
}));

vi.mock('../../gmail/index.js', () => ({
  createMailer: mockCreateMailer,
}));

vi.mock('./email-builder.js', () => ({
  loadEmailTemplates: mockLoadEmailTemplates,
  buildEmailContent: mockBuildEmailContent,
}));

vi.mock('./send-filter.js', () => ({
  shouldSkip: mockShouldSkip,
}));

vi.mock('./send-preview.js', () => ({
  runPreview: mockRunPreview,
}));

vi.mock('../../templates/manager.js', () => ({
  listTemplates: mockListTemplates,
  templateExists: mockTemplateExists,
}));

vi.mock('../../config/index.js', () => ({
  env: { isDryRun: false, gmailFrom: 'from@example.com', sendIntervalMs: 0 },
  settings: { mailer: { defaultTemplate: 'initial_contact' } },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn() },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { sendCommand } = await import('./send.js');
const { logger } = await import('../../utils/logger.js');

// ─── セットアップ ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApprovedRows.mockResolvedValue([]);
  mockTemplateExists.mockReturnValue(true);
  mockListTemplates.mockReturnValue([
    { name: 'initial_contact', displayName: '初回営業' },
    { name: 'second_follow_up', displayName: '2回目フォロー' },
  ]);
  mockLoadEmailTemplates.mockReturnValue({
    textTemplate: 't',
    htmlTemplate: null,
    subjectTemplate: null,
  });
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit');
  });
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('sendCommand — テンプレート解決', () => {
  it('--template 未指定時は settings.mailer.defaultTemplate を使う', async () => {
    mockGetApprovedRows.mockResolvedValue([{ companyId: 'C1', companyName: 'A' }]);
    mockShouldSkip.mockReturnValue({ skip: true, reason: '送信可否×' });
    await sendCommand({});
    expect(mockTemplateExists).toHaveBeenCalledWith('initial_contact');
    expect(mockLoadEmailTemplates).toHaveBeenCalledWith('initial_contact');
  });

  it('--template 指定時はそちらを優先する', async () => {
    mockGetApprovedRows.mockResolvedValue([{ companyId: 'C1', companyName: 'A' }]);
    mockShouldSkip.mockReturnValue({ skip: true, reason: '送信可否×' });
    await sendCommand({ template: 'second_follow_up' });
    expect(mockTemplateExists).toHaveBeenCalledWith('second_follow_up');
    expect(mockLoadEmailTemplates).toHaveBeenCalledWith('second_follow_up');
  });

  it('存在しないテンプレートを指定すると process.exit(1) する', async () => {
    mockTemplateExists.mockReturnValue(false);
    await expect(sendCommand({ template: 'unknown' })).rejects.toThrow('process.exit');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    expect(mockLoadEmailTemplates).not.toHaveBeenCalled();
  });

  it('送信対象0件でもテンプレート存在チェックは行う', async () => {
    mockGetApprovedRows.mockResolvedValue([]);
    await sendCommand({ template: 'second_follow_up' });
    expect(mockTemplateExists).toHaveBeenCalledWith('second_follow_up');
  });
});

describe('sendCommand — --preview', () => {
  const companies = [
    { companyId: 'C1', companyName: 'A' },
    { companyId: 'C2', companyName: 'B' },
  ];

  beforeEach(() => {
    mockGetApprovedRows.mockResolvedValue(companies);
    mockShouldSkip.mockReturnValue({ skip: true, reason: '送信可否×' });
  });

  it('runPreview にテンプレート名・表示名を渡す', async () => {
    mockRunPreview.mockResolvedValue({ confirmed: true, excludedCompanyIds: [] });
    await sendCommand({ preview: true });
    expect(mockRunPreview).toHaveBeenCalledWith(
      companies,
      expect.any(Object),
      expect.objectContaining({ templateName: 'initial_contact', templateDisplayName: '初回営業' })
    );
  });

  it('confirmed:false のとき送信ループを実行しない', async () => {
    mockRunPreview.mockResolvedValue({ confirmed: false, excludedCompanyIds: [] });
    await sendCommand({ preview: true });
    expect(mockShouldSkip).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('送信をキャンセルしました');
  });

  it('excludedCompanyIds で指定した企業は送信ループの対象から外れる', async () => {
    mockRunPreview.mockResolvedValue({ confirmed: true, excludedCompanyIds: ['C1'] });
    await sendCommand({ preview: true });
    const processedIds = mockShouldSkip.mock.calls.map(([company]) => company.companyId);
    expect(processedIds).toEqual(['C2']);
  });

  it('除外が無い場合は全社が送信ループの対象になる', async () => {
    mockRunPreview.mockResolvedValue({ confirmed: true, excludedCompanyIds: [] });
    await sendCommand({ preview: true });
    const processedIds = mockShouldSkip.mock.calls.map(([company]) => company.companyId);
    expect(processedIds).toEqual(['C1', 'C2']);
  });
});
