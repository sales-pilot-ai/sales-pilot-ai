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
