import { describe, it, expect, vi } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../config/index.js', () => ({
  env: {},
  settings: { sheets: { approvalValue: '○' } },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import { SheetsService } from './service.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

function makeCompany(overrides = {}) {
  return {
    companyId: 'C000001',
    companyName: 'テスト株式会社',
    sendApproval: '',
    status: '',
    sentDate: '',
    hasReply: '',
    meetingDate: '',
    closed: '',
    ...overrides,
  };
}

function makeService(companies) {
  const service = new SheetsService({ sheetsApi: {}, spreadsheetId: 'sheet-id' });
  vi.spyOn(service, 'getAllCompanies').mockResolvedValue(companies);
  return service;
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('SheetsService.getStats', () => {
  it('新しい API コールを追加せず getAllCompanies のみを呼ぶ', async () => {
    const service = makeService([]);
    await service.getStats();
    expect(service.getAllCompanies).toHaveBeenCalledTimes(1);
  });

  it('総企業数を返す', async () => {
    const service = makeService([makeCompany(), makeCompany({ companyId: 'C000002' })]);
    const stats = await service.getStats();
    expect(stats.totalCompanies).toBe(2);
  });

  it('sentDate が設定されている企業を送信済件数として数える', async () => {
    const service = makeService([
      makeCompany({ sentDate: '2026-07-01' }),
      makeCompany({ sentDate: '' }),
      makeCompany({ status: '返信あり', sentDate: '2026-06-01' }),
    ]);
    const stats = await service.getStats();
    expect(stats.sentCount).toBe(2);
  });

  it('送信率 = 送信済件数 ÷ 総企業数 × 100 を返す', async () => {
    const service = makeService([
      makeCompany({ sentDate: '2026-07-01' }),
      makeCompany({ sentDate: '' }),
      makeCompany({ sentDate: '' }),
      makeCompany({ sentDate: '' }),
    ]);
    const stats = await service.getStats();
    expect(stats.sendRate).toBeCloseTo(25);
  });

  it('総企業数が 0 件の場合、送信率は 0 になる', async () => {
    const service = makeService([]);
    const stats = await service.getStats();
    expect(stats.sendRate).toBe(0);
  });

  it('送信可否が○かつ未送信/送信失敗/空欄の企業を送信待ち件数として数える', async () => {
    const service = makeService([
      makeCompany({ sendApproval: '○', status: '' }),
      makeCompany({ sendApproval: '○', status: '未送信' }),
      makeCompany({ sendApproval: '○', status: '送信失敗' }),
      makeCompany({ sendApproval: '○', status: '送信済' }),
      makeCompany({ sendApproval: '×', status: '' }),
    ]);
    const stats = await service.getStats();
    expect(stats.waitingCount).toBe(3);
  });

  it('返信件数と返信率（返信件数 ÷ 送信済件数 × 100）を返す', async () => {
    const service = makeService([
      makeCompany({ status: '返信あり', sentDate: '2026-07-01' }),
      makeCompany({ status: '送信済', sentDate: '2026-07-01' }),
      makeCompany({ status: '送信済', sentDate: '2026-07-01' }),
      makeCompany({ status: '送信済', sentDate: '2026-07-01' }),
    ]);
    const stats = await service.getStats();
    expect(stats.repliedCount).toBe(1);
    expect(stats.replyRate).toBeCloseTo(25);
  });

  it('送信済件数が 0 件の場合、返信率は 0 になる', async () => {
    const service = makeService([makeCompany({ sentDate: '' })]);
    const stats = await service.getStats();
    expect(stats.replyRate).toBe(0);
  });

  it('商談日が設定されている企業を商談中件数として数える', async () => {
    const service = makeService([
      makeCompany({ meetingDate: '2026-07-10' }),
      makeCompany({ meetingDate: '' }),
    ]);
    const stats = await service.getStats();
    expect(stats.meetingCount).toBe(1);
  });

  it('成約が設定されている企業を成約件数として数える', async () => {
    const service = makeService([makeCompany({ closed: '○' }), makeCompany({ closed: '' })]);
    const stats = await service.getStats();
    expect(stats.closedCount).toBe(1);
  });

  it('失注件数は常に 0 を返す（将来ステータス追加予定）', async () => {
    const service = makeService([makeCompany(), makeCompany()]);
    const stats = await service.getStats();
    expect(stats.lostCount).toBe(0);
  });

  it('配信停止ステータスの企業を配信停止件数として数える（失注とは区別する）', async () => {
    const service = makeService([
      makeCompany({ status: '配信停止' }),
      makeCompany({ status: '送信済' }),
    ]);
    const stats = await service.getStats();
    expect(stats.unsubscribedCount).toBe(1);
    expect(stats.lostCount).toBe(0);
  });
});
