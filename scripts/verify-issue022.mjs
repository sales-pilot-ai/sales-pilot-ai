/**
 * Issue #022 実機テスト — T-01〜T-09
 *
 * Usage: node scripts/verify-issue022.mjs
 */
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import 'dotenv/config';

const oauthClient = JSON.parse(readFileSync('credentials/oauth-client.json', 'utf8'));
const token = JSON.parse(readFileSync('credentials/oauth-token.json', 'utf8'));
const { client_id, client_secret } = oauthClient.installed ?? oauthClient.web;
const auth = new google.auth.OAuth2(client_id, client_secret);
auth.setCredentials(token);
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.SPREADSHEET_ID;
const sheetName = process.env.SHEET_NAME || '営業リスト';

const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
const rows = res.data.values ?? [];
if (!rows.length) { console.log('シートが空です'); process.exit(1); }

const headers = rows[0];
const companyIdIdx = headers.indexOf('企業ID');
const placeIdIdx = headers.indexOf('Place ID');
const phoneIdx = headers.indexOf('電話番号');
const nameIdx = headers.indexOf('会社名');
const dataRows = rows.slice(1);

console.log('=== ヘッダー確認 ===');
console.log(`  企業ID 列: ${companyIdIdx >= 0 ? `index ${companyIdIdx} (${String.fromCharCode(65 + companyIdIdx)}列)` : 'なし ⚠'}`);
console.log(`  Place ID 列: ${placeIdIdx >= 0 ? `index ${placeIdIdx} (${String.fromCharCode(65 + placeIdIdx)}列)` : 'なし ⚠'}`);
console.log(`  データ行数: ${dataRows.length}`);

let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) { console.log(`  ✔ ${label}${detail ? ': ' + detail : ''}`); pass++; }
  else     { console.log(`  ✗ ${label}${detail ? ': ' + detail : ''}`); fail++; }
}

// C000001 形式チェック
const cFormatRe = /^C\d{6}$/;
const ids = dataRows
  .filter(r => nameIdx >= 0 && (r[nameIdx] ?? ''))
  .map(r => companyIdIdx >= 0 ? (r[companyIdIdx] ?? '') : '');

console.log('\n=== T-01/T-07 企業ID が C000001 形式か ===');
const invalidIds = ids.filter(id => id !== '' && !cFormatRe.test(id));
check('全データ行の企業ID が C 形式', invalidIds.length === 0,
  invalidIds.length ? `非準拠: ${invalidIds.slice(0,3).join(', ')}` : `${ids.filter(i=>i).length} 件すべて OK`);

// 旧 000001 形式（プレフィックスなし純数字）が残っていないか
const oldNumericIds = ids.filter(id => /^\d+$/.test(id));
check('旧 000001 形式が残っていない', oldNumericIds.length === 0,
  oldNumericIds.length ? `残存: ${oldNumericIds.join(', ')}` : 'なし');

// place:xxx 形式が残っていないか
const oldPlaceIds = ids.filter(id => id.startsWith('place:'));
check('place:xxx 形式が残っていない', oldPlaceIds.length === 0,
  oldPlaceIds.length ? `残存: ${oldPlaceIds.join(', ')}` : 'なし');

// T-02 重複チェック（行削除後の連番ずれがないかを含む）
console.log('\n=== T-02/T-09 企業ID 重複チェック ===');
const validIds = ids.filter(id => cFormatRe.test(id));
const uniqueIds = new Set(validIds);
check('企業ID に重複がない', validIds.length === uniqueIds.size,
  validIds.length === uniqueIds.size
    ? `${validIds.length} 件すべてユニーク`
    : `全${validIds.length} / ユニーク${uniqueIds.size} → 重複あり`);

// T-04 電話番号 #ERROR! チェック
console.log('\n=== T-04 電話番号 #ERROR! チェック ===');
const errorPhones = dataRows
  .filter(r => phoneIdx >= 0 && (r[phoneIdx] ?? '').includes('#ERROR'))
  .map(r => nameIdx >= 0 ? (r[nameIdx] ?? '?') : '?');
check('電話番号に #ERROR! がない', errorPhones.length === 0,
  errorPhones.length ? `問題あり: ${errorPhones.join(', ')}` : `${dataRows.length} 件チェック済み`);

// T-07 ヘッダー構造
console.log('\n=== T-07 ヘッダー構造 ===');
check('「企業ID」列が存在する', companyIdIdx >= 0);
check('「Place ID」列が存在する', placeIdIdx >= 0);

// 企業ごとの詳細表示（最大5件）
console.log('\n=== データサンプル（最大5件）===');
for (const row of dataRows.slice(0, 5)) {
  const name = nameIdx >= 0 ? (row[nameIdx] ?? '') : '(不明)';
  const cid  = companyIdIdx >= 0 ? (row[companyIdIdx] ?? '') : '';
  const pid  = placeIdIdx >= 0 ? (row[placeIdIdx] ?? '') : '';
  const phone = phoneIdx >= 0 ? (row[phoneIdx] ?? '') : '';
  const cidOk = cid === '' || cFormatRe.test(cid);
  console.log(`  ${cidOk ? '✔' : '✗'} ${name} | 企業ID="${cid}" | Place ID="${pid}" | Tel="${phone}"`);
}
if (dataRows.length > 5) console.log(`  ... 他 ${dataRows.length - 5} 件`);

console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #022 実機テスト PASS' : '✗ Issue #022 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
