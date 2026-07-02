/**
 * Issue #030 実機テスト — find --review 対話的承認モード
 *
 * Places/Google Search API は叩かず、reviewCompanies() のロジックと
 * appendCompanies() による実際の Sheets 書き込みのみを検証する。
 *
 * Usage: node scripts/verify-issue030.mjs
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

// ── 実装モジュールをインポート ─────────────────────────────────────────────
import { SheetsService } from '../src/sheets/service.js';
import { reviewCompanies, formatCandidate } from '../src/cli/commands/find-review.js';

// ── T-01: reviewCompanies のロジック確認（模擬の promptDecision を注入） ────
console.log('=== T-01: reviewCompanies のロジック確認 ===');

const candidates = [
  { companyId: null, companyName: '【検証030】候補A', email: 'a@example.com' },
  { companyId: null, companyName: '【検証030】候補B', email: 'b@example.com' },
  { companyId: null, companyName: '【検証030】候補C', email: 'c@example.com' },
  { companyId: null, companyName: '【検証030】候補D', email: 'd@example.com' },
];

// y, y, q の順で答える模擬 promptDecision（3件目の判断時点で終了）
const decisions = ['y', 'y', 'q'];
let callCount = 0;
const fakePromptDecision = async (company, index, total) => {
  check(
    `formatCandidate が呼び出し可能（${index + 1}/${total}）`,
    formatCandidate(company, index, total).includes(company.companyName)
  );
  return decisions[callCount++];
};

const { approved, skippedCount, remainingCount } = await reviewCompanies(
  candidates,
  fakePromptDecision
);

check('y×2 で approved が2件になる', approved.length === 2, `${approved.length}件`);
check('スキップ件数が0件', skippedCount === 0);
check(
  'q 時点での残件数が2件（q を選んだ候補Cを含む）',
  remainingCount === 2,
  `${remainingCount}件`
);
check('promptDecision が3回だけ呼ばれる（q以降は呼ばれない）', callCount === 3);

// ── T-02: 承認企業を実際に appendCompanies で保存 ───────────────────────────
console.log('\n=== T-02: 承認企業の実書き込み ===');
const sheetsSvc = new SheetsService({ sheetsApi, spreadsheetId });

const toSave = approved.map((c, i) => ({
  ...c,
  companyId: '', // 採番は appendCompanies に任せる
  companyName: `【検証030】保存対象${i + 1}`,
  websiteUrl: `https://verify030-${i + 1}.example.com`,
}));

const result = await sheetsSvc.appendCompanies(toSave);
check('appendCompanies が承認件数分を新規追加する', result?.appended === toSave.length, `${result?.appended}件`);

const afterAppend = await sheetsSvc.getAllCompanies();
const savedIds = afterAppend
  .filter((c) => toSave.some((t) => t.websiteUrl === c.websiteUrl))
  .map((c) => c.companyId);
check('保存した企業がシートから読み取れる', savedIds.length === toSave.length, `${savedIds.length}件`);

// ── 後片付け: 検証用に追加した行を完全に削除 ─────────────────────────────────
console.log('\n=== 後片付け ===');
const finalCompanies = await sheetsSvc.getAllCompanies();
const rowIndexes = finalCompanies
  .filter((c) => toSave.some((t) => t.websiteUrl === c.websiteUrl))
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
    !afterCleanup.some((c) => toSave.some((t) => t.websiteUrl === c.websiteUrl)),
    `${rowIndexes.length}件削除`
  );
} else {
  check('検証用企業の行を完全に削除', true, '(既に存在しない)');
}

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #030 実機テスト PASS' : '✗ Issue #030 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
