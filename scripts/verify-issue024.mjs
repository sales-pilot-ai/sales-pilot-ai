/**
 * Issue #024 実機テスト — 送信履歴システム
 *
 * Usage: node scripts/verify-issue024.mjs
 */
import 'dotenv/config';
import { google } from 'googleapis';
import { readFileSync } from 'fs';

// ── OAuth 認証 ──────────────────────────────────────────────────────────────
const oauthClient = JSON.parse(readFileSync('credentials/oauth-client.json', 'utf8'));
const token = JSON.parse(readFileSync('credentials/oauth-token.json', 'utf8'));
const { client_id, client_secret } = oauthClient.installed ?? oauthClient.web;
const auth = new google.auth.OAuth2(client_id, client_secret);
auth.setCredentials(token);
const sheetsApi = google.sheets({ version: 'v4', auth });

const spreadsheetId = process.env.SPREADSHEET_ID;

let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✔ ${label}${detail ? ': ' + detail : ''}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    fail++;
  }
}

// ── 実装モジュールをインポート ─────────────────────────────────────────────
import {
  SendHistoryService,
  SEND_RESULT,
  SEND_HISTORY_HEADERS,
  SEND_HISTORY_SHEET,
  APP_VERSION,
  generateBatchId,
} from '../src/sheets/send-history.js';

// ── T-01: 定数・型チェック ───────────────────────────────────────────────
console.log('=== T-01: 定数チェック ===');
check(
  'SEND_HISTORY_HEADERS が 14列',
  SEND_HISTORY_HEADERS.length === 14,
  `${SEND_HISTORY_HEADERS.length}列`
);
check('SEND_RESULT.SUCCESS === "SUCCESS"', SEND_RESULT.SUCCESS === 'SUCCESS');
check('SEND_RESULT.FAILED === "FAILED"', SEND_RESULT.FAILED === 'FAILED');
check('SEND_RESULT.SKIPPED === "SKIPPED"', SEND_RESULT.SKIPPED === 'SKIPPED');
check('APP_VERSION が "v" で始まる', APP_VERSION.startsWith('v'), APP_VERSION);

// ── T-02: generateBatchId ──────────────────────────────────────────────
console.log('\n=== T-02: generateBatchId ===');
const batchId1 = generateBatchId();
const batchId2 = generateBatchId();
check('形式が YYYYMMDDHHmmss-XXXX', /^\d{14}-[A-Z0-9]{4}$/.test(batchId1), batchId1);
check('2回の呼び出しで異なる値', batchId1 !== batchId2);

// ── T-03: ensureSheet — 初回作成 ────────────────────────────────────────
console.log('\n=== T-03: 送信履歴タブの自動作成 ===');

// テスト用に既存の送信履歴タブを確認
const meta = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const sheetTitles = (meta.data.sheets ?? []).map((s) => s.properties.title);
const hadSheet = sheetTitles.includes(SEND_HISTORY_SHEET);
console.log(`  既存タブ: [${sheetTitles.join(', ')}]`);
console.log(`  送信履歴タブが既に存在: ${hadSheet}`);

const svc = new SendHistoryService({ sheetsApi, spreadsheetId });
await svc.ensureSheet();
check('ensureSheet 後 _initialized が true', svc._initialized === true);

// タブが作成されたか確認
const meta2 = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const sheetTitles2 = (meta2.data.sheets ?? []).map((s) => s.properties.title);
check('送信履歴タブが存在する', sheetTitles2.includes(SEND_HISTORY_SHEET), sheetTitles2.join(', '));

// ── T-04: ヘッダー確認 ──────────────────────────────────────────────────
console.log('\n=== T-04: ヘッダー行の確認 ===');
const headerRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${SEND_HISTORY_SHEET}'!1:1`,
});
const sheetHeaders = (headerRes.data.values ?? [[]])[0] ?? [];
check('1行目がヘッダー行', sheetHeaders.length > 0, `${sheetHeaders.length}列`);
check('14列のヘッダー', sheetHeaders.length === 14, sheetHeaders.join(' | '));
check('"Batch ID" 列が存在', sheetHeaders.includes('Batch ID'));
check('"送信結果" 列が存在', sheetHeaders.includes('送信結果'));
check('"Template Name" 列が存在', sheetHeaders.includes('Template Name'));
check('"Sales Pilot Version" 列が存在', sheetHeaders.includes('Sales Pilot Version'));

// ── T-05: ログの追記テスト ──────────────────────────────────────────────
console.log('\n=== T-05: 履歴の追記テスト ===');
const batchId = generateBatchId();
const testCompany = {
  companyId: 'C000099',
  placeId: 'ChIJtest',
  companyName: '【テスト】検証企業',
  email: 'verify@test.example',
};

// 追記前の行数を取得
const beforeRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${SEND_HISTORY_SHEET}'!A:A`,
});
const beforeRows = (beforeRes.data.values ?? []).length;

// SUCCESS レコードを追記
await svc.log({
  sentAt: new Date().toISOString(),
  batchId,
  company: testCompany,
  subject: '【検証】テスト件名',
  messageId: 'test-msg-001',
  result: SEND_RESULT.SUCCESS,
  error: '',
  sender: 'verify@sender.example',
  templateName: 'initial_contact',
  scenarioName: '初回営業',
  appVersion: 'v0.0.0-test',
});

// SKIPPED レコードを追記
await svc.log({
  sentAt: new Date().toISOString(),
  batchId,
  company: { ...testCompany, companyId: 'C000098', email: '' },
  subject: '',
  messageId: '',
  result: SEND_RESULT.SKIPPED,
  error: 'メールなし',
  sender: 'verify@sender.example',
  templateName: 'initial_contact',
  scenarioName: '初回営業',
  appVersion: 'v0.0.0-test',
});

// 追記後の行数を確認
const afterRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${SEND_HISTORY_SHEET}'!A:A`,
});
const afterRows = (afterRes.data.values ?? []).length;
check('2行追記された', afterRows === beforeRows + 2, `${beforeRows} → ${afterRows}行`);

// 追記内容を確認
const lastRows = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${SEND_HISTORY_SHEET}'!A${beforeRows + 1}:N${beforeRows + 2}`,
});
const written = lastRows.data.values ?? [];
const successRow = written[0] ?? [];
const skippedRow = written[1] ?? [];

const resultIdx = SEND_HISTORY_HEADERS.indexOf('送信結果');
const batchIdIdx = SEND_HISTORY_HEADERS.indexOf('Batch ID');
const errorIdx = SEND_HISTORY_HEADERS.indexOf('エラー内容');
const versionIdx = SEND_HISTORY_HEADERS.indexOf('Sales Pilot Version');

check('SUCCESS 行の送信結果', successRow[resultIdx] === 'SUCCESS', successRow[resultIdx]);
check('SKIPPED 行の送信結果', skippedRow[resultIdx] === 'SKIPPED', skippedRow[resultIdx]);
check('Batch ID が一致', successRow[batchIdIdx] === batchId, batchId);
check(
  'SKIPPED 行のエラー内容にスキップ理由',
  skippedRow[errorIdx] === 'メールなし',
  skippedRow[errorIdx]
);
check(
  'Sales Pilot Version が記録された',
  successRow[versionIdx] === 'v0.0.0-test',
  successRow[versionIdx]
);

// ── T-06: ensureSheet 2回目呼び出しで重複作成しない ──────────────────
console.log('\n=== T-06: ensureSheet 冪等性確認 ===');
const svc2 = new SendHistoryService({ sheetsApi, spreadsheetId });
await svc2.ensureSheet();
await svc2.ensureSheet();
const meta3 = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const count = (meta3.data.sheets ?? []).filter(
  (s) => s.properties.title === SEND_HISTORY_SHEET
).length;
check('送信履歴タブが 1つだけ存在', count === 1, `${count}タブ`);

// ── 結果 ─────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #024 実機テスト PASS' : '✗ Issue #024 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
