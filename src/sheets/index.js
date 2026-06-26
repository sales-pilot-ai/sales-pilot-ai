import { logger } from '../utils/logger.js';

/**
 * 企業リストをスプレッドシートへ追記する
 * @param {import('../crawler/index.js').Company[]} companies
 */
export async function appendCompanies(companies) {
  logger.step(`${companies.length}件をスプレッドシートへ書き込み中...`);

  // TODO: google-auth-library + googleapis で実装予定
  throw new Error('Sheets連携は未実装です。Phase 1 で実装予定。');
}

/**
 * 送信可否が○の行を取得する
 * @returns {Promise<import('../crawler/index.js').Company[]>}
 */
export async function getApprovedRows() {
  logger.step('送信可否○の企業を取得中...');

  // TODO: 実装予定
  throw new Error('Sheets連携は未実装です。Phase 1 で実装予定。');
}

/**
 * 送付日・ステータスを更新する
 * @param {string} rowIndex
 * @param {{ sentDate: string, status: string }} values
 */
export async function updateStatus(_rowIndex, _values) {
  // TODO: 実装予定
  throw new Error('Sheets連携は未実装です。Phase 1 で実装予定。');
}
