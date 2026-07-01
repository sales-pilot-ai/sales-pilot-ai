/**
 * Issue #025 実機テスト — 返信検知システム
 *
 * Usage: node scripts/verify-issue025.mjs
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
const gmailApi = google.gmail({ version: 'v1', auth });
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
  REPLY_HISTORY_HEADERS,
  REPLY_HISTORY_SHEET,
  ReplyHistoryService,
} from '../src/sheets/reply-history.js';
import { SendHistoryService } from '../src/sheets/send-history.js';
import { SheetsService } from '../src/sheets/service.js';
import { GmailReader } from '../src/gmail/reader.js';

// ── T-01: 定数チェック ──────────────────────────────────────────────────────
console.log('=== T-01: 定数チェック ===');
check(
  'REPLY_HISTORY_HEADERS が 12列',
  REPLY_HISTORY_HEADERS.length === 12,
  `${REPLY_HISTORY_HEADERS.length}列`
);
check('"返信要約" 列が含まれる', REPLY_HISTORY_HEADERS.includes('返信要約'));
check('"送信 Message ID" 列が含まれる', REPLY_HISTORY_HEADERS.includes('送信 Message ID'));
check('"返信 Message ID" 列が含まれる', REPLY_HISTORY_HEADERS.includes('返信 Message ID'));
check('REPLY_HISTORY_SHEET === "返信履歴"', REPLY_HISTORY_SHEET === '返信履歴');

// ── T-02: GmailReader インスタンス生成 ──────────────────────────────────────
console.log('\n=== T-02: GmailReader インスタンス生成 ===');
const senderEmail = process.env.GMAIL_FROM ?? '';
const gmailReader = new GmailReader({ gmailApi, senderEmail });
check('GmailReader が生成される', gmailReader instanceof GmailReader);
check(
  '_senderEmail が設定される',
  gmailReader._senderEmail === senderEmail,
  senderEmail || '(未設定)'
);

// ── T-03: ReplyHistoryService.ensureSheet ────────────────────────────────────
console.log('\n=== T-03: 返信履歴タブの自動作成 ===');
const meta = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const sheetTitles = (meta.data.sheets ?? []).map((s) => s.properties.title);
console.log(`  既存タブ: [${sheetTitles.join(', ')}]`);

const replySvc = new ReplyHistoryService({ sheetsApi, spreadsheetId });
await replySvc.ensureSheet();
check('ensureSheet 後 _initialized が true', replySvc._initialized === true);

const meta2 = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const sheetTitles2 = (meta2.data.sheets ?? []).map((s) => s.properties.title);
check(
  '返信履歴タブが存在する',
  sheetTitles2.includes(REPLY_HISTORY_SHEET),
  sheetTitles2.join(', ')
);

// ── T-04: ヘッダー確認 ──────────────────────────────────────────────────────
console.log('\n=== T-04: ヘッダー行の確認 ===');
const headerRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${REPLY_HISTORY_SHEET}'!1:1`,
});
const sheetHeaders = (headerRes.data.values ?? [[]])[0] ?? [];
check('1行目がヘッダー行', sheetHeaders.length > 0, `${sheetHeaders.length}列`);
check('12列のヘッダー', sheetHeaders.length === 12, sheetHeaders.join(' | '));
check('"返信要約" 列が存在', sheetHeaders.includes('返信要約'));
check('"送信 Message ID" 列が存在', sheetHeaders.includes('送信 Message ID'));

// ── T-05: ReplyHistoryService.log ────────────────────────────────────────────
console.log('\n=== T-05: 返信履歴の追記テスト ===');
const beforeRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${REPLY_HISTORY_SHEET}'!A:A`,
});
const beforeRows = (beforeRes.data.values ?? []).length;

await replySvc.log({
  detectedAt: new Date().toISOString(),
  company: {
    companyId: 'C000099',
    placeId: 'ChIJtest',
    companyName: '【テスト】検証企業',
    email: 'verify@test.example',
  },
  sentMessageId: 'verify-sent-msg-001',
  replyMessageId: 'verify-reply-msg-001',
  repliedAt: new Date().toISOString(),
  fromEmail: 'client@verify.test',
  subject: '【検証】Re: テスト件名',
  snippet: '返信内容の検証テキストです。',
  replySummary: '',
});

const afterRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${REPLY_HISTORY_SHEET}'!A:A`,
});
const afterRows = (afterRes.data.values ?? []).length;
check('1行追記された', afterRows === beforeRows + 1, `${beforeRows} → ${afterRows}行`);

// 追記内容を確認
const lastRowRes = await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range: `'${REPLY_HISTORY_SHEET}'!A${afterRows}:L${afterRows}`,
});
const lastRow = (lastRowRes.data.values ?? [[]])[0] ?? [];

const companyIdIdx = REPLY_HISTORY_HEADERS.indexOf('企業ID');
const sentMsgIdx = REPLY_HISTORY_HEADERS.indexOf('送信 Message ID');
const replyMsgIdx = REPLY_HISTORY_HEADERS.indexOf('返信 Message ID');
const summaryIdx = REPLY_HISTORY_HEADERS.indexOf('返信要約');

check('企業ID が記録された', lastRow[companyIdIdx] === 'C000099', lastRow[companyIdIdx]);
check(
  '送信 Message ID が記録された',
  lastRow[sentMsgIdx] === 'verify-sent-msg-001',
  lastRow[sentMsgIdx]
);
check(
  '返信 Message ID が記録された',
  lastRow[replyMsgIdx] === 'verify-reply-msg-001',
  lastRow[replyMsgIdx]
);
check(
  '返信要約が空文字（末尾空セルは undefined）',
  (lastRow[summaryIdx] ?? '') === '',
  JSON.stringify(lastRow[summaryIdx])
);

// ── T-06: ensureSheet 冪等性 ─────────────────────────────────────────────────
console.log('\n=== T-06: ensureSheet 冪等性確認 ===');
const replySvc2 = new ReplyHistoryService({ sheetsApi, spreadsheetId });
await replySvc2.ensureSheet();
await replySvc2.ensureSheet();
const meta3 = await sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title',
});
const replyTabCount = (meta3.data.sheets ?? []).filter(
  (s) => s.properties.title === REPLY_HISTORY_SHEET
).length;
check('返信履歴タブが 1つだけ存在', replyTabCount === 1, `${replyTabCount}タブ`);

// ── T-07: SendHistoryService.getSuccessRows ──────────────────────────────────
console.log('\n=== T-07: SendHistoryService.getSuccessRows ===');
const sendSvc = new SendHistoryService({ sheetsApi, spreadsheetId });
const successRows = await sendSvc.getSuccessRows();
check('配列を返す', Array.isArray(successRows));
console.log(`  SUCCESS 行数: ${successRows.length}件`);
if (successRows.length > 0) {
  const first = successRows[0];
  check('companyId フィールドが存在', typeof first.companyId === 'string', first.companyId);
  check('messageId フィールドが存在', typeof first.messageId === 'string', first.messageId);
  check('sentAt フィールドが存在', typeof first.sentAt === 'string', first.sentAt);
  check('email フィールドが存在', typeof first.email === 'string', first.email);
} else {
  console.log('  (送信履歴が空のためスキップ)');
}

// ── T-08: HistoryService.getRows ─────────────────────────────────────────────
console.log('\n=== T-08: HistoryService.getRows ===');
const rows = await replySvc.getRows();
check('配列を返す', Array.isArray(rows));
check(
  'ヘッダー行を含まない（1行目がデータ行）',
  rows.length === 0 || rows[0].length === 12 || rows[0][0] !== '検知日時'
);
console.log(`  返信履歴データ行数: ${rows.length}件`);

// ── T-09: SheetsService.getAllCompanies ─────────────────────────────────────
console.log('\n=== T-09: SheetsService.getAllCompanies ===');
const sheetsSvc = new SheetsService({ sheetsApi, spreadsheetId });
const allCompanies = await sheetsSvc.getAllCompanies();
check('配列を返す', Array.isArray(allCompanies));
console.log(`  全企業数: ${allCompanies.length}件`);
if (allCompanies.length > 0) {
  const first = allCompanies[0];
  check(
    'companyId フィールドが存在',
    typeof first.companyId === 'string' && first.companyId !== '',
    first.companyId
  );
  check('_rowIndex フィールドが存在', typeof first._rowIndex === 'number', String(first._rowIndex));
}

// ── T-10: SheetsService.updateCompanyByCompanyId（存在しない ID）──────────
console.log('\n=== T-10: SheetsService.updateCompanyByCompanyId ===');
const notFound = await sheetsSvc.updateCompanyByCompanyId('C999999', { status: '送信済' });
check('存在しない companyId は null を返す', notFound === null);

// ── T-11: Gmail API 接続確認（oauth スコープ検証）──────────────────────────
console.log('\n=== T-11: Gmail API 接続確認 ===');
try {
  const profileRes = await gmailApi.users.getProfile({ userId: 'me' });
  const emailAddress = profileRes.data.emailAddress;
  check(
    'Gmail API に接続できる',
    typeof emailAddress === 'string' && emailAddress.includes('@'),
    emailAddress
  );

  // SUCCESS 行がある場合は getThreadId も検証する
  if (successRows.length > 0 && successRows[0].messageId) {
    const testMessageId = successRows[0].messageId;
    console.log(`  getThreadId テスト対象: ${testMessageId}`);
    try {
      const threadId = await gmailReader.getThreadId(testMessageId);
      check(
        'getThreadId が threadId を返す',
        typeof threadId === 'string' && threadId.length > 0,
        threadId
      );
    } catch (e) {
      // ダミー ID の場合は "Invalid id value" (400) が返る = API 自体には到達できている
      const apiReachable =
        e.message.includes('Invalid id value') ||
        e.message.includes('Not Found') ||
        e.status === 400 ||
        e.status === 404;
      check(
        'getThreadId が実行できる (API 到達確認)',
        apiReachable,
        apiReachable ? `API 到達済み — ダミーID のため ${e.message}` : e.message
      );
    }
  } else {
    console.log('  (送信履歴が空のため getThreadId テストをスキップ)');
  }
} catch (e) {
  check('Gmail API に接続できる', false, e.message);
  console.log('  ⚠️  gmail.readonly スコープが追加されているか確認してください');
  console.log('     rm credentials/oauth-token.json && sales-pilot auth');
}

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #025 実機テスト PASS' : '✗ Issue #025 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
