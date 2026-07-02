import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ENV_PATH = resolve(__dirname, '../../.env');
export const SETTINGS_PATH = resolve(__dirname, '../../config/settings.json');

// ─── 設定キー定義 ──────────────────────────────────────────────────────────────

/** 設定変更可能なキー一覧（表示順） */
export const CONFIG_KEYS = Object.freeze([
  'SPREADSHEET_ID',
  'SHEET_NAME',
  'GMAIL_FROM',
  'MEETING_URL',
  'DEFAULT_LIMIT',
  'REQUEST_DELAY_MS',
  'DEFAULT_TEMPLATE',
]);

/** 各キーの日本語ラベル */
export const CONFIG_LABELS = Object.freeze({
  SPREADSHEET_ID: 'Google Sheets ID',
  SHEET_NAME: 'Sheet名',
  GMAIL_FROM: 'Gmail送信元',
  MEETING_URL: 'Meeting URL',
  DEFAULT_LIMIT: 'デフォルト取得件数',
  REQUEST_DELAY_MS: 'WebsiteAnalyzer待機時間(ms)',
  DEFAULT_TEMPLATE: 'デフォルトメールテンプレート',
});

/**
 * .env に保存するキー（インスタンス固有・機密性を含む可能性がある値）。
 * settings.json に保存するキー（アプリ動作設定・git 管理可）は含まない。
 */
const ENV_KEYS = new Set(['SPREADSHEET_ID', 'SHEET_NAME', 'GMAIL_FROM', 'MEETING_URL']);

// ─── 内部ヘルパー ──────────────────────────────────────────────────────────────

function readEnvFile() {
  try {
    return readFileSync(ENV_PATH, 'utf-8');
  } catch {
    return '';
  }
}

function readSettingsFile() {
  return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
}

function getSettingsValue(key) {
  const json = readSettingsFile();
  if (key === 'DEFAULT_LIMIT') return String(json.crawler.defaultLimit);
  if (key === 'REQUEST_DELAY_MS') return String(json.crawler.requestDelayMs);
  if (key === 'DEFAULT_TEMPLATE') return String(json.mailer.defaultTemplate ?? '');
  return '';
}

function writeEnvValue(key, value) {
  let content = readEnvFile();
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, newLine);
  } else {
    const trimmed = content.trimEnd();
    content = trimmed + (trimmed ? '\n' : '') + newLine + '\n';
  }

  writeFileSync(ENV_PATH, content, 'utf-8');
  process.env[key] = value;
}

function writeSettingsValue(key, rawValue) {
  const json = readSettingsFile();
  if (key === 'DEFAULT_LIMIT') json.crawler.defaultLimit = Number(rawValue);
  if (key === 'REQUEST_DELAY_MS') json.crawler.requestDelayMs = Number(rawValue);
  if (key === 'DEFAULT_TEMPLATE') json.mailer.defaultTemplate = rawValue;
  writeFileSync(SETTINGS_PATH, JSON.stringify(json, null, 2) + '\n', 'utf-8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 指定キーの現在値を返す。
 * .env キーは process.env から、settings.json キーはファイルから読む。
 * @param {string} key
 */
export function getCurrentValue(key) {
  if (ENV_KEYS.has(key)) return process.env[key] ?? '';
  return getSettingsValue(key);
}

/**
 * すべての設定キーと現在値を返す。
 * @returns {Record<string, string>}
 */
export function getAllSettings() {
  return Object.fromEntries(CONFIG_KEYS.map((k) => [k, getCurrentValue(k)]));
}

/**
 * 設定を更新してファイルへ書き込む。
 * .env キーは .env を更新し process.env にも反映する。
 * settings.json キーは settings.json を更新する。
 * @param {string} key
 * @param {string} value
 */
export function updateSetting(key, value) {
  if (!CONFIG_KEYS.includes(key)) throw new Error(`未知の設定キーです: ${key}`);
  if (ENV_KEYS.has(key)) {
    writeEnvValue(key, value);
  } else {
    writeSettingsValue(key, value);
  }
}
