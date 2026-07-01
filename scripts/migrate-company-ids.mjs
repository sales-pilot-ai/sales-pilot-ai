/**
 * Issue #022: 既存の 000001 形式企業ID を C000001 形式へ一括マイグレーション
 * Usage: node scripts/migrate-company-ids.mjs
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { google } from 'googleapis';
import { createCompany } from '../src/models/company.js';
import { SheetsService } from '../src/sheets/service.js';

const oauthClient = JSON.parse(readFileSync('credentials/oauth-client.json', 'utf8'));
const token = JSON.parse(readFileSync('credentials/oauth-token.json', 'utf8'));
const { client_id, client_secret } = oauthClient.installed ?? oauthClient.web;
const oAuth2 = new google.auth.OAuth2(client_id, client_secret);
oAuth2.setCredentials(token);

const sheetsApi = google.sheets({ version: 'v4', auth: oAuth2 });

const service = new SheetsService({
  sheetsApi,
  spreadsheetId: process.env.SPREADSHEET_ID,
  sheetName: process.env.SHEET_NAME || '営業リスト',
});

// appendCompanies に存在しない企業を渡すことでマイグレーションだけを実行する
// (placeId が既存と一致しない → 新規として追記しようとするが、マイグレーションは先に走る)
// → 実際に追記されても dedup で次回は弾かれるが、追記自体は避けたい。
// そのため「絶対に存在しない URL」を使い、追記後すぐに確認する。
//
// より安全な方法: appendCompanies の migration ループだけを直接実行する。
// ここではシンプルに service を使う。

console.log('=== 企業ID マイグレーション開始 ===');

// シートを直接読んでマイグレーションだけを行う
// （appendCompanies を使わずに直接 updateStatus を呼ぶ）
const res = await sheetsApi.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID,
  range: process.env.SHEET_NAME || '営業リスト',
});
const allRows = res.data.values ?? [];
if (!allRows.length) {
  console.log('シートが空です');
  process.exit(0);
}

const headers = allRows[0].map(String);
const companyIdIdx = headers.indexOf('企業ID');
const nameIdx = headers.indexOf('会社名');

if (companyIdIdx < 0) {
  console.log('企業ID 列が見つかりません');
  process.exit(1);
}

// ヘッダーキャッシュを service に設定（updateStatus が使えるように）
service._headerCache = service._buildHeaderCache(headers);

let migrated = 0;
for (let i = 1; i < allRows.length; i++) {
  const row = allRows[i];
  const id = row[companyIdIdx] ?? '';
  const name = nameIdx >= 0 ? (row[nameIdx] ?? '') : `行${i + 1}`;

  // 純数字形式（旧 #021 形式）
  if (id !== '' && /^\d+$/.test(id)) {
    const n = parseInt(id, 10);
    const newId = `C${String(n).padStart(6, '0')}`;
    await service.updateStatus(i + 1, { companyId: newId });
    console.log(`  行 ${i + 1} 「${name}」: ${id} → ${newId}`);
    migrated++;
  }
}

if (migrated === 0) {
  console.log('マイグレーション対象なし（既に C 形式か、または空）');
} else {
  console.log(`\n${migrated} 件をマイグレーションしました`);
}
