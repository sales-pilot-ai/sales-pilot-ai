import { randomUUID } from 'crypto';
import { STATUS, STATUS_VALUES } from '../constants/index.js';

export { STATUS, STATUS_VALUES };

// ─── Enums ────────────────────────────────────────────────────────────────────

/** @typedef {'○' | '×' | ''} SendApproval */
/** @typedef {'NEW' | 'SENT' | 'REPLIED' | 'MEETING' | 'CLOSED' | 'NG'} CompanyStatus */

/** @type {readonly SendApproval[]} */
export const SEND_APPROVAL_VALUES = Object.freeze(['○', '×', '']);

// ─── Type ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Company
 * @property {string}          id             - 一意識別子（UUID）
 * @property {string}          companyName    - 企業名
 * @property {string}          contactName    - 担当者名
 * @property {string}          industry       - 業種
 * @property {string}          email          - メールアドレス
 * @property {string}          phone          - 電話番号
 * @property {string}          websiteUrl     - WebサイトURL
 * @property {string}          contactFormUrl - お問い合わせフォームURL
 * @property {string}          instagram      - InstagramアカウントURL
 * @property {string}          tiktok         - TikTokアカウントURL
 * @property {string}          location       - 所在地
 * @property {number | null}   employeeCount  - 従業員数
 * @property {number | null}   storeCount     - 店舗数
 * @property {SendApproval}    sendApproval   - 送信可否（○ / × / 未記入）
 * @property {CompanyStatus}   status         - 進行ステータス
 * @property {string | null}   sentDate       - 送付日（YYYY-MM-DD）
 * @property {string}          reply          - 返信内容
 * @property {string}          memo           - 備考
 * @property {number | null}   leadScore      - リードスコア（Provider が算出する優先度スコア）
 * @property {string}          timeRexUrl     - Meeting URL（TimeRex 等）
 * @property {number}          sendCount      - 送信済み回数（0 始まり）
 * @property {string}          googleMapsUrl  - Google Maps URL
 * @property {string}          placeId        - Google Place ID（重複管理用）
 * @property {string}          companyId      - 企業識別子（PlaceID / URL / 名前+電話 の優先順）
 * @property {string}          hasReply       - 返信有無
 * @property {string | null}   meetingDate    - 商談日（YYYY-MM-DD）
 * @property {string}          closed         - 成約ステータス
 * @property {string}          createdAt      - 作成日時（ISO 8601）
 * @property {string}          updatedAt      - 更新日時（ISO 8601）
 */

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Company オブジェクトを生成する。省略したフィールドはデフォルト値で埋める。
 * @param {Partial<Company>} [data]
 * @returns {Company}
 */
export function createCompany(data = {}) {
  const now = new Date().toISOString();
  return {
    id: data.id ?? randomUUID(),
    companyName: data.companyName ?? '',
    contactName: data.contactName ?? '',
    industry: data.industry ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    websiteUrl: data.websiteUrl ?? '',
    contactFormUrl: data.contactFormUrl ?? '',
    instagram: data.instagram ?? '',
    tiktok: data.tiktok ?? '',
    location: data.location ?? '',
    employeeCount: data.employeeCount ?? null,
    storeCount: data.storeCount ?? null,
    sendApproval: data.sendApproval ?? '',
    status: data.status ?? STATUS.NEW,
    sentDate: data.sentDate ?? null,
    reply: data.reply ?? '',
    memo: data.memo ?? '',
    leadScore: data.leadScore ?? null,
    timeRexUrl: data.timeRexUrl ?? '',
    sendCount: data.sendCount ?? 0,
    googleMapsUrl: data.googleMapsUrl ?? '',
    placeId: data.placeId ?? '',
    companyId: data.companyId ?? '',
    hasReply: data.hasReply ?? '',
    meetingDate: data.meetingDate ?? null,
    closed: data.closed ?? '',
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationError
 * @property {string} field
 * @property {string} message
 */

/** @type {RegExp} */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @type {RegExp} */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Company の各フィールドを検証し、エラー一覧を返す。
 * エラーがなければ空配列を返す。
 * @param {Company} company
 * @returns {ValidationError[]}
 */
export function validateCompany(company) {
  const errors = [];

  if (!company.companyName?.trim()) {
    errors.push({ field: 'companyName', message: '企業名は必須です' });
  }

  if (company.email && !EMAIL_RE.test(company.email)) {
    errors.push({ field: 'email', message: 'メールアドレスの形式が不正です' });
  }

  if (!SEND_APPROVAL_VALUES.includes(company.sendApproval)) {
    errors.push({
      field: 'sendApproval',
      message: `送信可否は ${SEND_APPROVAL_VALUES.map((v) => `"${v}"`).join(', ')} のいずれかである必要があります`,
    });
  }

  if (!STATUS_VALUES.includes(company.status)) {
    errors.push({
      field: 'status',
      message: `ステータスは ${STATUS_VALUES.map((v) => `"${v}"`).join(', ')} のいずれかである必要があります`,
    });
  }

  if (company.sentDate !== null && !DATE_RE.test(company.sentDate)) {
    errors.push({ field: 'sentDate', message: '送付日は YYYY-MM-DD 形式で入力してください' });
  }

  if (company.employeeCount !== null) {
    if (!Number.isInteger(company.employeeCount) || company.employeeCount < 0) {
      errors.push({
        field: 'employeeCount',
        message: '従業員数は 0 以上の整数である必要があります',
      });
    }
  }

  if (company.storeCount !== null) {
    if (!Number.isInteger(company.storeCount) || company.storeCount < 0) {
      errors.push({ field: 'storeCount', message: '店舗数は 0 以上の整数である必要があります' });
    }
  }

  if (company.leadScore !== null) {
    if (
      typeof company.leadScore !== 'number' ||
      !isFinite(company.leadScore) ||
      company.leadScore < 0
    ) {
      errors.push({
        field: 'leadScore',
        message: 'リードスコアは 0 以上の数値である必要があります',
      });
    }
  }

  if (!Number.isInteger(company.sendCount) || company.sendCount < 0) {
    errors.push({ field: 'sendCount', message: '送信回数は 0 以上の整数である必要があります' });
  }

  return errors;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * 送信対象（送信可否が ○）かどうかを返す。
 * @param {Company} company
 * @returns {boolean}
 */
export function isApproved(company) {
  return company.sendApproval === '○';
}

/**
 * Company の指定フィールドを更新した新しいオブジェクトを返す。
 * id と createdAt は変更不可。updatedAt は現在時刻に自動更新される。
 * @param {Company} company
 * @param {Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>} updates
 * @returns {Company}
 */
export function updateCompany(company, updates) {
  return {
    ...company,
    ...updates,
    id: company.id,
    createdAt: company.createdAt,
    updatedAt: new Date().toISOString(),
  };
}
