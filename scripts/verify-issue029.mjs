/**
 * Issue #029 実機テスト — 今日のアクションリスト（follow-up）
 *
 * Usage: node scripts/verify-issue029.mjs
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
const sheetName = process.env.SHEET_NAME || '営業リスト';

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

/** 今日から n 日引いた日付を YYYY-MM-DD で返す（JST基準の簡易計算） */
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── 実装モジュールをインポート ─────────────────────────────────────────────
import { SheetsService } from '../src/sheets/service.js';

// ── T-01: 検証用のテスト企業を準備 ──────────────────────────────────────────
console.log('=== T-01: 検証用データの準備 ===');
const sheetsSvc = new SheetsService({ sheetsApi, spreadsheetId });

const headerRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${sheetName}'!1:1`,
});
const headers = (headerRes.data.values ?? [[]])[0] ?? [];
console.log(`  現在の列構成: [${headers.join(', ')}]`);

const companyIdCol = headers.indexOf('企業ID');
const companyNameCol = headers.indexOf('会社名');
const sentDateCol = headers.indexOf('送信日');
const statusCol = headers.indexOf('送信状況');
const meetingDateCol = headers.indexOf('商談日');
const closedCol = headers.indexOf('成約');
check('必要な列が存在', [companyIdCol, companyNameCol, sentDateCol, statusCol].every((i) => i >= 0));

const testCases = [
  { id: 'C999101', name: '【検証029】本日商談', meetingDate: todayStr() },
  { id: 'C999102', name: '【検証029】明日商談', meetingDate: tomorrowStr() },
  { id: 'C999103', name: '【検証029】要フォロー7日', sentDate: daysAgo(7) },
  { id: 'C999104', name: '【検証029】経過観察3日', sentDate: daysAgo(3) },
  { id: 'C999105', name: '【検証029】経過観察対象外2日', sentDate: daysAgo(2) },
  { id: 'C999106', name: '【検証029】返信済み', sentDate: daysAgo(10), status: '返信あり' },
  { id: 'C999107', name: '【検証029】成約済み', sentDate: daysAgo(10), closed: '成約' },
];

const rows = testCases.map((tc) => {
  const row = new Array(headers.length).fill('');
  row[companyNameCol] = tc.name;
  row[companyIdCol] = tc.id;
  if (tc.sentDate) row[sentDateCol] = tc.sentDate;
  if (tc.status) row[statusCol] = tc.status;
  if (tc.meetingDate && meetingDateCol >= 0) row[meetingDateCol] = tc.meetingDate;
  if (tc.closed && closedCol >= 0) row[closedCol] = tc.closed;
  return row;
});

await sheetsApi.spreadsheets.values.append({
  spreadsheetId,
  range: `'${sheetName}'!A1`,
  valueInputOption: 'RAW',
  requestBody: { values: rows },
});
check('検証用企業を追加', true, `${testCases.length}件`);

// ── T-02: getFollowUpList の分類を確認 ──────────────────────────────────────
console.log('\n=== T-02: カテゴリ分類の確認 ===');
const result = await sheetsSvc.getFollowUpList();

const idsIn = (list) => list.map((c) => c.companyId);

check('本日商談が meetingToday に分類される', idsIn(result.meetingToday).includes('C999101'));
check('明日商談が meetingTomorrow に分類される', idsIn(result.meetingTomorrow).includes('C999102'));
check('経過7日が waitingUrgent に分類される', idsIn(result.waitingUrgent).includes('C999103'));
check('経過3日が waitingWarning に分類される', idsIn(result.waitingWarning).includes('C999104'));
check(
  '経過2日はどのカテゴリにも含まれない',
  !idsIn(result.waitingUrgent).includes('C999105') &&
    !idsIn(result.waitingWarning).includes('C999105')
);
check(
  '返信済みはどのカテゴリにも含まれない',
  !idsIn(result.waitingUrgent).includes('C999106') && !idsIn(result.waitingWarning).includes('C999106')
);
check(
  '成約済みはどのカテゴリにも含まれない',
  !idsIn(result.waitingUrgent).includes('C999107') && !idsIn(result.waitingWarning).includes('C999107')
);

const urgentItem = result.waitingUrgent.find((c) => c.companyId === 'C999103');
check('waitingUrgent の actionType が FOLLOW_UP', urgentItem?.actionType === 'FOLLOW_UP');
const meetingItem = result.meetingToday.find((c) => c.companyId === 'C999101');
check('meetingToday の actionType が MEETING', meetingItem?.actionType === 'MEETING');

// ── 後片付け: 検証用に追加した行を完全に削除 ─────────────────────────────────
console.log('\n=== 後片付け ===');
const finalCompanies = await sheetsSvc.getAllCompanies();
const testIds = new Set(testCases.map((tc) => tc.id));
const rowIndexes = finalCompanies
  .filter((c) => testIds.has(c.companyId))
  .map((c) => c._rowIndex)
  .sort((a, b) => b - a);

if (rowIndexes.length) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const listSheet = (meta.data.sheets ?? []).find((s) => s.properties.title === sheetName);

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: rowIndexes.map((rowIndex) => ({
        deleteDimension: {
          range: {
            sheetId: listSheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      })),
    },
  });

  const afterCleanup = await sheetsSvc.getAllCompanies();
  check(
    '検証用企業の行を完全に削除',
    !afterCleanup.some((c) => testIds.has(c.companyId)),
    `${rowIndexes.length}件削除`
  );
} else {
  check('検証用企業の行を完全に削除', true, '(既に存在しない)');
}

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #029 実機テスト PASS' : '✗ Issue #029 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
