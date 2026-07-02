import { createSheetsService } from '../../sheets/index.js';
import { logger } from '../../utils/logger.js';

/**
 * 割合を小数第 1 位までにフォーマットする。
 * @param {number} rate
 * @returns {string}
 */
function formatRate(rate) {
  return rate.toFixed(1);
}

/**
 * 現在時刻を "YYYY-MM-DD HH:mm:ss" 形式で返す。
 * @returns {string}
 */
function formatNow() {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * 営業活動の集計レポートを CLI へ表示するコマンド。
 * 営業リスト（getStats）のみから集計し、新しい API コールは追加しない。
 */
export async function reportCommand() {
  try {
    const sheetsService = await createSheetsService();
    const stats = await sheetsService.getStats();

    const line = '━'.repeat(24);

    console.log(line);
    console.log('Sales Pilot AI — 営業レポート');
    console.log(`生成日時: ${formatNow()}`);
    console.log(line);

    console.log('');
    console.log('【総合】');
    console.log(`・総企業数: ${stats.totalCompanies}件`);
    console.log(`・送信済件数: ${stats.sentCount}件`);
    console.log(`・送信率: ${formatRate(stats.sendRate)}%`);
    console.log(`・送信待ち件数: ${stats.waitingCount}件`);

    console.log('');
    console.log('【返信】');
    console.log(`・返信件数: ${stats.repliedCount}件`);
    console.log(`・返信率: ${formatRate(stats.replyRate)}%`);

    console.log('');
    console.log('【営業】');
    console.log(`・商談中件数: ${stats.meetingCount}件`);
    console.log(`・成約件数: ${stats.closedCount}件`);
    console.log(`・失注件数: ${stats.lostCount}件`);
    console.log(`・配信停止件数: ${stats.unsubscribedCount}件`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
