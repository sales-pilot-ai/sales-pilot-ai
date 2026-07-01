import { describe, it, expect, vi } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('./auth.js', () => ({
  createAuth: vi.fn().mockResolvedValue({}),
}));

vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn().mockReturnValue({}),
  },
}));

vi.mock('../config/index.js', () => ({
  env: {},
  settings: { sheets: { approvalValue: '○' } },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import {
  DashboardService,
  DASHBOARD_SHEET,
  DASHBOARD_COLUMNS,
  buildRepliedFormula,
  buildWaitingFormula,
  buildMeetingFormula,
  buildRepliedTitleFormula,
  buildWaitingTitleFormula,
  buildMeetingTitleFormula,
  createDashboardService,
} from './dashboard.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

/** 標準的な 営業リスト ヘッダー行を返すモック sheetsApi */
function makeSheetsApi({ sheetTitles = [] } = {}) {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: sheetTitles.map((t) => ({ properties: { title: t } })),
        },
      }),
      batchUpdate: vi.fn().mockResolvedValue({}),
      values: {
        get: vi.fn().mockResolvedValue({
          data: {
            values: [
              [
                '会社名',
                'メールアドレス',
                '電話番号',
                '送信状況',
                '送信日',
                '送信可否',
                '返信有無',
                '商談日',
                'メモ',
              ],
            ],
          },
        }),
        clear: vi.fn().mockResolvedValue({}),
        batchUpdate: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

/** fieldToColLetter の標準セット */
function makeFieldMap() {
  return new Map([
    ['companyName', 'A'],
    ['email', 'B'],
    ['phone', 'C'],
    ['status', 'D'],
    ['sentDate', 'E'],
    ['sendApproval', 'F'],
    ['hasReply', 'G'],
    ['meetingDate', 'H'],
    ['memo', 'I'],
  ]);
}

// ─── DASHBOARD_SHEET / DASHBOARD_COLUMNS ─────────────────────────────────────

describe('定数', () => {
  it('DASHBOARD_SHEET === "営業ダッシュボード"', () => {
    expect(DASHBOARD_SHEET).toBe('営業ダッシュボード');
  });

  it('DASHBOARD_COLUMNS が 8 列', () => {
    expect(DASHBOARD_COLUMNS).toHaveLength(8);
  });

  it('DASHBOARD_COLUMNS の各エントリに field と header がある', () => {
    for (const col of DASHBOARD_COLUMNS) {
      expect(col.field).toBeTruthy();
      expect(col.header).toBeTruthy();
    }
  });
});

// ─── formula builders ─────────────────────────────────────────────────────────

describe('buildRepliedFormula', () => {
  it('FILTER 数式を返す', () => {
    const f = buildRepliedFormula('営業リスト', makeFieldMap());
    expect(f).toMatch(/^=IFERROR\(FILTER\(/);
  });

  it('"返信あり" 条件が含まれる', () => {
    const f = buildRepliedFormula('営業リスト', makeFieldMap());
    expect(f).toContain('返信あり');
  });

  it('status 列 (D) が条件に使われる', () => {
    const f = buildRepliedFormula('営業リスト', makeFieldMap());
    expect(f).toContain('!D2:D');
  });

  it('status 列がない場合も FILTER 数式を返す（空列フォールバック）', () => {
    const f = buildRepliedFormula('営業リスト', new Map());
    expect(f).toMatch(/^=IFERROR\(FILTER\(/);
  });
});

describe('buildWaitingFormula', () => {
  it('FILTER 数式を返す', () => {
    const f = buildWaitingFormula('営業リスト', makeFieldMap());
    expect(f).toMatch(/^=IFERROR\(FILTER\(/);
  });

  it('送信可否列 (F) AND 送信状況列 (D) の複合条件が含まれる', () => {
    const f = buildWaitingFormula('営業リスト', makeFieldMap());
    expect(f).toContain('!F2:F');
    expect(f).toContain('!D2:D');
  });

  it('"未送信" / "送信失敗" の OR 条件が含まれる', () => {
    const f = buildWaitingFormula('営業リスト', makeFieldMap());
    expect(f).toContain('未送信');
    expect(f).toContain('送信失敗');
  });

  it('必要な列がない場合も FILTER 数式を返す（空列フォールバック）', () => {
    const f = buildWaitingFormula('営業リスト', new Map());
    expect(f).toMatch(/^=IFERROR\(FILTER\(/);
  });
});

describe('buildMeetingFormula', () => {
  it('FILTER 数式を返す', () => {
    const f = buildMeetingFormula('営業リスト', makeFieldMap());
    expect(f).toMatch(/^=IFERROR\(FILTER\(/);
  });

  it('商談日列 (H) の空でない条件が含まれる', () => {
    const f = buildMeetingFormula('営業リスト', makeFieldMap());
    expect(f).toContain('!H2:H');
    expect(f).toContain('<>""');
  });

  it('商談日列がない場合も FILTER 数式を返す（空列フォールバック）', () => {
    const f = buildMeetingFormula('営業リスト', new Map());
    expect(f).toMatch(/^=IFERROR\(FILTER\(/);
  });
});

describe('buildRepliedTitleFormula', () => {
  it('"返信あり" を含む数式を返す', () => {
    const f = buildRepliedTitleFormula('営業リスト', makeFieldMap());
    expect(f).toContain('返信あり');
  });

  it('COUNTIF を使う', () => {
    const f = buildRepliedTitleFormula('営業リスト', makeFieldMap());
    expect(f).toContain('COUNTIF');
  });

  it('列がない場合も数式を返す（空列フォールバック）', () => {
    const f = buildRepliedTitleFormula('営業リスト', new Map());
    expect(f).toContain('返信あり');
    expect(f).toContain('COUNTIF');
  });
});

describe('buildWaitingTitleFormula', () => {
  it('"送信待ち" を含む数式を返す', () => {
    const f = buildWaitingTitleFormula('営業リスト', makeFieldMap());
    expect(f).toContain('送信待ち');
  });

  it('SUMPRODUCT を使う', () => {
    const f = buildWaitingTitleFormula('営業リスト', makeFieldMap());
    expect(f).toContain('SUMPRODUCT');
  });
});

describe('buildMeetingTitleFormula', () => {
  it('"商談中" を含む数式を返す', () => {
    const f = buildMeetingTitleFormula('営業リスト', makeFieldMap());
    expect(f).toContain('商談中');
  });

  it('COUNTA を使う', () => {
    const f = buildMeetingTitleFormula('営業リスト', makeFieldMap());
    expect(f).toContain('COUNTA');
  });
});

// ─── DashboardService ─────────────────────────────────────────────────────────

describe('DashboardService', () => {
  describe('constructor', () => {
    it('sheetsApi がないと例外を投げる', () => {
      expect(() => new DashboardService({})).toThrow('sheetsApi は必須です');
    });

    it('sheetsApi を受け取りインスタンスを返す', () => {
      const svc = new DashboardService({ sheetsApi: makeSheetsApi(), spreadsheetId: 'id' });
      expect(svc).toBeInstanceOf(DashboardService);
    });

    it('listSheetName のデフォルトは "営業リスト"', () => {
      const svc = new DashboardService({ sheetsApi: makeSheetsApi(), spreadsheetId: 'id' });
      expect(svc._listSheetName).toBe('営業リスト');
    });
  });

  describe('createOrUpdateDashboard', () => {
    it('SPREADSHEET_ID がない場合は例外を投げる', async () => {
      const svc = new DashboardService({ sheetsApi: makeSheetsApi(), spreadsheetId: '' });
      await expect(svc.createOrUpdateDashboard()).rejects.toThrow('SPREADSHEET_ID');
    });

    it('既存タブがない場合は addSheet を呼ぶ', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new DashboardService({ sheetsApi: api, spreadsheetId: 'sid' });
      await svc.createOrUpdateDashboard();
      expect(api.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ requests: expect.any(Array) }),
        })
      );
      const req = api.spreadsheets.batchUpdate.mock.calls[0][0].requestBody.requests[0];
      expect(req.addSheet.properties.title).toBe(DASHBOARD_SHEET);
    });

    it('既存タブがある場合は clear を呼ぶ（addSheet は呼ばない）', async () => {
      const api = makeSheetsApi({ sheetTitles: [DASHBOARD_SHEET] });
      const svc = new DashboardService({ sheetsApi: api, spreadsheetId: 'sid' });
      await svc.createOrUpdateDashboard();
      expect(api.spreadsheets.values.clear).toHaveBeenCalled();
      // addSheet は batchUpdate で呼ばれるが、内容を検証
      const batchUpdateCalls = api.spreadsheets.batchUpdate.mock.calls;
      const hasAddSheet = batchUpdateCalls.some((call) =>
        call[0].requestBody?.requests?.some((r) => r.addSheet)
      );
      expect(hasAddSheet).toBe(false);
    });

    it('batchUpdate (values) を USER_ENTERED で呼ぶ', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new DashboardService({ sheetsApi: api, spreadsheetId: 'sid' });
      await svc.createOrUpdateDashboard();
      const call = api.spreadsheets.values.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.valueInputOption).toBe('USER_ENTERED');
    });

    it('A1 に "営業ダッシュボード"、A2 に "最終更新:" を含む値を書き込む', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new DashboardService({ sheetsApi: api, spreadsheetId: 'sid' });
      await svc.createOrUpdateDashboard();
      const call = api.spreadsheets.values.batchUpdate.mock.calls[0][0];
      const { data } = call.requestBody;
      const a1 = data.find((d) => d.range.includes('A1'));
      const a2 = data.find((d) => d.range.includes('A2'));
      expect(a1?.values[0][0]).toBe('営業ダッシュボード');
      expect(a2?.values[0][0]).toMatch(/^最終更新:/);
    });

    it('A6, I6, Q6 に FILTER 数式を書き込む', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new DashboardService({ sheetsApi: api, spreadsheetId: 'sid' });
      await svc.createOrUpdateDashboard();
      const { data } = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody;
      const formulaAt = (range) => data.find((d) => d.range.includes(range))?.values[0][0];
      expect(formulaAt('A6')).toMatch(/^=IFERROR\(FILTER\(/);
      expect(formulaAt('I6')).toMatch(/^=IFERROR\(FILTER\(/);
      expect(formulaAt('Q6')).toMatch(/^=IFERROR\(FILTER\(/);
    });

    it('A4, I4, Q4 にタイトル数式を書き込む', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new DashboardService({ sheetsApi: api, spreadsheetId: 'sid' });
      await svc.createOrUpdateDashboard();
      const { data } = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody;
      const titleAt = (range) => data.find((d) => d.range.includes(range))?.values[0][0];
      expect(titleAt('A4')).toContain('返信あり');
      expect(titleAt('I4')).toContain('送信待ち');
      expect(titleAt('Q4')).toContain('商談中');
    });
  });
});

// ─── createDashboardService ───────────────────────────────────────────────────

describe('createDashboardService', () => {
  it('DashboardService インスタンスを返す', async () => {
    const svc = await createDashboardService();
    expect(svc).toBeInstanceOf(DashboardService);
  });
});
