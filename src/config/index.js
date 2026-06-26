import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const settingsPath = resolve(__dirname, '../../config/settings.json');

export const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

export const env = {
  spreadsheetId: process.env.SPREADSHEET_ID ?? '',
  sheetName: process.env.SHEET_NAME ?? settings.sheets?.defaultSheetName ?? '営業リスト',
  gmailFrom: process.env.GMAIL_FROM ?? '',
  sendIntervalMs: Number(process.env.SEND_INTERVAL_MS ?? settings.mailer.sendIntervalMs),
  isDryRun: process.env.DRY_RUN === 'true',
};
