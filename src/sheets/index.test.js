import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCompany } from '../models/company.js';

// ─── googleapis モック ────────────────────────────────────────────────────────
// vi.mock はファイル先頭に巻き上げられるため、vi.hoisted でモック関数を先行定義する

const { mockAppend, mockGet, mockBatchUpdate } = vi.hoisted(() => ({
  mockAppend: vi.fn(),
  mockGet: vi.fn(),
  mockBatchUpdate: vi.fn(),
}));

vi.mock('googleapis', () => {
  // GoogleAuth は new で呼ばれるため class で定義する
  class MockGoogleAuth {
    constructor(_options) {}
    async getClient() {
      return {};
    }
  }

  return {
    google: {
      auth: { GoogleAuth: MockGoogleAuth },
      // google.sheets() はクライアントを返すファクトリ
      sheets: () => ({
        spreadsheets: {
          values: {
            append: mockAppend,
            get: mockGet,
            batchUpdate: mockBatchUpdate,
          },
        },
      }),
    },
  };
});

// ─── テスト対象（モック登録後にインポート）────────────────────────────────────
const { appendCompanies, getApprovedRows, updateStatus } = await import('./index.js');

// ─── 共通セットアップ ─────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.SPREADSHEET_ID = 'test-spreadsheet-id';
  process.env.SHEET_NAME = 'テストシート';
  vi.clearAllMocks();
  mockAppend.mockResolvedValue({ data: { updates: { updatedRows: 1 } } });
  mockGet.mockResolvedValue({ data: { values: [] } });
  mockBatchUpdate.mockResolvedValue({ data: { totalUpdatedCells: 1 } });
});

afterEach(() => {
  delete process.env.SPREADSHEET_ID;
  delete process.env.SHEET_NAME;
});

// ─── appendCompanies ─────────────────────────────────────────────────────────

describe('appendCompanies', () => {
  it('SPREADSHEET_ID が未設定のとき Error をスローする', async () => {
    delete process.env.SPREADSHEET_ID;
    await expect(appendCompanies([])).rejects.toThrow('SPREADSHEET_ID');
  });

  it('空配列のとき null を返し API を呼ばない', async () => {
    const result = await appendCompanies([]);
    expect(result).toBeNull();
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it('企業データを Sheets API に追記する', async () => {
    const companies = [
      createCompany({ companyName: '株式会社A', email: 'a@example.co.jp' }),
      createCompany({ companyName: '株式会社B', email: 'b@example.co.jp' }),
    ];
    await appendCompanies(companies);
    expect(mockAppend).toHaveBeenCalledOnce();
  });

  it('正しい spreadsheetId と range で API を呼ぶ', async () => {
    const company = createCompany({ companyName: 'テスト' });
    await appendCompanies([company]);
    const call = mockAppend.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.range).toBe('テストシート!A:R');
    expect(call.valueInputOption).toBe('USER_ENTERED');
  });

  it('各企業を 18 要素の行として送信する', async () => {
    const company = createCompany({ companyName: 'テスト' });
    await appendCompanies([company]);
    const rows = mockAppend.mock.calls[0][0].requestBody.values;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(18);
  });

  it('API レスポンスの data を返す', async () => {
    const company = createCompany({ companyName: 'テスト' });
    const result = await appendCompanies([company]);
    expect(result).toEqual({ updates: { updatedRows: 1 } });
  });

  it('SHEET_NAME 未設定のときデフォルト値 "営業リスト" を使う', async () => {
    delete process.env.SHEET_NAME;
    const company = createCompany({ companyName: 'テスト' });
    await appendCompanies([company]);
    const call = mockAppend.mock.calls[0][0];
    expect(call.range).toContain('営業リスト');
  });
});

// ─── getApprovedRows ──────────────────────────────────────────────────────────

describe('getApprovedRows', () => {
  it('SPREADSHEET_ID が未設定のとき Error をスローする', async () => {
    delete process.env.SPREADSHEET_ID;
    await expect(getApprovedRows()).rejects.toThrow('SPREADSHEET_ID');
  });

  it('シートが空のとき空配列を返す', async () => {
    mockGet.mockResolvedValue({ data: { values: undefined } });
    const result = await getApprovedRows();
    expect(result).toEqual([]);
  });

  it('送信可否「○」の行のみを返す', async () => {
    // settings.sheets.headerRow: true なのでヘッダー行込みで返す
    // K列（index 10）= 送信可否、行は 18 要素（A:R）
    const makeRow = (name, email, approval) => [
      name,
      '',
      '',
      email,
      '',
      '',
      '',
      '',
      '',
      '',
      approval,
      '',
      'NEW',
      '',
      '',
      '',
      '',
      '',
    ];
    mockGet.mockResolvedValue({
      data: {
        values: [
          // ヘッダー行（スキップ）
          Array(18).fill('header'),
          makeRow('株式会社A', 'a@a.com', '○'),
          makeRow('株式会社B', 'b@b.com', '×'),
          makeRow('株式会社C', 'c@c.com', '○'),
        ],
      },
    });
    const result = await getApprovedRows();
    expect(result).toHaveLength(2);
    expect(result[0].companyName).toBe('株式会社A');
    expect(result[1].companyName).toBe('株式会社C');
  });

  it('返り値に _rowIndex が含まれる（ヘッダー考慮）', async () => {
    const makeRow = (approval) =>
      Array(18)
        .fill('')
        .map((v, i) => (i === 10 ? approval : v));
    mockGet.mockResolvedValue({
      data: {
        values: [
          Array(18).fill('header'),
          Object.assign(makeRow('○'), { 0: '株式会社A' }),
          makeRow('×'),
          Object.assign(makeRow('○'), { 0: '株式会社C' }),
        ],
      },
    });
    const result = await getApprovedRows();
    // ヘッダー(row1)をスキップ → データ行は row2〜
    expect(result[0]._rowIndex).toBe(2);
    expect(result[1]._rowIndex).toBe(4);
  });

  it('送信可否○の行がなければ空配列を返す', async () => {
    mockGet.mockResolvedValue({
      data: {
        values: [
          Array(18).fill('header'),
          Array(18)
            .fill('')
            .map((v, i) => (i === 10 ? '×' : v)),
        ],
      },
    });
    expect(await getApprovedRows()).toEqual([]);
  });

  it('正しい spreadsheetId と range で API を呼ぶ', async () => {
    await getApprovedRows();
    const call = mockGet.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.range).toBe('テストシート!A:R');
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe('updateStatus', () => {
  it('SPREADSHEET_ID が未設定のとき Error をスローする', async () => {
    delete process.env.SPREADSHEET_ID;
    await expect(updateStatus(2, { status: 'SENT' })).rejects.toThrow('SPREADSHEET_ID');
  });

  it('更新フィールドが空のとき null を返し API を呼ばない', async () => {
    const result = await updateStatus(2, {});
    expect(result).toBeNull();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('未定義フィールドはスキップする', async () => {
    // 'unknownField' は settings.json に存在しない
    const result = await updateStatus(2, { unknownField: 'value' });
    expect(result).toBeNull();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('batchUpdate を正しいパラメータで呼ぶ', async () => {
    await updateStatus(3, { status: 'SENT', sentDate: '2024-06-26' });
    expect(mockBatchUpdate).toHaveBeenCalledOnce();
    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('test-spreadsheet-id');
    expect(call.requestBody.valueInputOption).toBe('USER_ENTERED');
  });

  it('status フィールドを M 列に更新する', async () => {
    await updateStatus(5, { status: 'SENT' });
    const data = mockBatchUpdate.mock.calls[0][0].requestBody.data;
    const statusEntry = data.find((d) => d.range.includes('M5'));
    expect(statusEntry).toBeDefined();
    expect(statusEntry.values).toEqual([['SENT']]);
  });

  it('sentDate フィールドを L 列に更新する', async () => {
    await updateStatus(5, { sentDate: '2024-06-26' });
    const data = mockBatchUpdate.mock.calls[0][0].requestBody.data;
    const dateEntry = data.find((d) => d.range.includes('L5'));
    expect(dateEntry).toBeDefined();
    expect(dateEntry.values).toEqual([['2024-06-26']]);
  });

  it('複数フィールドを一括 batchUpdate する（API 呼び出しは 1 回）', async () => {
    await updateStatus(2, { status: 'SENT', sentDate: '2024-06-26', reply: '興味あり' });
    expect(mockBatchUpdate).toHaveBeenCalledOnce();
    const data = mockBatchUpdate.mock.calls[0][0].requestBody.data;
    expect(data).toHaveLength(3);
  });

  it('null 値は空文字として更新される', async () => {
    await updateStatus(2, { reply: null });
    const data = mockBatchUpdate.mock.calls[0][0].requestBody.data;
    expect(data[0].values).toEqual([['']]);
  });

  it('API レスポンスの data を返す', async () => {
    const result = await updateStatus(2, { status: '送信済' });
    expect(result).toEqual({ totalUpdatedCells: 1 });
  });
});
