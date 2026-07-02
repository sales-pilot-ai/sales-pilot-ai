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
    const service = makeService([makeCompany({ closed: '成約' }), makeCompany({ closed: '' })]);
    const stats = await service.getStats();
    expect(stats.closedCount).toBe(1);
  });

  it('失注が設定されている企業を失注件数として数える', async () => {
    const service = makeService([
      makeCompany({ closed: '失注' }),
      makeCompany({ closed: '成約' }),
      makeCompany({ closed: '' }),
    ]);
    const stats = await service.getStats();
    expect(stats.lostCount).toBe(1);
    expect(stats.closedCount).toBe(1);
  });

  it('update コマンド導入前の自由記述の成約マークも成約件数として数える（後方互換）', async () => {
    const service = makeService([makeCompany({ closed: '○' })]);
    const stats = await service.getStats();
    expect(stats.closedCount).toBe(1);
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

// ─── updateCompanyByCompanyId: 列の自動追加 ───────────────────────────────────

/** 「商談日」「成約」列を含まない標準的な営業リストのヘッダー */
const HEADERS_WITHOUT_DEAL_COLUMNS = [
  '企業ID',
  '会社名',
  '業種',
  'エリア',
  'ホームページ',
  'メールアドレス',
  'お問い合わせフォーム',
  '電話番号',
  '住所',
  'メモ',
  '送信日',
  '送信可否',
  '送信状況',
  '担当者名',
  '最終更新',
  'Place ID',
];

/** ヘッダー行の取得・単一セル更新・行データ取得・batchUpdate をモックした sheetsApi を返す */
function makeSheetsApiForUpdate({ headers, row }) {
  const state = { headers: [...headers] };

  return {
    _state: state,
    spreadsheets: {
      values: {
        get: vi.fn((params) => {
          if (params.range.endsWith('!1:1')) {
            return Promise.resolve({ data: { values: [state.headers] } });
          }
          return Promise.resolve({ data: { values: [state.headers, row] } });
        }),
        update: vi.fn((params) => {
          state.headers.push(params.requestBody.values[0][0]);
          return Promise.resolve({});
        }),
        batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
      },
    },
  };
}

describe('SheetsService.updateCompanyByCompanyId — 列の自動追加', () => {
  it('更新対象フィールドの列が既に存在する場合は列を追加しない', async () => {
    const sheetsApi = makeSheetsApiForUpdate({
      headers: HEADERS_WITHOUT_DEAL_COLUMNS,
      row: ['C000001', 'テスト株式会社'],
    });
    const service = new SheetsService({ sheetsApi, spreadsheetId: 'sheet-id' });

    await service.updateCompanyByCompanyId('C000001', { status: '送信済' });

    expect(sheetsApi.spreadsheets.values.update).not.toHaveBeenCalled();
  });

  it('「商談日」列が存在しない場合はヘッダー行の末尾に自動追加してから書き込む', async () => {
    const sheetsApi = makeSheetsApiForUpdate({
      headers: HEADERS_WITHOUT_DEAL_COLUMNS,
      row: ['C000001', 'テスト株式会社'],
    });
    const service = new SheetsService({ sheetsApi, spreadsheetId: 'sheet-id' });

    await service.updateCompanyByCompanyId('C000001', { meetingDate: '2026-07-10' });

    expect(sheetsApi.spreadsheets.values.update).toHaveBeenCalledWith(
      expect.objectContaining({
        range: expect.stringContaining('!Q1'),
        requestBody: { values: [['商談日']] },
      })
    );
    expect(sheetsApi._state.headers).toContain('商談日');
  });

  it('「成約」列が存在しない場合もヘッダー行の末尾に自動追加する', async () => {
    const sheetsApi = makeSheetsApiForUpdate({
      headers: HEADERS_WITHOUT_DEAL_COLUMNS,
      row: ['C000001', 'テスト株式会社'],
    });
    const service = new SheetsService({ sheetsApi, spreadsheetId: 'sheet-id' });

    await service.updateCompanyByCompanyId('C000001', { closed: '成約' });

    expect(sheetsApi.spreadsheets.values.update).toHaveBeenCalledWith(
      expect.objectContaining({
        range: expect.stringContaining('!Q1'),
        requestBody: { values: [['成約']] },
      })
    );
  });

  it('複数フィールドが同時に不足している場合は両方の列を追加する', async () => {
    const sheetsApi = makeSheetsApiForUpdate({
      headers: HEADERS_WITHOUT_DEAL_COLUMNS,
      row: ['C000001', 'テスト株式会社'],
    });
    const service = new SheetsService({ sheetsApi, spreadsheetId: 'sheet-id' });

    await service.updateCompanyByCompanyId('C000001', {
      meetingDate: '2026-07-10',
      closed: '失注',
    });

    expect(sheetsApi.spreadsheets.values.update).toHaveBeenCalledTimes(2);
    expect(sheetsApi._state.headers).toEqual(expect.arrayContaining(['商談日', '成約']));
  });
});
