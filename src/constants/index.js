// ─── 営業ステータス ──────────────────────────────────────────────────────────

/**
 * 営業進行ステータスの定数。CLI・Sheets・Company モデルで共通利用する。
 * @readonly
 * @enum {string}
 */
export const STATUS = Object.freeze({
  NEW: 'NEW',
  SENT: 'SENT',
  REPLIED: 'REPLIED',
  MEETING: 'MEETING',
  CLOSED: 'CLOSED',
  NG: 'NG',
});

/** @type {readonly string[]} */
export const STATUS_VALUES = Object.freeze(Object.values(STATUS));

// ─── 送信ステータス ───────────────────────────────────────────────────────────

/**
 * メール送信ステータス。スプレッドシートの status 列に書き込む日本語値。
 * @readonly
 * @enum {string}
 */
export const SEND_STATUS = Object.freeze({
  NOT_SENT: '未送信',
  SENT: '送信済',
  FAILED: '送信失敗',
  REPLIED: '返信あり',
  UNSUBSCRIBED: '配信停止',
});

/** @type {readonly string[]} */
export const SEND_STATUS_VALUES = Object.freeze(Object.values(SEND_STATUS));

// ─── 商談結果 ─────────────────────────────────────────────────────────────────

/**
 * 商談結果。スプレッドシートの 成約（closed）列に書き込む日本語値。
 * @readonly
 * @enum {string}
 */
export const DEAL_RESULT = Object.freeze({
  WON: '成約',
  LOST: '失注',
});
