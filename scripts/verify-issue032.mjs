/**
 * Issue #032 実機テスト — 送信プレビュー強化
 *
 * personalizer はルールベースで外部APIを呼ばないため、Google API（Sheets/Gmail）は
 * 一切使用せず、ローカルのテンプレート読み込み・プレビュー描画のみで検証する。
 *
 * Usage: node scripts/verify-issue032.mjs
 */
import { loadEmailTemplates } from '../src/cli/commands/email-builder.js';
import {
  buildPreviewItems,
  renderPreviewHeader,
  renderPreviewTable,
  renderTargetDetail,
} from '../src/cli/commands/send-preview.js';
import { listTemplates } from '../src/templates/manager.js';

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

/** console.log の出力を一時的にキャプチャして実行する */
function captureOutput(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

// ── T-01: 実テンプレートの読み込み ─────────────────────────────────────────
console.log('=== T-01: 実テンプレートの読み込み ===');
const templates = loadEmailTemplates('initial_contact');
check('テキストテンプレートが読み込める', typeof templates.textTemplate === 'string' && templates.textTemplate.length > 0);

const templateMeta = listTemplates().find((t) => t.name === 'initial_contact');
check('initial_contact のメタデータが取得できる（#031で登録済み）', !!templateMeta);

// ── T-02: buildPreviewItems の分類（対象/対象外の混在） ─────────────────────
console.log('\n=== T-02: buildPreviewItems ===');
const companies = [
  { companyId: 'C1', companyName: '【検証032】株式会社A', email: 'a@example.com', status: '' },
  { companyId: 'C2', companyName: '【検証032】株式会社B', email: '', status: '' }, // メールなし → skip
  { companyId: 'C3', companyName: '【検証032】株式会社C', email: 'c@example.com', status: '返信あり' }, // skip
];
const { targets, skips } = await buildPreviewItems(companies, templates);
check('対象1件・対象外2件に分類される', targets.length === 1 && skips.length === 2, `targets=${targets.length}, skips=${skips.length}`);
check('対象企業に件名・本文が含まれる', typeof targets[0]?.subject === 'string' && targets[0].subject.includes('株式会社A'));

// ── T-03: ヘッダー・テーブル描画にテンプレート情報が含まれる ─────────────────
console.log('\n=== T-03: プレビュー画面の描画内容 ===');
const headerOutput = captureOutput(() =>
  renderPreviewHeader({
    templateName: 'initial_contact',
    templateDisplayName: templateMeta.displayName,
    targetCount: targets.length,
    skipCount: skips.length,
  })
);
check('ヘッダーにテンプレート表示名が含まれる', headerOutput.includes(templateMeta.displayName));
check('ヘッダーにテンプレート内部名が含まれる', headerOutput.includes('initial_contact'));

const tableOutput = captureOutput(() => renderPreviewTable(targets, skips));
check('一覧に送信対象の会社名が含まれる', tableOutput.includes('株式会社A'));
check('一覧に送信対象外の会社名が含まれる', tableOutput.includes('株式会社B') && tableOutput.includes('株式会社C'));

// ── T-04: 詳細画面に本文全文が含まれる（省略されない） ──────────────────────
console.log('\n=== T-04: 詳細画面 ===');
const detailOutput = captureOutput(() => renderTargetDetail(targets[0], 0, targets.length));
check('詳細画面に件名が含まれる', detailOutput.includes(targets[0].subject));
check(
  '詳細画面に本文全文が含まれる（末尾の署名部分まで）',
  detailOutput.includes(targets[0].textBody.split('\n').slice(-1)[0])
);

// ── T-05: 「今回のみ除外」表示（除外は営業リストに影響しない） ───────────────
console.log('\n=== T-05: 除外表示 ===');
const excluded = [{ company: companies[0] }];
const excludedOutput = captureOutput(() => renderPreviewTable([], skips, excluded));
check('除外セクションに会社名が含まれる', excludedOutput.includes('株式会社A'));
check('除外は営業リストに影響しない旨の注記がある', excludedOutput.includes('営業リストは変更されません'));

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #032 実機テスト PASS' : '✗ Issue #032 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
