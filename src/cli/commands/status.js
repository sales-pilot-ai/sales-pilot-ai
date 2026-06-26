import { getApprovedRows, updateStatus } from '../../sheets/index.js';
import { logger } from '../../utils/logger.js';

export async function statusCommand() {
  try {
    const companies = await getApprovedRows();
    const today = new Date().toISOString().slice(0, 10);

    for (const company of companies) {
      await updateStatus(company.rowIndex, {
        sentDate: today,
        status: '送信済',
      });
    }

    logger.success(`${companies.length}件のステータスを更新しました`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
