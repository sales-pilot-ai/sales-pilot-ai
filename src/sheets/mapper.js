import { settings } from '../config/index.js';

/** 送信可否の承認値 */
export const APPROVAL_VALUE = settings.sheets.approvalValue;

/**
 * シートの日本語ヘッダー名 → Company フィールド名 のマッピング。
 * ヘッダーがこの表に含まれない列は読み書き時にスキップされる。
 */
export const HEADER_TO_FIELD = Object.freeze({
  会社名: 'companyName',
  業種: 'industry',
  エリア: 'area',
  ホームページ: 'websiteUrl',
  メールアドレス: 'email',
  お問い合わせフォーム: 'contactFormUrl',
  電話番号: 'phone',
  住所: 'location',
  メモ: 'memo',
  送信日: 'sentDate',
  送信可否: 'sendApproval',
  送信状況: 'status',
  担当者名: 'contactName',
  最終更新: 'updatedAt',
  企業ID: 'companyId',
  返信有無: 'hasReply',
  商談日: 'meetingDate',
  成約: 'closed',
  'Place ID': 'placeId',
});

/**
 * Company フィールド名 → シートの日本語ヘッダー名 のマッピング。
 */
export const FIELD_TO_HEADER = Object.freeze(
  Object.fromEntries(Object.entries(HEADER_TO_FIELD).map(([h, f]) => [f, h]))
);

/**
 * AI が自動更新できないフィールドの集合。
 * appendCompanies のマージ処理でのみ参照される。
 * send コマンドが updateStatus で送信状況を更新するのは許可される。
 * companyId / placeId は一度採番・設定したら変更不可。
 */
export const PROTECTED_FIELDS = Object.freeze(
  new Set([
    'sendApproval', // 送信可否
    'status', // 送信状況
    'sentDate', // 送信日
    'contactName', // 担当者名
    'memo', // メモ
    'hasReply', // 返信有無
    'meetingDate', // 商談日
    'closed', // 成約
    'companyId', // 企業ID（採番後は不変）
    'placeId', // Place ID（設定後は不変）
  ])
);

/**
 * Company から重複判定キーを生成する（dedup 専用）。
 * 優先順位: Google Place ID > ホームページ URL > 企業名 + 電話番号
 * @param {import('../models/company.js').Company} company
 * @returns {string}
 */
export function generateDedupKey(company) {
  if (company.placeId) return `place:${company.placeId}`;
  if (company.websiteUrl) {
    try {
      const hostname = new URL(company.websiteUrl).hostname.replace(/^www\./, '');
      return `web:${hostname}`;
    } catch {
      return `web:${company.websiteUrl}`;
    }
  }
  const name = (company.companyName ?? '').trim().replace(/\s+/g, '_');
  const phone = (company.phone ?? '').replace(/\D/g, '');
  return `name:${name}:${phone}`;
}

/**
 * エンティティ種別ごとの ID プレフィックス。
 * 将来の拡張（案件ID: 'D', 担当者ID: 'P' など）はここに追加する。
 */
export const ID_PREFIXES = Object.freeze({
  company: 'C',
  // deal:   'D',   // reserved
  // person: 'P',   // reserved
});

/**
 * プレフィックスと連番の整数値から ID 文字列を生成する汎用関数。
 * @param {string} prefix  例: 'C'
 * @param {number} n       1 以上の整数
 * @returns {string}       例: 'C000001'
 */
export function formatId(prefix, n) {
  return `${prefix}${String(n).padStart(6, '0')}`;
}

/**
 * 連番の整数値を C000001 形式の企業ID 文字列にフォーマットする。
 * @param {number} n  1 以上の整数
 * @returns {string}
 */
export function formatCompanyId(n) {
  return formatId(ID_PREFIXES.company, n);
}

/**
 * C000001 形式の企業ID から連番部分の整数を取得する。
 * 不正な形式の場合は null を返す。
 * @param {string} id
 * @returns {number | null}
 */
export function parseCompanyId(id) {
  if (typeof id !== 'string') return null;
  const match = id.match(/^C(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 0-based 列インデックスをアルファベット列名に変換する。
 * 例: 0→'A', 25→'Z', 26→'AA'
 * @param {number} idx  0-based 列インデックス
 * @returns {string}
 */
export function colIndexToLetter(idx) {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * シートの実際のヘッダー行に基づいて Company を行配列に変換する。
 * ヘッダーに対応するフィールドがない列は空文字になる。
 * @param {import('../models/company.js').Company} company
 * @param {string[]} headers  シート 1 行目のヘッダー配列
 * @returns {string[]}
 */
export function companyToRowByHeaders(company, headers) {
  return headers.map((header) => {
    const field = HEADER_TO_FIELD[header];
    if (!field) return '';
    const val = company[field];
    return val === null || val === undefined ? '' : String(val);
  });
}

/**
 * シート行の配列をヘッダーに基づいて Company 相当のオブジェクトに変換する。
 * ヘッダーに対応するフィールドがない列は無視される。
 * @param {string[]} row
 * @param {string[]} headers  シート 1 行目のヘッダー配列
 * @returns {Record<string, string>}
 */
export function rowToCompanyByHeaders(row, headers) {
  const obj = {};
  headers.forEach((header, i) => {
    const field = HEADER_TO_FIELD[header];
    if (field) obj[field] = row[i] ?? '';
  });
  return obj;
}
