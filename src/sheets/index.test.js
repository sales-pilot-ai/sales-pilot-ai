/**
 * SheetsService のユニットテスト。
 *
 * googleapis は一切モックしない。
 * 代わりに SheetsService のコンストラクタに mock sheetsApi を注入する（DI）。
 * これにより googleapis の内部実装に依存せず、ビジネスロジックだけをテストできる。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompany } from '../models/company.js';
import { SheetsService } from './service.js';

// ─── モック API ファクトリ ────────────────────────────────────────────────────

/**
 * テスト用の mock sheetsApi を生成する。
 * 各 vi.fn() に resolved value を事前設定済み。
 */
function createMockApi({ appendData, getData, batchUpdateData } = {}) {
  return {
    spreadsheets: {
      values: {
        append: vi.fn().mockResolvedValue({
          data: appendData ?? { updates: { updatedRows: 1 } },
        }),
        get: vi.fn().mockResolvedValue({
          data: getData ?? { values: [] },
        }),
        batchUpdate: vi.fn().mockResolvedValue({
          data: batchUpdateData ?? { totalUpdatedCells: 1 },
        }),
      },
    },
  };
}

// ─── テスト共通ヘルパー ────────────────────────────────────────────────────────

const DEFAULT_OPTS = {
  spreadsheetId: 'test-spreadsheet-id',
  sheetName: 'テストシート',
};

// ─── SheetsService コンストラクタ ─────────────────────────────────────────────

describe('SheetsService コンストラクタ', () => {
  it('sheetsApi が未指定のとき Error をスローする', () => {
    expect(() => new SheetsService()).toThrow('sheetsApi は必須です');
  });

  it('spreadsheetId を省略すると process.env.SPREADSHEET_ID を使う', () => {
    process.env.SPREADSHEET_ID = 'env-id';
    const service = new SheetsService({ sheetsApi: createMockApi() });
    expect(service._spreadsheetId).toBe('env-id');
    delete process.env.SPREADSHEET_ID;
  });

  it('sheetName を省略すると "営業リスト" をデフォルトにする', () => {
    const service = new SheetsService({
      sheetsApi: createMockApi(),
      spreadsheetId: 'id',
    });
    expect(service._sheetName).toBe('営業リスト');
  });
});

// ─── appendCompanies ─────────────────────────────────────────────────────────

describe('appendCompanies', () => {
  let api;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockApi();
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
  });

  it('spreadsheetId が空のとき Error をスローする', async () => {
    const s = new SheetsService({ sheetsApi: api, spreadsheetId: '' });
    await expect(s.appendCompanies([createCompany({ companyName: 'A' })])).rejects.toThrow(
      'SPREADSHEET_ID'
    );
  });

  it('空配列のとき null を返し API を呼ばない', async () => {
    const result = await service.appendCompanies([]);
    expect(result).toBeNull();
    expect(api.spreadsheets.values.append).not.toHaveBeenCalled();
  });

  it('企業データを Sheets API に追記する', async () => {
    const companies = [
      createCompany({ companyName: '株式会社A', email: 'a@example.co.jp' }),
      createCompany({ companyName: '株式会社B', email: 'b@example.co.jp' }),
    ];
    await service.appendCompanies(companies);
    expect(api.spreadsheets.values.append).toHaveBeenCalledOnce();
  });

  it('正しい spreadsheetId と range で API を呼ぶ', async () => {
    const company = createCompany({ companyName: 'テスト' });
    await service.appendCompanies([company]);
    const call = api.spreadsheets.values.append.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.range).toBe('テストシート!A:S');
    expect(call.valueInputOption).toBe('USER_ENTERED');
  });

  it('各企業を 19 要素の行として送信する', async () => {
    const company = createCompany({ companyName: 'テスト' });
    await service.appendCompanies([company]);
    const rows = api.spreadsheets.values.append.mock.calls[0][0].requestBody.values;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(19);
  });

  it('API レスポンスの data を返す', async () => {
    api = createMockApi({ appendData: { updates: { updatedRows: 3 } } });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const company = createCompany({ companyName: 'テスト' });
    const result = await service.appendCompanies([company]);
    expect(result).toEqual({ updates: { updatedRows: 3 } });
  });

  it('companyName が row[0] に格納される', async () => {
    const company = createCompany({ companyName: '株式会社テスト' });
    await service.appendCompanies([company]);
    const row = api.spreadsheets.values.append.mock.calls[0][0].requestBody.values[0];
    expect(row[0]).toBe('株式会社テスト');
  });
});

// ─── getApprovedRows ──────────────────────────────────────────────────────────

describe('getApprovedRows', () => {
  let api;
  let service;

  // A列=会社名, K列(index10)=送信可否
  function makeRow(name, email, approval, status = 'NEW') {
    return [
      name, // A
      '', // B
      '', // C
      email, // D
      '', // E
      '', // F
      '', // G
      '', // H
      '', // I
      '', // J
      approval, // K (index 10)
      '', // L
      status, // M
      '', // N
      '', // O
      '', // P
      '', // Q
      '', // R
      '', // S
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockApi();
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
  });

  it('spreadsheetId が空のとき Error をスローする', async () => {
    const s = new SheetsService({ sheetsApi: api, spreadsheetId: '' });
    await expect(s.getApprovedRows()).rejects.toThrow('SPREADSHEET_ID');
  });

  it('シートが空のとき空配列を返す', async () => {
    api = createMockApi({ getData: { values: undefined } });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    expect(result).toEqual([]);
  });

  it('送信可否「○」の行のみを返す', async () => {
    api = createMockApi({
      getData: {
        values: [
          Array(19).fill('header'),
          makeRow('株式会社A', 'a@a.com', '○'),
          makeRow('株式会社B', 'b@b.com', '×'),
          makeRow('株式会社C', 'c@c.com', '○'),
        ],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    expect(result).toHaveLength(2);
    expect(result[0].companyName).toBe('株式会社A');
    expect(result[1].companyName).toBe('株式会社C');
  });

  it('返り値に _rowIndex が含まれる（ヘッダー考慮）', async () => {
    api = createMockApi({
      getData: {
        values: [
          Array(19).fill('header'),
          makeRow('株式会社A', 'a@a.com', '○'),
          makeRow('株式会社B', 'b@b.com', '×'),
          makeRow('株式会社C', 'c@c.com', '○'),
        ],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    // ヘッダー(row1)をスキップ → データ行は row2〜
    expect(result[0]._rowIndex).toBe(2);
    expect(result[1]._rowIndex).toBe(4);
  });

  it('送信可否○の行がなければ空配列を返す', async () => {
    api = createMockApi({
      getData: {
        values: [Array(19).fill('header'), makeRow('株式会社A', 'a@a.com', '×')],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    expect(await service.getApprovedRows()).toEqual([]);
  });

  it('正しい spreadsheetId と range で API を呼ぶ', async () => {
    await service.getApprovedRows();
    const call = api.spreadsheets.values.get.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.range).toBe('テストシート!A:S');
  });

  it('email フィールドが rowToCompany で正しくマップされる', async () => {
    api = createMockApi({
      getData: {
        values: [Array(19).fill('header'), makeRow('株式会社A', 'test@example.co.jp', '○')],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    expect(result[0].email).toBe('test@example.co.jp');
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe('updateStatus', () => {
  let api;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockApi();
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
  });

  it('spreadsheetId が空のとき Error をスローする', async () => {
    const s = new SheetsService({ sheetsApi: api, spreadsheetId: '' });
    await expect(s.updateStatus(2, { status: 'SENT' })).rejects.toThrow('SPREADSHEET_ID');
  });

  it('更新フィールドが空のとき null を返し API を呼ばない', async () => {
    const result = await service.updateStatus(2, {});
    expect(result).toBeNull();
    expect(api.spreadsheets.values.batchUpdate).not.toHaveBeenCalled();
  });

  it('未定義フィールドはスキップする', async () => {
    const result = await service.updateStatus(2, { unknownField: 'value' });
    expect(result).toBeNull();
    expect(api.spreadsheets.values.batchUpdate).not.toHaveBeenCalled();
  });

  it('batchUpdate を正しいパラメータで呼ぶ', async () => {
    await service.updateStatus(3, { status: 'SENT', sentDate: '2024-06-26' });
    expect(api.spreadsheets.values.batchUpdate).toHaveBeenCalledOnce();
    const call = api.spreadsheets.values.batchUpdate.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.requestBody.valueInputOption).toBe('USER_ENTERED');
  });

  it('status フィールドを M 列に更新する', async () => {
    await service.updateStatus(5, { status: 'SENT' });
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    const entry = data.find((d) => d.range.includes('M5'));
    expect(entry).toBeDefined();
    expect(entry.values).toEqual([['SENT']]);
  });

  it('sentDate フィールドを L 列に更新する', async () => {
    await service.updateStatus(5, { sentDate: '2024-06-26' });
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    const entry = data.find((d) => d.range.includes('L5'));
    expect(entry).toBeDefined();
    expect(entry.values).toEqual([['2024-06-26']]);
  });

  it('複数フィールドを一括 batchUpdate する（API 呼び出しは 1 回）', async () => {
    await service.updateStatus(2, { status: 'SENT', sentDate: '2024-06-26', reply: '興味あり' });
    expect(api.spreadsheets.values.batchUpdate).toHaveBeenCalledOnce();
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    expect(data).toHaveLength(3);
  });

  it('null 値は空文字として更新される', async () => {
    await service.updateStatus(2, { reply: null });
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    expect(data[0].values).toEqual([['']]);
  });

  it('API レスポンスの data を返す', async () => {
    api = createMockApi({ batchUpdateData: { totalUpdatedCells: 5 } });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.updateStatus(2, { status: '送信済' });
    expect(result).toEqual({ totalUpdatedCells: 5 });
  });

  it('シート名が range に正しく含まれる', async () => {
    await service.updateStatus(7, { status: 'OK' });
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    expect(data[0].range).toContain('テストシート');
  });
});
