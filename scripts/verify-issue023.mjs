/**
 * Issue #023 実機テスト — メールプレビュー・送信確認画面
 *
 * Usage: node scripts/verify-issue023.mjs
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

// ── シートから承認済み企業を取得 ─────────────────────────────────────────────
const spreadsheetId = process.env.SPREADSHEET_ID;
const sheetName = process.env.SHEET_NAME || '営業リスト';

const res = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range: sheetName });
const rows = res.data.values ?? [];
const headers = rows[0] ?? [];
const dataRows = rows.slice(1);

const idx = (name) => headers.indexOf(name);
const H = {
  name: idx('会社名'),
  id: idx('企業ID'),
  email: idx('メールアドレス'),
  approval: idx('送信可否'),
  status: idx('送信状況'),
};

const approvedCompanies = dataRows
  .filter((r) => (r[H.approval] ?? '') === '○')
  .map((r) => ({
    companyId: r[H.id] ?? '',
    companyName: r[H.name] ?? '',
    email: r[H.email] ?? '',
    status: r[H.status] ?? '',
  }));

console.log(`シート取得完了: ${dataRows.length}行 / 送信可否○: ${approvedCompanies.length}件\n`);

// ── email-builder と send-preview を直接インポートして検証 ─────────────────
import { buildEmailContent, loadEmailTemplates, buildTextSignature } from '../src/cli/commands/email-builder.js';
import { buildPreviewItems, renderPreview } from '../src/cli/commands/send-preview.js';

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

// ── T-01: buildTextSignature が署名を返す ──────────────────────────────────
console.log('=== T-01: buildTextSignature ===');
const sig = buildTextSignature();
check('署名が "--" を含む', sig.startsWith('--'), sig.split('\n')[0]);

// ── T-02: loadEmailTemplates がテンプレートを読み込む ─────────────────────
console.log('\n=== T-02: loadEmailTemplates ===');
let templates;
try {
  templates = loadEmailTemplates('initial_contact');
  check('textTemplate を読み込んだ', typeof templates.textTemplate === 'string' && templates.textTemplate.length > 0);
  check('htmlTemplate を読み込んだ（または null）', templates.htmlTemplate === null || typeof templates.htmlTemplate === 'string');
} catch (e) {
  check('loadEmailTemplates 失敗', false, e.message);
  process.exit(1);
}

// ── T-03: buildEmailContent がメール内容を構築する ──────────────────────────
console.log('\n=== T-03: buildEmailContent ===');
const testCompany = {
  companyId: 'C000001',
  companyName: 'テスト株式会社',
  email: 'test@example.co.jp',
  contactName: '田中',
  industry: '美容',
  status: '',
};

const content = await buildEmailContent(testCompany, templates);
check('subject が文字列', typeof content.subject === 'string' && content.subject.length > 0, content.subject);
check('textBody が文字列', typeof content.textBody === 'string' && content.textBody.length > 0);
check('textBody に署名を含む', content.textBody.includes('--'));

// ── T-04: buildPreviewItems が対象/対象外を分類する ─────────────────────────
console.log('\n=== T-04: buildPreviewItems の分類 ===');
const mixed = [
  { companyId: 'C000001', companyName: 'ターゲット', email: 'a@example.com', status: '' },
  { companyId: 'C000002', companyName: 'メールなし', email: '', status: '' },
  { companyId: 'C000003', companyName: '送信済', email: 'c@example.com', status: '送信済' },
];
const { targets, skips } = await buildPreviewItems(mixed, templates);
check('ターゲットが 1件', targets.length === 1, `${targets.length}件`);
check('スキップが 2件', skips.length === 2, `${skips.length}件`);
check('メールなしの reason', skips.find((s) => s.reason === 'メールなし') !== undefined);
check('送信済の reason', skips.find((s) => s.reason === '送信済') !== undefined);

// ── T-05: renderPreview が出力する ────────────────────────────────────────
console.log('\n=== T-05: renderPreview の出力 ===');
const logLines = [];
const origLog = console.log;
console.log = (...args) => logLines.push(args.join(' '));
renderPreview(targets, skips);
console.log = origLog;
const output = logLines.join('\n');

check('企業名が出力に含まれる', output.includes('ターゲット'));
check('メールアドレスが出力に含まれる', output.includes('a@example.com'));
check('件名が出力に含まれる', targets.length > 0 && output.includes(targets[0].subject));
check('スキップ理由 "メールなし" が出力に含まれる', output.includes('メールなし'));
check('スキップ理由 "送信済" が出力に含まれる', output.includes('送信済'));

// ── T-06: 実際の承認済み企業でプレビューを表示する ────────────────────────
if (approvedCompanies.length > 0) {
  console.log('\n=== T-06: 実際の承認済み企業でのプレビュー表示 ===');
  console.log('--- プレビュー表示（送信はしません） ---');
  const { targets: realTargets, skips: realSkips } = await buildPreviewItems(approvedCompanies, templates);
  renderPreview(realTargets, realSkips);
  check(
    '実際の承認済み企業でプレビューが生成された',
    realTargets.length + realSkips.length === approvedCompanies.length,
    `対象: ${realTargets.length}件 / 対象外: ${realSkips.length}件`
  );
} else {
  console.log('\n=== T-06: スキップ（送信可否○の企業なし） ===');
  console.log('  ℹ シートに送信可否○の企業がないため T-06 はスキップします');
}

// ── T-07: send --preview --dry-run のコマンドが動作する ──────────────────
console.log('\n=== T-07: send コマンドに --preview フラグが存在する ===');
import { execSync } from 'child_process';
const helpOutput = execSync('node src/cli/index.js send --help').toString();
check('send --help に --preview が含まれる', helpOutput.includes('--preview'));
check('send --help に -p が含まれる', helpOutput.includes('-p,'));

// ── 結果 ─────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #023 実機テスト PASS' : '✗ Issue #023 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
