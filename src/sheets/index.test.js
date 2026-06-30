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

// ─── 共通ヘッダー定義 ─────────────────────────────────────────────────────────

/**
 * テスト用シートのヘッダー行（14列）。
 * インデックス順: 0=会社名, 4=メールアドレス, 9=送信日, 10=送信可否, 11=送信状況, 12=担当者名, 13=最終更新
 */
const HEADERS = [
  '会社名', // 0  → A
  '業種', // 1  → B
  'エリア', // 2  → C
  'ホームページ', // 3  → D
  'メールアドレス', // 4  → E
  'お問い合わせフォーム', // 5 → F
  '電話番号', // 6  → G
  '住所', // 7  → H
  'メモ', // 8  → I
  '送信日', // 9  → J
  '送信可否', // 10 → K
  '送信状況', // 11 → L
  '担当者名', // 12 → M
  '最終更新', // 13 → N
];

// ─── モック API ファクトリ ────────────────────────────────────────────────────

/**
 * テスト用の mock sheetsApi を生成する。
 * get のデフォルト値はヘッダー行のみ（_loadHeaders() 用）。
 */
function createMockApi({ appendData, getData, batchUpdateData } = {}) {
  return {
    spreadsheets: {
      values: {
        append: vi.fn().mockResolvedValue({
          data: appendData ?? { updates: { updatedRows: 1 } },
        }),
        get: vi.fn().mockResolvedValue({
          data: getData ?? { values: [HEADERS] },
        }),
        batchUpdate: vi.fn().mockResolvedValue({
          data: batchUpdateData ?? { totalUpdatedCells: 1 },
        }),
      },
    },
  };
}

// ─── テスト共通オプション ─────────────────────────────────────────────────────

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
    expect(call.range).toBe('テストシート!A1');
    expect(call.valueInputOption).toBe('USER_ENTERED');
  });

  it('各企業をヘッダー列数（14）と同じ要素の行として送信する', async () => {
    const company = createCompany({ companyName: 'テスト' });
    await service.appendCompanies([company]);
    const rows = api.spreadsheets.values.append.mock.calls[0][0].requestBody.values;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(HEADERS.length);
  });

  it('API レスポンスの data を返す', async () => {
    api = createMockApi({ appendData: { updates: { updatedRows: 3 } } });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const company = createCompany({ companyName: 'テスト' });
    const result = await service.appendCompanies([company]);
    expect(result).toEqual({ updates: { updatedRows: 3 } });
  });

  it('companyName が row[0]（会社名列）に格納される', async () => {
    const company = createCompany({ companyName: '株式会社テスト' });
    await service.appendCompanies([company]);
    const row = api.spreadsheets.values.append.mock.calls[0][0].requestBody.values[0];
    expect(row[0]).toBe('株式会社テスト');
  });

  it('email が row[4]（メールアドレス列）に格納される', async () => {
    const company = createCompany({ companyName: 'テスト', email: 'info@test.co.jp' });
    await service.appendCompanies([company]);
    const row = api.spreadsheets.values.append.mock.calls[0][0].requestBody.values[0];
    expect(row[4]).toBe('info@test.co.jp');
  });
});

// ─── getApprovedRows ──────────────────────────────────────────────────────────

describe('getApprovedRows', () => {
  let api;
  let service;

  /**
   * 指定した値でテストデータ行を生成する。
   * インデックスは HEADERS の順番に合わせる。
   */
  function makeRow(name, email, approval, status = '') {
    const row = Array(HEADERS.length).fill('');
    row[0] = name; // 会社名
    row[4] = email; // メールアドレス
    row[10] = approval; // 送信可否
    row[11] = status; // 送信状況
    return row;
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
          HEADERS,
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

  it('返り値に _rowIndex が含まれる（ヘッダー行考慮で 2 始まり）', async () => {
    api = createMockApi({
      getData: {
        values: [
          HEADERS,
          makeRow('株式会社A', 'a@a.com', '○'),
          makeRow('株式会社B', 'b@b.com', '×'),
          makeRow('株式会社C', 'c@c.com', '○'),
        ],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    expect(result[0]._rowIndex).toBe(2); // ヘッダー(row1) の次
    expect(result[1]._rowIndex).toBe(4); // 3行目はスキップ（×）
  });

  it('送信可否○の行がなければ空配列を返す', async () => {
    api = createMockApi({
      getData: {
        values: [HEADERS, makeRow('株式会社A', 'a@a.com', '×')],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    expect(await service.getApprovedRows()).toEqual([]);
  });

  it('正しい spreadsheetId と range（シート全体）で API を呼ぶ', async () => {
    await service.getApprovedRows();
    const call = api.spreadsheets.values.get.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.range).toBe('テストシート');
  });

  it('email フィールドが rowToCompanyByHeaders で正しくマップされる', async () => {
    api = createMockApi({
      getData: {
        values: [HEADERS, makeRow('株式会社A', 'test@example.co.jp', '○')],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    expect(result[0].email).toBe('test@example.co.jp');
  });

  it('ヘッダーに送信可否列がないとき空配列を返す', async () => {
    api = createMockApi({
      getData: {
        values: [
          ['会社名', '業種'],
          ['テスト', '飲食'],
        ],
      },
    });
    service = new SheetsService({ sheetsApi: api, ...DEFAULT_OPTS });
    const result = await service.getApprovedRows();
    expect(result).toEqual([]);
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe('updateStatus', () => {
  let api;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    // get デフォルトは HEADERS のみ → _loadHeaders() がキャッシュを正しく構築できる
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

  it('未定義フィールドはスキップする（batchUpdate を呼ばない）', async () => {
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

  it('status（送信状況）フィールドを L 列に更新する', async () => {
    await service.updateStatus(5, { status: 'SENT' });
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    const entry = data.find((d) => d.range.includes('L5'));
    expect(entry).toBeDefined();
    expect(entry.values).toEqual([['SENT']]);
  });

  it('sentDate（送信日）フィールドを J 列に更新する', async () => {
    await service.updateStatus(5, { sentDate: '2024-06-26' });
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    const entry = data.find((d) => d.range.includes('J5'));
    expect(entry).toBeDefined();
    expect(entry.values).toEqual([['2024-06-26']]);
  });

  it('複数フィールドを一括 batchUpdate する（API 呼び出しは 1 回）', async () => {
    await service.updateStatus(2, {
      status: 'SENT',
      sentDate: '2024-06-26',
      contactName: '田中',
    });
    expect(api.spreadsheets.values.batchUpdate).toHaveBeenCalledOnce();
    const data = api.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody.data;
    expect(data).toHaveLength(3);
  });

  it('null 値は空文字として更新される', async () => {
    await service.updateStatus(2, { status: null });
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
