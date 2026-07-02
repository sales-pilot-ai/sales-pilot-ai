import { createSheetsService, FOLLOW_UP_CATEGORIES } from '../../sheets/index.js';
import { logger } from '../../utils/logger.js';

const SECTION_LABELS = Object.freeze({
  meetingToday: '本日の商談予定',
  waitingUrgent: '要フォロー（返信なし7日以上）',
  meetingTomorrow: '明日の商談予定',
  waitingWarning: '経過観察（返信なし3日以上）',
});

/**
 * @param {string} key
 * @param {object[]} items
 */
function printSection(key, items) {
  console.log('');
  console.log(`【${SECTION_LABELS[key]}】(${items.length}件)`);
  if (!items.length) {
    console.log('・該当なし');
    return;
  }
  for (const item of items) {
    const label =
      item.meetingDate !== undefined
        ? `商談日: ${item.meetingDate}`
        : `送信日: ${item.sentDate}（${item.daysSinceSent}日経過）`;
    console.log(`・${item.companyName} (${item.companyId}) — ${label}`);
  }
}

/**
 * 今日やるべきフォローアップ（商談予定・返信待ち）を優先順位順に表示するコマンド。
 * 営業リスト（getFollowUpList）のみから集計し、新しい API コールは追加しない。
 */
export async function followUpCommand() {
  try {
    const sheetsService = await createSheetsService();
    const result = await sheetsService.getFollowUpList();

    const line = '━'.repeat(24);
    console.log(line);
    console.log('Sales Pilot AI — 今日のアクションリスト');
    console.log(`基準日: ${result.referenceDate}`);
    console.log(line);

    for (const key of FOLLOW_UP_CATEGORIES) {
      printSection(key, result[key]);
    }
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
