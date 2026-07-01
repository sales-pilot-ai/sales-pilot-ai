import { SEND_STATUS } from '../../constants/index.js';

// 無条件でスキップするステータス
const ALWAYS_SKIP = new Set([SEND_STATUS.REPLIED, SEND_STATUS.UNSUBSCRIBED]);

// --force なしでスキップするステータス
const SKIP_WITHOUT_FORCE = new Set([SEND_STATUS.SENT]);

/**
 * 企業のステータスに基づいて送信をスキップするか判定する。
 *
 * - 未送信 / 送信失敗 / 空値 → 送信対象
 * - 送信済                   → --force のときのみ送信
 * - 返信あり / 配信停止      → 常にスキップ
 *
 * @param {{ status?: string }} company
 * @param {{ force?: boolean }} [options]
 * @returns {{ skip: boolean, reason?: string }}
 */
export function shouldSkip(company, { force = false } = {}) {
  if (!company.email || !company.email.trim()) {
    return { skip: true, reason: 'メールなし' };
  }

  const status = company.status ?? '';

  if (ALWAYS_SKIP.has(status)) {
    return { skip: true, reason: status };
  }

  if (!force && SKIP_WITHOUT_FORCE.has(status)) {
    return { skip: true, reason: status };
  }

  return { skip: false };
}
