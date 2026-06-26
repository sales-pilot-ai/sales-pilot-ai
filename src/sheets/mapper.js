import { settings } from '../config/index.js';

const COLUMNS = settings.sheets.columns;

/**
 * 列定義をアルファベット順にソートしたフィールド名配列（A→P 順）
 * @type {string[]}
 */
export const COLUMN_FIELDS = Object.entries(COLUMNS)
  .sort(([, a], [, b]) => a.col.localeCompare(b.col))
  .map(([field]) => field);

/** シートの読み書き範囲（例: "A:P"）*/
export const SHEET_RANGE = `A:${COLUMNS[COLUMN_FIELDS[COLUMN_FIELDS.length - 1]].col}`;

/** 送信可否の承認値 */
export const APPROVAL_VALUE = settings.sheets.approvalValue;

/** 行1がヘッダーかどうか */
export const HEADER_ROW = settings.sheets.headerRow ?? false;

/**
 * Company オブジェクトをシート行の配列に変換する。
 * @param {import('../models/company.js').Company} company
 * @returns {string[]}
 */
export function companyToRow(company) {
  return COLUMN_FIELDS.map((field) => {
    const val = company[field];
    if (val === null || val === undefined) return '';
    return String(val);
  });
}

/**
 * シート行の配列を Company 相当のオブジェクトに変換する。
 * シートに存在しないフィールドは含まれない。
 * @param {string[]} row
 * @returns {Record<string, string>}
 */
export function rowToCompany(row) {
  const obj = {};
  COLUMN_FIELDS.forEach((field, i) => {
    obj[field] = row[i] ?? '';
  });
  return obj;
}
