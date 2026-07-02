import { createSheetsService } from '../../sheets/index.js';
import { DEAL_RESULT } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 既存メモの末尾に新しい内容を追記した文字列を返す。
 * @param {string | undefined} existingMemo
 * @param {string} addition
 * @returns {string}
 */
function appendMemo(existingMemo, addition) {
  const existing = (existingMemo ?? '').trim();
  if (!addition) return existing;
  return existing ? `${existing} / ${addition}` : addition;
}

/**
 * 企業のステータス（商談日・成約・失注・メモ）をシートを開かずに更新するコマンド。
 *
 * @param {string} companyId
 * @param {{ meeting?: string, won?: boolean, lost?: string | boolean, memo?: string }} options
 */
export async function updateCommand(companyId, options = {}) {
  const { meeting, won, lost, memo } = options;

  if (won && lost !== undefined) {
    logger.error('--won と --lost は同時に指定できません');
    process.exit(1);
    return;
  }

  if (meeting !== undefined && !DATE_RE.test(meeting)) {
    logger.error('--meeting は YYYY-MM-DD 形式で指定してください');
    process.exit(1);
    return;
  }

  if (!meeting && !won && lost === undefined && !memo) {
    logger.error('--meeting / --won / --lost / --memo のいずれかを指定してください');
    process.exit(1);
    return;
  }

  try {
    const sheetsService = await createSheetsService();
    const companies = await sheetsService.getAllCompanies();
    const target = companies.find((c) => c.companyId === companyId);

    if (!target) {
      logger.error(`企業ID ${companyId} が見つかりません`);
      process.exit(1);
      return;
    }

    const updates = {};
    if (meeting) updates.meetingDate = meeting;
    if (won) updates.closed = DEAL_RESULT.WON;

    let memoAddition = memo ?? '';
    if (lost !== undefined) {
      updates.closed = DEAL_RESULT.LOST;
      if (typeof lost === 'string' && lost) {
        memoAddition = memoAddition ? `${memoAddition} / 失注理由: ${lost}` : `失注理由: ${lost}`;
      }
    }
    if (memoAddition) {
      updates.memo = appendMemo(target.memo, memoAddition);
    }

    await sheetsService.updateCompanyByCompanyId(companyId, updates);
    logger.success(`${target.companyName} (${companyId}) を更新しました`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
