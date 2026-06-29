import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const settingsPath = resolve(__dirname, '../../config/settings.json');

export const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

export const env = {
  spreadsheetId: process.env.SPREADSHEET_ID ?? '',
  sheetName: process.env.SHEET_NAME ?? '営業リスト',
  gmailFrom: process.env.GMAIL_FROM ?? '',
  gmailName: process.env.GMAIL_NAME ?? '',
  meetingUrl: process.env.MEETING_URL ?? '',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  sendIntervalMs: Number(process.env.SEND_INTERVAL_MS ?? settings.mailer.sendIntervalMs),
  isDryRun: process.env.DRY_RUN === 'true',
};
