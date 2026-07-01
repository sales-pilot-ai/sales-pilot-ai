import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

vi.mock('../config/index.js', () => ({
  env: { spreadsheetId: 'mock-spreadsheet-id' },
}));

vi.mock('./auth.js', () => ({
  createAuth: vi.fn().mockResolvedValue({}),
}));

vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn().mockReturnValue({}),
    auth: { OAuth2: vi.fn() },
  },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

import {
  SEND_HISTORY_HEADERS,
  SEND_HISTORY_SHEET,
  SEND_RESULT,
  APP_VERSION,
  generateBatchId,
  SendHistoryService,
} from './send-history.js';
import { HistoryService } from './history-service.js';

// ─── テストデータ ─────────────────────────────────────────────────────────────

function makeSheetsApi({ sheetTitles = [] } = {}) {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: sheetTitles.map((title) => ({ properties: { title } })),
        },
      }),
      batchUpdate: vi.fn().mockResolvedValue({}),
      values: {
        update: vi.fn().mockResolvedValue({}),
        append: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

function makeRecord(overrides = {}) {
  return {
    sentAt: '2026-07-01T14:30:00.000Z',
    batchId: '20260701143000-ABCD',
    company: {
      companyId: 'C000001',
      placeId: 'ChIJtest',
      companyName: '株式会社テスト',
      email: 'test@example.co.jp',
    },
    subject: 'テスト件名',
    messageId: 'msg-001',
    result: SEND_RESULT.SUCCESS,
    error: '',
    sender: 'sender@example.com',
    templateName: 'initial_contact',
    scenarioName: '初回営業',
    ...overrides,
  };
}

// ─── HistoryService ───────────────────────────────────────────────────────────

describe('HistoryService', () => {
  describe('ensureSheet', () => {
    it('タブが存在しない場合 batchUpdate で addSheet を呼ぶ', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A', 'B'],
      });

      await svc.ensureSheet();

      expect(api.spreadsheets.batchUpdate).toHaveBeenCalledTimes(1);
      const req = api.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(req.requestBody.requests[0].addSheet.properties.title).toBe('送信履歴');
    });

    it('タブが存在しない場合 values.update でヘッダーを書き込む', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A', 'B'],
      });

      await svc.ensureSheet();

      expect(api.spreadsheets.values.update).toHaveBeenCalledTimes(1);
      const req = api.spreadsheets.values.update.mock.calls[0][0];
      expect(req.requestBody.values).toEqual([['A', 'B']]);
    });

    it('タブが既に存在する場合 batchUpdate を呼ばない', async () => {
      const api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A', 'B'],
      });

      await svc.ensureSheet();

      expect(api.spreadsheets.batchUpdate).not.toHaveBeenCalled();
      expect(api.spreadsheets.values.update).not.toHaveBeenCalled();
    });

    it('2回目の呼び出しで API を再呼びしない', async () => {
      const api = makeSheetsApi({ sheetTitles: [] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A'],
      });

      await svc.ensureSheet();
      await svc.ensureSheet();

      expect(api.spreadsheets.get).toHaveBeenCalledTimes(1);
    });

    it('ensureSheet 後 _initialized が true になる', async () => {
      const api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: [],
      });

      await svc.ensureSheet();

      expect(svc._initialized).toBe(true);
    });
  });

  describe('appendRow', () => {
    it('values.append を 1 回呼ぶ', async () => {
      const api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A'],
      });
      await svc.ensureSheet();

      await svc.appendRow(['val1', 'val2']);

      expect(api.spreadsheets.values.append).toHaveBeenCalledTimes(1);
    });

    it('渡した values を rows として append する', async () => {
      const api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A'],
      });
      await svc.ensureSheet();

      await svc.appendRow(['2026-07-01', 'C000001']);

      const req = api.spreadsheets.values.append.mock.calls[0][0];
      expect(req.requestBody.values).toEqual([['2026-07-01', 'C000001']]);
    });

    it('_initialized が false のとき appendRow が ensureSheet を先に呼ぶ', async () => {
      const api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: ['A'],
      });

      await svc.appendRow(['val']);

      expect(api.spreadsheets.get).toHaveBeenCalledTimes(1);
      expect(api.spreadsheets.values.append).toHaveBeenCalledTimes(1);
    });

    it('valueInputOption が RAW', async () => {
      const api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
      const svc = new HistoryService({
        sheetsApi: api,
        spreadsheetId: 'sp-id',
        sheetName: '送信履歴',
        headers: [],
      });
      await svc.ensureSheet();

      await svc.appendRow(['+81-3-0000-0000']);

      const req = api.spreadsheets.values.append.mock.calls[0][0];
      expect(req.valueInputOption).toBe('RAW');
    });
  });
});

// ─── SEND_HISTORY_HEADERS ─────────────────────────────────────────────────────

describe('SEND_HISTORY_HEADERS', () => {
  it('14列を持つ', () => {
    expect(SEND_HISTORY_HEADERS).toHaveLength(14);
  });

  it('必須列を含む', () => {
    expect(SEND_HISTORY_HEADERS).toContain('送信日時');
    expect(SEND_HISTORY_HEADERS).toContain('Batch ID');
    expect(SEND_HISTORY_HEADERS).toContain('企業ID');
    expect(SEND_HISTORY_HEADERS).toContain('Place ID');
    expect(SEND_HISTORY_HEADERS).toContain('送信結果');
    expect(SEND_HISTORY_HEADERS).toContain('Template Name');
    expect(SEND_HISTORY_HEADERS).toContain('Scenario Name');
    expect(SEND_HISTORY_HEADERS).toContain('Sales Pilot Version');
  });
});

// ─── SEND_RESULT ──────────────────────────────────────────────────────────────

describe('SEND_RESULT', () => {
  it('SUCCESS / FAILED / SKIPPED を持つ', () => {
    expect(SEND_RESULT.SUCCESS).toBe('SUCCESS');
    expect(SEND_RESULT.FAILED).toBe('FAILED');
    expect(SEND_RESULT.SKIPPED).toBe('SKIPPED');
  });
});

// ─── APP_VERSION ──────────────────────────────────────────────────────────────

describe('APP_VERSION', () => {
  it('"v" から始まる', () => {
    expect(APP_VERSION.startsWith('v')).toBe(true);
  });
});

// ─── generateBatchId ──────────────────────────────────────────────────────────

describe('generateBatchId', () => {
  it('文字列を返す', () => {
    expect(typeof generateBatchId()).toBe('string');
  });

  it('形式が YYYYMMDDHHmmss-XXXX', () => {
    const id = generateBatchId();
    expect(id).toMatch(/^\d{14}-[A-Z0-9]{4}$/);
  });

  it('2回の呼び出しで異なる値を返す（ランダム部分）', () => {
    const a = generateBatchId();
    const b = generateBatchId();
    expect(a).not.toBe(b);
  });
});

// ─── SendHistoryService ───────────────────────────────────────────────────────

describe('SendHistoryService', () => {
  let api;
  let svc;

  beforeEach(() => {
    api = makeSheetsApi({ sheetTitles: ['送信履歴'] });
    svc = new SendHistoryService({ sheetsApi: api, spreadsheetId: 'sp-id' });
  });

  describe('constructor', () => {
    it('HistoryService を継承する', () => {
      expect(svc).toBeInstanceOf(HistoryService);
    });

    it('sheetName が "送信履歴"', () => {
      expect(svc._sheetName).toBe(SEND_HISTORY_SHEET);
    });

    it('headers が SEND_HISTORY_HEADERS', () => {
      expect(svc._headers).toBe(SEND_HISTORY_HEADERS);
    });
  });

  describe('log', () => {
    it('appendRow を 1 回呼ぶ', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord());

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('SUCCESS レコードに sentAt・batchId・企業ID・送信結果が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord({ result: SEND_RESULT.SUCCESS }));

      const [row] = spy.mock.calls[0];
      expect(row).toContain('2026-07-01T14:30:00.000Z');
      expect(row).toContain('20260701143000-ABCD');
      expect(row).toContain('C000001');
      expect(row).toContain('SUCCESS');
    });

    it('FAILED レコードにエラー内容が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(
        makeRecord({ result: SEND_RESULT.FAILED, error: '接続タイムアウト', messageId: '' })
      );

      const [row] = spy.mock.calls[0];
      expect(row).toContain('FAILED');
      expect(row).toContain('接続タイムアウト');
    });

    it('SKIPPED レコードにスキップ理由が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(
        makeRecord({
          result: SEND_RESULT.SKIPPED,
          subject: '',
          messageId: '',
          error: 'メールなし',
        })
      );

      const [row] = spy.mock.calls[0];
      expect(row).toContain('SKIPPED');
      expect(row).toContain('メールなし');
    });

    it('Template Name が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord({ templateName: 'initial_contact' }));

      const [row] = spy.mock.calls[0];
      expect(row).toContain('initial_contact');
    });

    it('Scenario Name が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord({ scenarioName: '初回営業' }));

      const [row] = spy.mock.calls[0];
      expect(row).toContain('初回営業');
    });

    it('Sales Pilot Version が含まれる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord({ appVersion: 'v0.9.0' }));

      const [row] = spy.mock.calls[0];
      expect(row).toContain('v0.9.0');
    });

    it('appVersion 省略時は APP_VERSION を使う', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord());

      const [row] = spy.mock.calls[0];
      expect(row).toContain(APP_VERSION);
    });

    it('company.placeId が undefined のとき空文字になる', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);
      const record = makeRecord();
      delete record.company.placeId;

      await svc.log(record);

      const [row] = spy.mock.calls[0];
      const placeIdIdx = SEND_HISTORY_HEADERS.indexOf('Place ID');
      expect(row[placeIdIdx]).toBe('');
    });

    it('appendRow に渡す配列の長さが SEND_HISTORY_HEADERS の列数と一致する', async () => {
      await svc.ensureSheet();
      const spy = vi.spyOn(svc, 'appendRow').mockResolvedValue(undefined);

      await svc.log(makeRecord());

      const [row] = spy.mock.calls[0];
      expect(row).toHaveLength(SEND_HISTORY_HEADERS.length);
    });
  });
});
