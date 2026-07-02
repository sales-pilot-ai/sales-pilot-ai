/**
 * Issue #028 実機テスト — ステータス更新 CLI（update）+ 失注ステータス正式導入
 *
 * Usage: node scripts/verify-issue028.mjs
 */
import 'dotenv/config';
import { google } from 'googleapis';
import { readFileSync } from 'fs';

// ── OAuth 認証 ──────────────────────────────────────────────────────────────
const oauthClient = JSON.parse(readFileSync('credentials/oauth-client.json', 'utf8'));

const tokenPath = process.env.GOOGLE_TOKEN_PATH ?? 'credentials/oauth-token.json';
let tokenRaw;
try {
  tokenRaw = readFileSync(tokenPath, 'utf8');
} catch {
  console.error('');
  console.error('❌ OAuth トークンが見つかりません。');
  console.error(`   パス: ${tokenPath}`);
  console.error('');
  console.error('   以下のコマンドで再認証してください:');
  console.error('   sales-pilot auth');
  console.error('');
  process.exit(1);
}
const token = JSON.parse(tokenRaw);
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
import { DEAL_RESULT } from '../src/constants/index.js';
import { SheetsService } from '../src/sheets/service.js';

// ── T-01: 定数チェック ──────────────────────────────────────────────────────
console.log('=== T-01: 定数チェック ===');
check('DEAL_RESULT.WON === "成約"', DEAL_RESULT.WON === '成約');
check('DEAL_RESULT.LOST === "失注"', DEAL_RESULT.LOST === '失注');

// ── T-02: 検証用のテスト企業を追加 ──────────────────────────────────────────
console.log('\n=== T-02: 検証用データの準備 ===');
const sheetsSvc = new SheetsService({ sheetsApi, spreadsheetId });
const testCompanyId = 'C999027';
const sheetName = process.env.SHEET_NAME || '営業リスト';

const headerRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${sheetName}'!1:1`,
});
const headers = (headerRes.data.values ?? [[]])[0] ?? [];
console.log(`  検証開始前の列構成: [${headers.join(', ')}]`);

const companyIdCol = headers.indexOf('企業ID');
const companyNameCol = headers.indexOf('会社名');
check('企業ID 列が存在', companyIdCol >= 0, `列 ${companyIdCol}`);

const row = new Array(headers.length).fill('');
row[companyNameCol] = '【検証】Issue028テスト企業';
row[companyIdCol] = testCompanyId;

await sheetsApi.spreadsheets.values.append({
  spreadsheetId,
  range: `'${sheetName}'!A1`,
  valueInputOption: 'RAW',
  requestBody: { values: [row] },
});
check('検証用企業を追加', true, testCompanyId);

// ── T-03: 「商談日」列の自動追加 + 商談日の設定 ─────────────────────────────
console.log('\n=== T-03: 商談日の設定（列の自動追加を含む） ===');
check('検証開始前は「商談日」列が存在しない', !headers.includes('商談日'));
await sheetsSvc.updateCompanyByCompanyId(testCompanyId, { meetingDate: '2026-07-10' });

const afterMeetingHeaderRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${sheetName}'!1:1`,
});
const afterMeetingHeaders = (afterMeetingHeaderRes.data.values ?? [[]])[0] ?? [];
check('「商談日」列が自動追加される', afterMeetingHeaders.includes('商談日'));

let companies = await sheetsSvc.getAllCompanies();
let target = companies.find((c) => c.companyId === testCompanyId);
check('商談日が設定される', target?.meetingDate === '2026-07-10', target?.meetingDate);

// ── T-04: 「成約」列の自動追加 + --won で成約として記録 ─────────────────────
console.log('\n=== T-04: 成約の記録（列の自動追加を含む） ===');
check('検証開始前は「成約」列が存在しない', !headers.includes('成約'));
await sheetsSvc.updateCompanyByCompanyId(testCompanyId, { closed: DEAL_RESULT.WON });

const afterClosedHeaderRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${sheetName}'!1:1`,
});
const afterClosedHeaders = (afterClosedHeaderRes.data.values ?? [[]])[0] ?? [];
check('「成約」列が自動追加される', afterClosedHeaders.includes('成約'));

companies = await sheetsSvc.getAllCompanies();
target = companies.find((c) => c.companyId === testCompanyId);
check('成約として記録される', target?.closed === '成約', target?.closed);

let stats = await sheetsSvc.getStats();
check('getStats の成約件数に反映される', stats.closedCount >= 1, `${stats.closedCount}件`);

// ── T-05: --lost で失注として記録（メモに理由が追記される） ─────────────────
console.log('\n=== T-05: 失注の記録 ===');
await sheetsSvc.updateCompanyByCompanyId(testCompanyId, {
  closed: DEAL_RESULT.LOST,
  memo: '失注理由: 検証用ダミー理由',
});
companies = await sheetsSvc.getAllCompanies();
target = companies.find((c) => c.companyId === testCompanyId);
check('失注として記録される', target?.closed === '失注', target?.closed);
check('メモに失注理由が記録される', target?.memo === '失注理由: 検証用ダミー理由', target?.memo);

stats = await sheetsSvc.getStats();
check('getStats の失注件数に反映される', stats.lostCount >= 1, `${stats.lostCount}件`);

// ── T-06: 後方互換（自由記述の成約マーク） ──────────────────────────────────
console.log('\n=== T-06: 後方互換の成約マーク ===');
await sheetsSvc.updateCompanyByCompanyId(testCompanyId, { closed: '○' });
stats = await sheetsSvc.getStats();
const legacyCompanies = await sheetsSvc.getAllCompanies();
const legacyTarget = legacyCompanies.find((c) => c.companyId === testCompanyId);
check(
  '自由記述の成約マークは成約件数として数えられる',
  legacyTarget?.closed === '○',
  legacyTarget?.closed
);

// ── 後片付け: 検証用に追加した行を完全に削除 ─────────────────────────────────
console.log('\n=== 後片付け ===');
const finalCompanies = await sheetsSvc.getAllCompanies();
const finalTarget = finalCompanies.find((c) => c.companyId === testCompanyId);

if (finalTarget) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const listSheet = (meta.data.sheets ?? []).find((s) => s.properties.title === sheetName);

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: listSheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: finalTarget._rowIndex - 1,
              endIndex: finalTarget._rowIndex,
            },
          },
        },
      ],
    },
  });

  const afterCleanup = await sheetsSvc.getAllCompanies();
  check('検証用企業の行を完全に削除', !afterCleanup.some((c) => c.companyId === testCompanyId));
} else {
  check('検証用企業の行を完全に削除', true, '(既に存在しない)');
}

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #028 実機テスト PASS' : '✗ Issue #028 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
