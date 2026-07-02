/**
 * Issue #027 実機テスト — 営業レポート（report コマンド）
 *
 * Usage: node scripts/verify-issue027.mjs
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
import { SheetsService } from '../src/sheets/service.js';
import { reportCommand } from '../src/cli/commands/report.js';

// ── T-01: SheetsService.getStats が新しい API コールを追加していないこと ─────
console.log('=== T-01: getStats が getAllCompanies のみを呼ぶ ===');
const sheetsSvc = new SheetsService({ sheetsApi, spreadsheetId });

let apiCallCount = 0;
const originalGet = sheetsApi.spreadsheets.values.get.bind(sheetsApi.spreadsheets.values);
sheetsApi.spreadsheets.values.get = (...args) => {
  apiCallCount++;
  return originalGet(...args);
};

const stats = await sheetsSvc.getStats();
check('API コールが 1 回のみ（営業リスト読み取り）', apiCallCount === 1, `${apiCallCount}回`);

sheetsApi.spreadsheets.values.get = originalGet;

// ── T-02: getStats の返り値の形 ──────────────────────────────────────────────
console.log('\n=== T-02: getStats の返り値 ===');
check('totalCompanies が数値', typeof stats.totalCompanies === 'number', stats.totalCompanies);
check('sentCount が数値', typeof stats.sentCount === 'number', stats.sentCount);
check('sendRate が数値', typeof stats.sendRate === 'number', `${stats.sendRate}%`);
check('waitingCount が数値', typeof stats.waitingCount === 'number', stats.waitingCount);
check('repliedCount が数値', typeof stats.repliedCount === 'number', stats.repliedCount);
check('replyRate が数値', typeof stats.replyRate === 'number', `${stats.replyRate}%`);
check('meetingCount が数値', typeof stats.meetingCount === 'number', stats.meetingCount);
check('closedCount が数値', typeof stats.closedCount === 'number', stats.closedCount);
check('unsubscribedCount が数値', typeof stats.unsubscribedCount === 'number', stats.unsubscribedCount);

// ── T-03: 失注件数は常に 0（将来ステータス追加予定） ─────────────────────────
console.log('\n=== T-03: 失注件数の固定表示 ===');
check('lostCount === 0', stats.lostCount === 0, stats.lostCount);

// ── T-04: 送信率・返信率の計算式 ─────────────────────────────────────────────
console.log('\n=== T-04: 送信率・返信率の計算式 ===');
const expectedSendRate = stats.totalCompanies
  ? (stats.sentCount / stats.totalCompanies) * 100
  : 0;
check(
  '送信率 = 送信済件数 ÷ 総企業数 × 100',
  Math.abs(stats.sendRate - expectedSendRate) < 0.001,
  `${stats.sendRate.toFixed(1)}%`
);

const expectedReplyRate = stats.sentCount ? (stats.repliedCount / stats.sentCount) * 100 : 0;
check(
  '返信率 = 返信件数 ÷ 送信済件数 × 100',
  Math.abs(stats.replyRate - expectedReplyRate) < 0.001,
  `${stats.replyRate.toFixed(1)}%`
);

// ── T-05: 集計内訳の表示 ─────────────────────────────────────────────────────
console.log('\n=== T-05: 現在の営業リスト集計 ===');
console.log(`  総企業数: ${stats.totalCompanies}件`);
console.log(`  送信済件数: ${stats.sentCount}件 (送信率 ${stats.sendRate.toFixed(1)}%)`);
console.log(`  送信待ち件数: ${stats.waitingCount}件`);
console.log(`  返信件数: ${stats.repliedCount}件 (返信率 ${stats.replyRate.toFixed(1)}%)`);
console.log(`  商談中件数: ${stats.meetingCount}件`);
console.log(`  成約件数: ${stats.closedCount}件`);
console.log(`  失注件数: ${stats.lostCount}件`);
console.log(`  配信停止件数: ${stats.unsubscribedCount}件`);

// ── T-06: reportCommand が実際に CLI へ出力できること ───────────────────────
console.log('\n=== T-06: report コマンドの実行 ===');
try {
  await reportCommand();
  check('reportCommand が例外なく実行できる', true);
} catch (e) {
  check('reportCommand が例外なく実行できる', false, e.message);
}

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #027 実機テスト PASS' : '✗ Issue #027 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
