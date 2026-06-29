import { describe, it, expect } from 'vitest';
import {
  checkEnvVars,
  checkTemplateFiles,
  checkGoogleAuth,
  checkSheetsConnection,
  checkGmailConnection,
  checkMapsApiKey,
  ENV_DEFS,
  TEMPLATE_PATHS,
} from './diagnostics.js';

// ─── checkEnvVars ─────────────────────────────────────────────────────────────

describe('checkEnvVars', () => {
  it('すべて設定済みのとき全結果が ok=true', () => {
    const getEnv = () => 'value';
    const results = checkEnvVars(getEnv);
    expect(results.every((r) => r.ok === true)).toBe(true);
  });

  it('ENV_DEFS の件数と一致する結果を返す', () => {
    const results = checkEnvVars(() => '');
    expect(results).toHaveLength(ENV_DEFS.length);
  });

  it('必須項目が未設定のとき ok=false', () => {
    const required = ENV_DEFS.filter((d) => d.required).map((d) => d.key);
    const getEnv = (k) => (required.includes(k) ? '' : 'value');
    const results = checkEnvVars(getEnv);
    const requiredResults = results.filter((r) => required.includes(r.label));
    expect(requiredResults.every((r) => r.ok === false)).toBe(true);
  });

  it('省略可項目が未設定のとき ok=null', () => {
    const optional = ENV_DEFS.filter((d) => !d.required).map((d) => d.key);
    const getEnv = (k) => (optional.includes(k) ? '' : 'value');
    const results = checkEnvVars(getEnv);
    const optionalResults = results.filter((r) => optional.includes(r.label));
    expect(optionalResults.every((r) => r.ok === null)).toBe(true);
  });

  it('未設定の必須項目に hint が含まれる', () => {
    const getEnv = () => '';
    const results = checkEnvVars(getEnv);
    const requiredResults = results.filter((r) => r.ok === false);
    expect(requiredResults.every((r) => typeof r.hint === 'string')).toBe(true);
  });

  it('設定済みの項目に hint が含まれない', () => {
    const getEnv = () => 'value';
    const results = checkEnvVars(getEnv);
    expect(results.every((r) => r.hint === undefined)).toBe(true);
  });

  it('各結果に label と message が含まれる', () => {
    const results = checkEnvVars(() => 'val');
    for (const r of results) {
      expect(typeof r.label).toBe('string');
      expect(typeof r.message).toBe('string');
    }
  });
});

// ─── checkTemplateFiles ───────────────────────────────────────────────────────

describe('checkTemplateFiles', () => {
  it('すべて存在するとき ok=true', () => {
    const result = checkTemplateFiles(() => true);
    expect(result.ok).toBe(true);
    expect(result.message).toBe(`${TEMPLATE_PATHS.length}/${TEMPLATE_PATHS.length} 存在確認`);
  });

  it('1 件でも欠けているとき ok=false', () => {
    let called = 0;
    const existsFn = () => called++ !== 0;
    const result = checkTemplateFiles(existsFn);
    expect(result.ok).toBe(false);
  });

  it('すべて存在しないとき ok=false かつ hint がある', () => {
    const result = checkTemplateFiles(() => false);
    expect(result.ok).toBe(false);
    expect(typeof result.hint).toBe('string');
    expect(result.hint.length).toBeGreaterThan(0);
  });

  it('details に各パスの状態が含まれる', () => {
    const result = checkTemplateFiles(() => true);
    expect(result.details).toHaveLength(TEMPLATE_PATHS.length);
    for (const d of result.details) {
      expect(typeof d.path).toBe('string');
      expect(d.ok).toBe(true);
    }
  });

  it('すべて存在するとき hint は undefined', () => {
    const result = checkTemplateFiles(() => true);
    expect(result.hint).toBeUndefined();
  });
});

// ─── checkGoogleAuth ──────────────────────────────────────────────────────────

describe('checkGoogleAuth', () => {
  it('認証成功のとき ok=true', async () => {
    const result = await checkGoogleAuth(() => Promise.resolve({}));
    expect(result.ok).toBe(true);
    expect(result.label).toBe('Google 認証');
  });

  it('認証失敗のとき ok=false かつ hint がある', async () => {
    const result = await checkGoogleAuth(() => Promise.reject(new Error('credentials not found')));
    expect(result.ok).toBe(false);
    expect(typeof result.hint).toBe('string');
  });
});

// ─── checkSheetsConnection ────────────────────────────────────────────────────

describe('checkSheetsConnection', () => {
  it('接続成功のとき ok=true', async () => {
    const result = await checkSheetsConnection(() => Promise.resolve({}));
    expect(result.ok).toBe(true);
    expect(result.label).toBe('Google Sheets');
  });

  it('接続失敗のとき ok=false かつ hint がある', async () => {
    const result = await checkSheetsConnection(() =>
      Promise.reject(new Error('SPREADSHEET_ID not set'))
    );
    expect(result.ok).toBe(false);
    expect(typeof result.hint).toBe('string');
  });
});

// ─── checkGmailConnection ─────────────────────────────────────────────────────

describe('checkGmailConnection', () => {
  it('接続成功のとき ok=true', async () => {
    const result = await checkGmailConnection(() => Promise.resolve({}));
    expect(result.ok).toBe(true);
    expect(result.label).toBe('Gmail');
  });

  it('接続失敗のとき ok=false かつ hint がある', async () => {
    const result = await checkGmailConnection(() =>
      Promise.reject(new Error('GMAIL_FROM not set'))
    );
    expect(result.ok).toBe(false);
    expect(typeof result.hint).toBe('string');
  });
});

// ─── checkMapsApiKey ──────────────────────────────────────────────────────────

describe('checkMapsApiKey', () => {
  it('API キーが未設定のとき ok=null', async () => {
    const result = await checkMapsApiKey(() => '');
    expect(result.ok).toBeNull();
    expect(result.label).toBe('Google Maps API キー');
    expect(typeof result.hint).toBe('string');
  });

  it('API キーが設定されていて API が成功のとき ok=true', async () => {
    const getEnv = (k) => (k === 'GOOGLE_MAPS_API_KEY' ? 'test_key' : '');
    const fetchFn = () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ places: [] }) });
    const result = await checkMapsApiKey(getEnv, fetchFn);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('有効');
  });

  it('API が 403 を返したとき ok=false かつ hint がある', async () => {
    const getEnv = (k) => (k === 'GOOGLE_MAPS_API_KEY' ? 'bad_key' : '');
    const fetchFn = () =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { message: 'API key not valid' } }),
      });
    const result = await checkMapsApiKey(getEnv, fetchFn);
    expect(result.ok).toBe(false);
    expect(result.hint).toContain('API key not valid');
  });

  it('ネットワークエラーのとき ok=false かつ hint がある', async () => {
    const getEnv = (k) => (k === 'GOOGLE_MAPS_API_KEY' ? 'test_key' : '');
    const fetchFn = () => Promise.reject(new Error('network error'));
    const result = await checkMapsApiKey(getEnv, fetchFn);
    expect(result.ok).toBe(false);
    expect(result.hint).toContain('network error');
  });

  it('API キーが設定されているとき X-Goog-Api-Key ヘッダーで fetch を呼ぶ', async () => {
    const getEnv = (k) => (k === 'GOOGLE_MAPS_API_KEY' ? 'my_key' : '');
    let capturedOptions;
    const fetchFn = (_url, options) => {
      capturedOptions = options;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    };
    await checkMapsApiKey(getEnv, fetchFn);
    expect(capturedOptions.headers['X-Goog-Api-Key']).toBe('my_key');
  });
});
