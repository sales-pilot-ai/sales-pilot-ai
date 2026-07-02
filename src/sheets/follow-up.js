import { SEND_STATUS, ACTION_TYPE, FOLLOW_UP_THRESHOLD_DAYS } from '../constants/index.js';

/**
 * フォローアップのカテゴリを優先順位順に並べたもの。
 * CLI・将来の通知機能/ダッシュボードで「一覧として」扱う際はこの順でフラット化する。
 * @type {readonly string[]}
 */
export const FOLLOW_UP_CATEGORIES = Object.freeze([
  'meetingToday',
  'waitingUrgent',
  'meetingTomorrow',
  'waitingWarning',
]);

const CATEGORY_ACTION_TYPE = Object.freeze({
  meetingToday: ACTION_TYPE.MEETING,
  meetingTomorrow: ACTION_TYPE.MEETING,
  waitingUrgent: ACTION_TYPE.FOLLOW_UP,
  waitingWarning: ACTION_TYPE.WAIT_REPLY,
});

const CATEGORY_PRIORITY = Object.freeze({
  meetingToday: 1,
  waitingUrgent: 2,
  meetingTomorrow: 3,
  waitingWarning: 4,
});

/**
 * 基準日時を "YYYY-MM-DD" 形式（Asia/Tokyo）で返す。
 * @param {Date} date
 * @returns {string}
 */
function toDateStringJST(date) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * "YYYY-MM-DD" 文字列に日数を加算した "YYYY-MM-DD" を返す。
 * タイムゾーンに依存しないよう UTC 基準のカレンダー日として計算する。
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 2つの "YYYY-MM-DD" 文字列のカレンダー日数の差を返す（to - from）。
 * @param {string} fromStr
 * @param {string} toStr
 * @returns {number}
 */
function daysBetween(fromStr, toStr) {
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to = new Date(`${toStr}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function isClosed(company) {
  return (company.closed ?? '') !== '';
}

function isUnsubscribed(company) {
  return company.status === SEND_STATUS.UNSUBSCRIBED;
}

function hasMeetingScheduled(company) {
  return (company.meetingDate ?? '') !== '';
}

/**
 * 返信待ち（商談日未設定・未返信・送信済）の企業か判定する。
 * 商談日が設定済みの企業は、既に商談化しているため対象外とする（二重表示防止）。
 * @param {import('../models/company.js').Company} company
 * @returns {boolean}
 */
function isWaitingForReply(company) {
  return (
    (company.sentDate ?? '') !== '' &&
    company.status !== SEND_STATUS.REPLIED &&
    !isUnsubscribed(company) &&
    !isClosed(company) &&
    !hasMeetingScheduled(company)
  );
}

/**
 * @param {import('../models/company.js').Company} company
 * @param {string} category
 * @param {Record<string, unknown>} extra
 * @returns {object}
 */
function makeItem(company, category, extra) {
  return {
    companyId: company.companyId,
    companyName: company.companyName,
    category,
    actionType: CATEGORY_ACTION_TYPE[category],
    priority: CATEGORY_PRIORITY[category],
    ...extra,
  };
}

/**
 * 企業一覧から「今日やるべきフォローアップ」をカテゴリ別に分類する純粋関数。
 * I/O を行わない（SheetsService.getFollowUpList() から企業一覧を渡して呼び出される）。
 *
 * 除外ルール:
 * - 成約/失注が確定済みの企業（closed が空でない）
 * - 配信停止の企業
 *
 * 分類ルール:
 * - 商談日が今日/明日の企業 → meetingToday / meetingTomorrow
 * - それ以外で、送信済・未返信・商談日未設定の企業を「返信待ち」とし、
 *   経過日数が FOLLOW_UP_THRESHOLD_DAYS.URGENT 以上なら waitingUrgent、
 *   WARNING 以上 URGENT 未満なら waitingWarning に分類する
 *   （商談日が設定済みの企業は返信待ちの対象外 = 二重表示防止）
 *
 * @param {import('../models/company.js').Company[]} companies
 * @param {Date} [referenceDate]  基準日時（テスト用に注入可能。省略時は現在時刻）
 * @returns {{
 *   referenceDate: string,
 *   meetingToday: object[],
 *   meetingTomorrow: object[],
 *   waitingUrgent: object[],
 *   waitingWarning: object[],
 * }}
 */
export function buildFollowUpList(companies, referenceDate = new Date()) {
  const today = toDateStringJST(referenceDate);
  const tomorrow = addDays(today, 1);

  const result = {
    referenceDate: today,
    meetingToday: [],
    meetingTomorrow: [],
    waitingUrgent: [],
    waitingWarning: [],
  };

  for (const company of companies) {
    if (isClosed(company) || isUnsubscribed(company)) continue;

    const meetingDate = company.meetingDate ?? '';
    if (meetingDate === today) {
      result.meetingToday.push(makeItem(company, 'meetingToday', { meetingDate }));
      continue;
    }
    if (meetingDate === tomorrow) {
      result.meetingTomorrow.push(makeItem(company, 'meetingTomorrow', { meetingDate }));
      continue;
    }

    if (!isWaitingForReply(company)) continue;

    const daysSinceSent = daysBetween(company.sentDate, today);
    if (daysSinceSent >= FOLLOW_UP_THRESHOLD_DAYS.URGENT) {
      result.waitingUrgent.push(
        makeItem(company, 'waitingUrgent', { sentDate: company.sentDate, daysSinceSent })
      );
    } else if (daysSinceSent >= FOLLOW_UP_THRESHOLD_DAYS.WARNING) {
      result.waitingWarning.push(
        makeItem(company, 'waitingWarning', { sentDate: company.sentDate, daysSinceSent })
      );
    }
  }

  result.waitingUrgent.sort((a, b) => b.daysSinceSent - a.daysSinceSent);
  result.waitingWarning.sort((a, b) => b.daysSinceSent - a.daysSinceSent);
  result.meetingToday.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ja'));
  result.meetingTomorrow.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ja'));

  return result;
}

/**
 * カテゴリ別の結果を優先順位順（本日商談 → 要フォロー7日以上 → 明日商談 → 経過観察3日以上）
 * にフラット化する。CLI・将来の通知機能/ダッシュボードで一覧表示する際に共通利用する。
 * @param {ReturnType<typeof buildFollowUpList>} followUpList
 * @returns {object[]}
 */
export function flattenFollowUpList(followUpList) {
  return FOLLOW_UP_CATEGORIES.flatMap((key) => followUpList[key]);
}
