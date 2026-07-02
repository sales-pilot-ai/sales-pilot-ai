import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate } from '../gmail/template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** テンプレート本体（.txt/.html/.subject.txt）とインデックスの格納先 */
export const TEMPLATES_DIR = resolve(__dirname, '../../templates/emails');
const INDEX_PATH = resolve(TEMPLATES_DIR, 'templates.json');

/** テンプレート名（CLI引数・ファイル名として安全なスラグ形式のみ許可） */
const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

// ─── 内部ヘルパー ──────────────────────────────────────────────────────────────

/**
 * @param {string} name
 * @returns {{ txt: string, html: string, subject: string }}
 */
function paths(name) {
  return {
    txt: resolve(TEMPLATES_DIR, `${name}.txt`),
    html: resolve(TEMPLATES_DIR, `${name}.html`),
    subject: resolve(TEMPLATES_DIR, `${name}.subject.txt`),
  };
}

function writeIndex(index) {
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

/**
 * templates.json を読み込む。存在しない場合、既存の initial_contact.txt があれば
 * 「初回営業」として自動登録する（#022〜#030 の既存資産を移行なしで拾うため）。
 * @returns {Record<string, { displayName: string, description: string, createdAt: string, updatedAt: string }>}
 */
function readIndex() {
  if (!existsSync(INDEX_PATH)) {
    const bootstrapped = {};
    if (existsSync(paths('initial_contact').txt)) {
      const now = new Date().toISOString();
      bootstrapped.initial_contact = {
        displayName: '初回営業',
        description: '新規開拓の初回コンタクトメール',
        createdAt: now,
        updatedAt: now,
      };
    }
    writeIndex(bootstrapped);
    return bootstrapped;
  }
  return JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));
}

function assertValidName(name) {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      'テンプレート名は英小文字・数字・アンダースコアのみ使用できます（例: second_follow_up）'
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 全テンプレートのメタデータ一覧を返す（名前の昇順）。
 * @returns {Array<{ name: string, displayName: string, description: string, hasHtml: boolean, createdAt: string, updatedAt: string }>}
 */
export function listTemplates() {
  const index = readIndex();
  return Object.entries(index)
    .map(([name, meta]) => ({ name, ...meta, hasHtml: existsSync(paths(name).html) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function templateExists(name) {
  return name in readIndex();
}

/**
 * テンプレートのメタデータ + 本文を返す。
 * @param {string} name
 * @returns {{
 *   name: string, displayName: string, description: string,
 *   subject: string, textBody: string, htmlBody: string | null,
 *   createdAt: string, updatedAt: string,
 * }}
 */
export function getTemplate(name) {
  const index = readIndex();
  const meta = index[name];
  if (!meta) throw new Error(`テンプレートが見つかりません: ${name}`);

  const p = paths(name);
  return {
    name,
    ...meta,
    subject: existsSync(p.subject) ? loadTemplate(p.subject).trim() : '',
    textBody: loadTemplate(p.txt),
    htmlBody: existsSync(p.html) ? loadTemplate(p.html) : null,
  };
}

/**
 * 新規テンプレートを作成する。
 * @param {{
 *   name: string, displayName: string, description?: string,
 *   subject: string, textBody: string, htmlBody?: string | null,
 * }} input
 * @returns {ReturnType<typeof getTemplate>}
 */
export function createTemplate({ name, displayName, description = '', subject, textBody, htmlBody }) {
  assertValidName(name);

  const index = readIndex();
  if (index[name]) throw new Error(`テンプレート「${name}」は既に存在します`);

  const p = paths(name);
  writeFileSync(p.txt, textBody, 'utf-8');
  writeFileSync(p.subject, subject, 'utf-8');
  if (htmlBody) writeFileSync(p.html, htmlBody, 'utf-8');

  const now = new Date().toISOString();
  index[name] = { displayName, description, createdAt: now, updatedAt: now };
  writeIndex(index);

  return getTemplate(name);
}

/**
 * 既存テンプレートを部分更新する。指定したフィールドのみ上書きする。
 * @param {string} name
 * @param {{
 *   displayName?: string, description?: string,
 *   subject?: string, textBody?: string, htmlBody?: string | null,
 * }} updates
 * @returns {ReturnType<typeof getTemplate>}
 */
export function updateTemplate(name, updates) {
  const index = readIndex();
  if (!index[name]) throw new Error(`テンプレートが見つかりません: ${name}`);

  const { displayName, description, subject, textBody, htmlBody } = updates;
  const p = paths(name);

  if (subject !== undefined) writeFileSync(p.subject, subject, 'utf-8');
  if (textBody !== undefined) writeFileSync(p.txt, textBody, 'utf-8');
  if (htmlBody !== undefined) {
    if (htmlBody === null) {
      if (existsSync(p.html)) unlinkSync(p.html);
    } else {
      writeFileSync(p.html, htmlBody, 'utf-8');
    }
  }

  index[name] = {
    ...index[name],
    ...(displayName !== undefined && { displayName }),
    ...(description !== undefined && { description }),
    updatedAt: new Date().toISOString(),
  };
  writeIndex(index);

  return getTemplate(name);
}

/**
 * テンプレートを複製する。本文・件名・HTMLはそのままコピーし、
 * 表示名・説明のみ上書き可能。
 * @param {string} sourceName
 * @param {string} newName
 * @param {{ displayName: string, description?: string }} overrides
 * @returns {ReturnType<typeof getTemplate>}
 */
export function duplicateTemplate(sourceName, newName, { displayName, description }) {
  const source = getTemplate(sourceName);
  return createTemplate({
    name: newName,
    displayName: displayName ?? `${source.displayName}のコピー`,
    description: description ?? source.description,
    subject: source.subject,
    textBody: source.textBody,
    htmlBody: source.htmlBody,
  });
}

/**
 * テンプレートを削除する（本体ファイル + インデックスエントリ）。
 * @param {string} name
 */
export function deleteTemplate(name) {
  const index = readIndex();
  if (!index[name]) throw new Error(`テンプレートが見つかりません: ${name}`);

  const p = paths(name);
  for (const file of [p.txt, p.html, p.subject]) {
    if (existsSync(file)) unlinkSync(file);
  }
  delete index[name];
  writeIndex(index);
}
