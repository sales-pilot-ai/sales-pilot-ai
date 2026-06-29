import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * テンプレートファイルを読み込んで文字列で返す。
 * @param {string} templatePath  絶対パスまたは process.cwd() からの相対パス
 * @returns {string}
 */
export function loadTemplate(templatePath) {
  const absPath = resolve(templatePath);
  if (!existsSync(absPath)) {
    throw new Error(`テンプレートファイルが見つかりません: ${absPath}`);
  }
  return readFileSync(absPath, 'utf-8');
}

/**
 * テンプレート文字列の {{key}} プレースホルダーを vars の値で置換する。
 *
 * - 未定義のキーは空文字に置換される
 * - 1 つのテンプレートに同じキーが複数あれば、すべて置換される
 *
 * @param {string} template
 * @param {Record<string, string | number | null | undefined>} vars
 * @returns {string}
 */
export function renderTemplate(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    if (val === null || val === undefined) return '';
    return String(val);
  });
}

/**
 * テンプレートを読み込んで変数を置換したものを返す（loadTemplate + renderTemplate の合成）。
 * @param {string} templatePath
 * @param {Record<string, string | number | null | undefined>} vars
 * @returns {string}
 */
export function renderTemplateFile(templatePath, vars = {}) {
  return renderTemplate(loadTemplate(templatePath), vars);
}
