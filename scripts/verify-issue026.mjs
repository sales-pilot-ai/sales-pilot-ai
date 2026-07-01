/**
 * Issue #026 実機テスト — 営業ダッシュボード自動生成
 *
 * Usage: node scripts/verify-issue026.mjs
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
import {
  DashboardService,
  DASHBOARD_SHEET,
  DASHBOARD_COLUMNS,
  buildRepliedFormula,
  buildWaitingFormula,
  buildMeetingFormula,
  buildRepliedTitleFormula,
  buildWaitingTitleFormula,
  buildMeetingTitleFormula,
} from '../src/sheets/dashboard.js';

// ── T-01: 定数チェック ──────────────────────────────────────────────────────
console.log('=== T-01: 定数チェック ===');
check('DASHBOARD_SHEET === "営業ダッシュボード"', DASHBOARD_SHEET === '営業ダッシュボード');
check('DASHBOARD_COLUMNS が 8 列', DASHBOARD_COLUMNS.length === 8, `${DASHBOARD_COLUMNS.length}列`);
check(
  '"会社名" 列が含まれる',
  DASHBOARD_COLUMNS.some((c) => c.header === '会社名')
);
check(
  '"送信状況" 列が含まれる',
  DASHBOARD_COLUMNS.some((c) => c.header === '送信状況')
);
check(
  '"商談日" 列が含まれる',
  DASHBOARD_COLUMNS.some((c) => c.header === '商談日')
);

// ── T-02: formula builder — 返信あり ────────────────────────────────────────
console.log('\n=== T-02: formula builder — 返信あり ===');
const mockMap = new Map([
  ['companyName', 'A'],
  ['email', 'B'],
  ['phone', 'C'],
  ['status', 'D'],
  ['sentDate', 'E'],
  ['hasReply', 'F'],
  ['meetingDate', 'G'],
  ['memo', 'H'],
  ['sendApproval', 'I'],
]);

const repliedFormula = buildRepliedFormula('営業リスト', mockMap);
check('FILTER 数式が生成される', repliedFormula.startsWith('=IFERROR(FILTER('));
check('"返信あり" 条件が含まれる', repliedFormula.includes('返信あり'));
check('status 列 (D) が使われる', repliedFormula.includes('!D2:D'));

const repliedTitle = buildRepliedTitleFormula('営業リスト', mockMap);
check('タイトル数式に COUNTIF が含まれる', repliedTitle.includes('COUNTIF'));
check('タイトル数式に "返信あり" が含まれる', repliedTitle.includes('返信あり'));

// ── T-03: formula builder — 送信待ち ────────────────────────────────────────
console.log('\n=== T-03: formula builder — 送信待ち ===');
const waitingFormula = buildWaitingFormula('営業リスト', mockMap);
check('FILTER 数式が生成される', waitingFormula.startsWith('=IFERROR(FILTER('));
check('送信可否列 (I) が条件に含まれる', waitingFormula.includes('!I2:I'));
check('"未送信" 条件が含まれる', waitingFormula.includes('未送信'));
check('"送信失敗" 条件が含まれる', waitingFormula.includes('送信失敗'));

const waitingTitle = buildWaitingTitleFormula('営業リスト', mockMap);
check('タイトル数式に SUMPRODUCT が含まれる', waitingTitle.includes('SUMPRODUCT'));

// ── T-04: formula builder — 商談中 ──────────────────────────────────────────
console.log('\n=== T-04: formula builder — 商談中 ===');
const meetingFormula = buildMeetingFormula('営業リスト', mockMap);
check('FILTER 数式が生成される', meetingFormula.startsWith('=IFERROR(FILTER('));
check('商談日列 (G) が条件に含まれる', meetingFormula.includes('!G2:G'));
check('"<>\\"\\""" 条件が含まれる', meetingFormula.includes('<>""'));

const meetingTitle = buildMeetingTitleFormula('営業リスト', mockMap);
check('タイトル数式に COUNTA が含まれる', meetingTitle.includes('COUNTA'));

// ── T-05: DashboardService.createOrUpdateDashboard（タブ作成）─────────────
console.log('\n=== T-05: 営業ダッシュボードタブの作成 ===');

const meta = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const beforeTitles = (meta.data.sheets ?? []).map((s) => s.properties.title);
console.log(`  実行前タブ: [${beforeTitles.join(', ')}]`);

const dashSvc = new DashboardService({ sheetsApi, spreadsheetId });
await dashSvc.createOrUpdateDashboard();

const meta2 = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const afterTitles = (meta2.data.sheets ?? []).map((s) => s.properties.title);
check(
  '営業ダッシュボードタブが存在する',
  afterTitles.includes(DASHBOARD_SHEET),
  afterTitles.join(', ')
);

// ── T-06: セル内容の確認 ─────────────────────────────────────────────────────
console.log('\n=== T-06: セル内容の確認 ===');
const cellRes = await sheetsApi.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges: [
    `'${DASHBOARD_SHEET}'!A1`,
    `'${DASHBOARD_SHEET}'!A2`,
    `'${DASHBOARD_SHEET}'!A4`,
    `'${DASHBOARD_SHEET}'!I4`,
    `'${DASHBOARD_SHEET}'!Q4`,
    `'${DASHBOARD_SHEET}'!A5:H5`,
    `'${DASHBOARD_SHEET}'!I5:P5`,
    `'${DASHBOARD_SHEET}'!Q5:X5`,
  ],
  valueRenderOption: 'FORMULA',
});
const vals = cellRes.data.valueRanges ?? [];
const getCell = (i) => (vals[i]?.values ?? [[]])[0]?.[0] ?? '';
const getRow = (i) => (vals[i]?.values ?? [[]])[0] ?? [];

check('A1 === "営業ダッシュボード"', getCell(0) === '営業ダッシュボード', getCell(0));
check('A2 が "最終更新:" で始まる', String(getCell(1)).startsWith('最終更新:'), getCell(1));
check('A4 に "返信あり" を含む数式', String(getCell(2)).includes('返信あり'), getCell(2));
check('I4 に "送信待ち" を含む数式', String(getCell(3)).includes('送信待ち'), getCell(3));
check('Q4 に "商談中" を含む数式', String(getCell(4)).includes('商談中'), getCell(4));
check('A5:H5 が 8 列のヘッダー行', getRow(5).length === 8, getRow(5).join(' | '));
check('I5:P5 が 8 列のヘッダー行', getRow(6).length === 8, getRow(6).join(' | '));
check('Q5:X5 が 8 列のヘッダー行', getRow(7).length === 8, getRow(7).join(' | '));

// ── T-07: FILTER 数式の確認 ──────────────────────────────────────────────────
console.log('\n=== T-07: FILTER 数式の確認 ===');
const formulaRes = await sheetsApi.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges: [`'${DASHBOARD_SHEET}'!A6`, `'${DASHBOARD_SHEET}'!I6`, `'${DASHBOARD_SHEET}'!Q6`],
  valueRenderOption: 'FORMULA',
});
const formulas = formulaRes.data.valueRanges ?? [];
const getFormula = (i) => (formulas[i]?.values ?? [[]])[0]?.[0] ?? '';

check(
  'A6 に FILTER 数式が設定されている',
  String(getFormula(0)).startsWith('=IFERROR(FILTER('),
  getFormula(0).slice(0, 40)
);
check(
  'I6 に FILTER 数式が設定されている',
  String(getFormula(1)).startsWith('=IFERROR(FILTER('),
  getFormula(1).slice(0, 40)
);
check(
  'Q6 に FILTER 数式が設定されている',
  String(getFormula(2)).startsWith('=IFERROR(FILTER('),
  getFormula(2).slice(0, 40)
);

// ── T-08: 冪等性 ────────────────────────────────────────────────────────────
console.log('\n=== T-08: 冪等性確認 ===');
const dashSvc2 = new DashboardService({ sheetsApi, spreadsheetId });
await dashSvc2.createOrUpdateDashboard();
await dashSvc2.createOrUpdateDashboard();

const meta3 = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const dashTabCount = (meta3.data.sheets ?? []).filter(
  (s) => s.properties.title === DASHBOARD_SHEET
).length;
check('営業ダッシュボードタブが 1 つだけ存在', dashTabCount === 1, `${dashTabCount}タブ`);

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #026 実機テスト PASS' : '✗ Issue #026 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
