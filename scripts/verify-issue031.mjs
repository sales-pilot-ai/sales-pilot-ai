/**
 * Issue #031 実機テスト — 複数テンプレート管理
 *
 * テンプレートはローカルファイルシステムのみで完結するため、Google API は使用しない。
 * 実際の templates/emails ディレクトリに対して読み書きし、最後にテスト用テンプレートを
 * 完全に削除してクリーンアップする。
 *
 * Usage: node scripts/verify-issue031.mjs
 */
import { existsSync } from 'fs';
import { resolve } from 'path';

import {
  listTemplates,
  templateExists,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
  TEMPLATES_DIR,
} from '../src/templates/manager.js';

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

const TEST_NAME = 'verify031_test';
const TEST_NAME_DUP = 'verify031_test_dup';

function cleanup() {
  for (const name of [TEST_NAME, TEST_NAME_DUP]) {
    if (templateExists(name)) {
      deleteTemplate(name);
    }
  }
}

// 前回異常終了時の残骸を先に掃除しておく
cleanup();

// ── T-01: 既存の initial_contact が自動移行されていることを確認 ─────────────
console.log('=== T-01: 既存テンプレートの自動移行確認 ===');
check(
  'templates.json が存在する（初回実行時に自動生成される）',
  existsSync(resolve(TEMPLATES_DIR, 'templates.json'))
);
check('initial_contact が登録済み', templateExists('initial_contact'));

// ── T-02: 新規テンプレートの作成 ────────────────────────────────────────────
console.log('\n=== T-02: createTemplate ===');
const created = createTemplate({
  name: TEST_NAME,
  displayName: '【検証031】テストテンプレート',
  description: '実機検証用の一時テンプレート',
  subject: '件名テスト {{companyName}}',
  textBody: '本文テスト {{companyName}} 様',
});
check('createTemplate が正しい内容を返す', created.subject === '件名テスト {{companyName}}');
check('ファイルが実際に作成される', existsSync(resolve(TEMPLATES_DIR, `${TEST_NAME}.txt`)));
check('listTemplates に含まれる', listTemplates().some((t) => t.name === TEST_NAME));

// ── T-03: 更新 ──────────────────────────────────────────────────────────────
console.log('\n=== T-03: updateTemplate ===');
const updated = updateTemplate(TEST_NAME, { subject: '更新後の件名' });
check('subject が更新される', updated.subject === '更新後の件名');
check('textBody は変更されない', updated.textBody === '本文テスト {{companyName}} 様');
check('updatedAt が変わる', updated.updatedAt !== created.updatedAt);

// ── T-04: 複製 ──────────────────────────────────────────────────────────────
console.log('\n=== T-04: duplicateTemplate ===');
const duplicated = duplicateTemplate(TEST_NAME, TEST_NAME_DUP, {
  displayName: '【検証031】複製先',
});
check('複製先に本文がコピーされる', duplicated.textBody === '本文テスト {{companyName}} 様');
check('複製先に件名がコピーされる', duplicated.subject === '更新後の件名');
check('複製元・複製先が両方存在する', templateExists(TEST_NAME) && templateExists(TEST_NAME_DUP));

// ── T-05: 削除 ──────────────────────────────────────────────────────────────
console.log('\n=== T-05: deleteTemplate ===');
deleteTemplate(TEST_NAME_DUP);
check('削除後は templateExists が false になる', !templateExists(TEST_NAME_DUP));
check('削除後はファイルも消える', !existsSync(resolve(TEMPLATES_DIR, `${TEST_NAME_DUP}.txt`)));

// ── 後片付け ─────────────────────────────────────────────────────────────────
console.log('\n=== 後片付け ===');
cleanup();
check(
  '検証用テンプレートが完全に削除された',
  !templateExists(TEST_NAME) && !templateExists(TEST_NAME_DUP)
);
check('initial_contact は影響を受けない', templateExists('initial_contact'));

// ── 結果 ──────────────────────────────────────────────────────────────────
console.log(`\n結果: ${pass} 項目 PASS / ${fail} 項目 FAIL`);
console.log(fail === 0 ? '✔ Issue #031 実機テスト PASS' : '✗ Issue #031 実機テスト FAIL');
process.exit(fail > 0 ? 1 : 0);
