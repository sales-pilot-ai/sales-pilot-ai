import { existsSync } from 'fs';
import { resolve } from 'path';
import { createAuth } from '../../sheets/auth.js';
import { createSheetsService } from '../../sheets/index.js';
import { createMailer } from '../../gmail/index.js';

// ─── 定義 ─────────────────────────────────────────────────────────────────────

export const ENV_DEFS = [
  {
    key: 'SPREADSHEET_ID',
    required: true,
    description: 'Google Sheets のスプレッドシート ID',
    howTo: 'シートの URL https://docs.google.com/spreadsheets/d/<ID>/edit の <ID> 部分',
  },
  {
    key: 'GMAIL_FROM',
    required: true,
    description: '送信元メールアドレス（Gmail）',
    howTo: 'Gmail アドレスをそのまま記入（例: yourname@gmail.com）',
  },
  {
    key: 'GMAIL_NAME',
    required: true,
    description: '送信者名',
    howTo: 'メールの差出人として表示される名前（例: 山田太郎）',
  },
  {
    key: 'MEETING_URL',
    required: false,
    description: '日程調整 URL（TimeRex・Calendly 等）',
    howTo: 'メール本文の {{meetingUrl}} に挿入される URL',
  },
  {
    key: 'GOOGLE_MAPS_API_KEY',
    required: false,
    description: 'Google Maps Places API キー（find コマンドで必要）',
    howTo: 'Google Cloud Console → API とサービス → 認証情報 → API キーを作成',
  },
];

export const TEMPLATE_PATHS = [
  'templates/emails/initial_contact.txt',
  'templates/emails/initial_contact.html',
  'templates/emails/initial_contact.subject.txt',
];

// ─── 型定義 ──────────────────────────────────────────────────────────────────

/**
 * @typedef {{ ok: boolean | null, label: string, message: string, hint?: string }} CheckResult
 */

// ─── 純粋チェック関数（DI 対応）────────────────────────────────────────────────

/**
 * .env 必須項目を検査する。
 * @param {(key: string) => string | undefined} [getEnv]
 * @returns {CheckResult[]}
 */
export function checkEnvVars(getEnv = (k) => process.env[k]) {
  return ENV_DEFS.map(({ key, required, description, howTo }) => {
    const value = getEnv(key);
    const set = !!value;
    return {
      label: key,
      ok: set ? true : required ? false : null,
      message: set ? '設定済' : required ? '未設定' : '未設定（省略可）',
      hint: set ? undefined : `${description}\n    設定方法: ${howTo}`,
    };
  });
}

/**
 * 必須テンプレートファイルの存在を検査する。
 * @param {(path: string) => boolean} [existsFn]
 * @returns {CheckResult}
 */
export function checkTemplateFiles(existsFn = (p) => existsSync(resolve(p))) {
  const statuses = TEMPLATE_PATHS.map((p) => ({ path: p, ok: existsFn(p) }));
  const found = statuses.filter((s) => s.ok).length;
  const total = TEMPLATE_PATHS.length;
  const allOk = found === total;
  return {
    label: 'テンプレートファイル',
    ok: allOk,
    message: `${found}/${total} 存在確認`,
    hint: allOk
      ? undefined
      : statuses
          .filter((s) => !s.ok)
          .map((s) => `見つかりません: ${s.path}`)
          .join('\n    '),
    details: statuses,
  };
}

// ─── Maps API キーチェック（DI 対応）─────────────────────────────────────────

/**
 * Google Maps API キーの有無と有効性を検査する。
 * @param {(key: string) => string | undefined} [getEnv]
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<CheckResult>}
 */
export async function checkMapsApiKey(
  getEnv = (k) => process.env[k],
  fetchFn = (...args) => fetch(...args)
) {
  const apiKey = getEnv('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return {
      label: 'Google Maps API キー',
      ok: null,
      message: '未設定（find コマンドは使えません）',
      hint: 'Google Cloud Console → API とサービス → 認証情報 → API キーを作成\n    Places API (New) を有効化してください',
    };
  }

  try {
    const res = await fetchFn('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({ textQuery: 'test', languageCode: 'ja', pageSize: 1 }),
    });

    if (res.ok) {
      return { label: 'Google Maps API キー', ok: true, message: 'API キー有効' };
    }

    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message ?? `HTTP ${res.status}`;
    return {
      label: 'Google Maps API キー',
      ok: false,
      message: 'API キーが無効',
      hint: `詳細: ${msg}\n    Cloud Console で Places API (New) が有効化されているか確認してください`,
    };
  } catch (err) {
    return {
      label: 'Google Maps API キー',
      ok: false,
      message: 'API 接続失敗',
      hint: `詳細: ${err.message}`,
    };
  }
}

// ─── 接続チェック関数（DI 対応）────────────────────────────────────────────────

/**
 * Google 認証を試行する。
 * @param {() => Promise<unknown>} [createAuthFn]
 * @returns {Promise<CheckResult>}
 */
export async function checkGoogleAuth(createAuthFn = createAuth) {
  try {
    await createAuthFn();
    return { label: 'Google 認証', ok: true, message: '認証成功' };
  } catch (err) {
    return {
      label: 'Google 認証',
      ok: false,
      message: '認証失敗',
      hint: `credentials/ に認証情報を配置し GOOGLE_AUTH_TYPE を確認してください\n    詳細: ${err.message}`,
    };
  }
}

/**
 * Google Sheets への接続を試行する。
 * @param {() => Promise<unknown>} [createServiceFn]
 * @returns {Promise<CheckResult>}
 */
export async function checkSheetsConnection(createServiceFn = createSheetsService) {
  try {
    await createServiceFn();
    return { label: 'Google Sheets', ok: true, message: '接続成功' };
  } catch (err) {
    return {
      label: 'Google Sheets',
      ok: false,
      message: '接続失敗',
      hint: `SPREADSHEET_ID と認証情報を確認してください\n    詳細: ${err.message}`,
    };
  }
}

/**
 * Gmail への接続を試行する。
 * @param {() => Promise<unknown>} [createMailerFn]
 * @returns {Promise<CheckResult>}
 */
export async function checkGmailConnection(createMailerFn = createMailer) {
  try {
    await createMailerFn();
    return { label: 'Gmail', ok: true, message: '接続成功' };
  } catch (err) {
    return {
      label: 'Gmail',
      ok: false,
      message: '接続失敗',
      hint: `GMAIL_FROM と OAuth 認証スコープを確認してください\n    詳細: ${err.message}`,
    };
  }
}

// ─── 全チェック実行 ──────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   getEnv?: (key: string) => string | undefined,
 *   existsFn?: (path: string) => boolean,
 *   createAuthFn?: () => Promise<unknown>,
 *   createServiceFn?: () => Promise<unknown>,
 *   createMailerFn?: () => Promise<unknown>,
 *   fetchFn?: typeof fetch,
 * }} DiagnosticsOptions
 */

/**
 * すべての診断チェックを実行して結果を返す。
 * @param {DiagnosticsOptions} [options]
 */
export async function runAllChecks({
  getEnv,
  existsFn,
  createAuthFn,
  createServiceFn,
  createMailerFn,
  fetchFn,
} = {}) {
  const envResults = checkEnvVars(getEnv);
  const templateResult = checkTemplateFiles(existsFn);
  const [authResult, sheetsResult, gmailResult, mapsKeyResult] = await Promise.all([
    checkGoogleAuth(createAuthFn),
    checkSheetsConnection(createServiceFn),
    checkGmailConnection(createMailerFn),
    checkMapsApiKey(getEnv, fetchFn),
  ]);

  return {
    env: envResults,
    templates: templateResult,
    auth: authResult,
    sheets: sheetsResult,
    gmail: gmailResult,
    mapsKey: mapsKeyResult,
  };
}
