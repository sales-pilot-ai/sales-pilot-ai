import chalk from 'chalk';
import inquirer from 'inquirer';
import { buildEmailContent } from './email-builder.js';
import { shouldSkip } from './send-filter.js';

const COL_WIDTH = 56;
const SUBJECT_PREVIEW_LENGTH = 40;

/**
 * 送信対象と送信対象外に分類し、対象企業のメール内容を構築する。
 *
 * @param {import('../../models/company.js').Company[]} companies
 * @param {{ textTemplate: string, htmlTemplate: string|null, subjectTemplate: string|null }} templates
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{
 *   targets: Array<{ company: object, subject: string, textBody: string, htmlBody?: string }>,
 *   skips:   Array<{ company: object, reason: string }>,
 * }>}
 */
export async function buildPreviewItems(companies, templates, { force = false } = {}) {
  const targets = [];
  const skips = [];

  for (const company of companies) {
    const { skip, reason } = shouldSkip(company, { force });
    if (skip) {
      skips.push({ company, reason });
    } else {
      const content = await buildEmailContent(company, templates);
      targets.push({ company, ...content });
    }
  }

  return { targets, skips };
}

// ─── 表示 ──────────────────────────────────────────────────────────────────────

/**
 * @param {string} text
 * @param {number} length
 */
function truncate(text, length) {
  if (text.length <= length) return text;
  return text.slice(0, length - 1) + '…';
}

/**
 * @param {{ templateName: string, templateDisplayName: string, targetCount: number, skipCount: number, excludedCount?: number }} info
 */
export function renderPreviewHeader({
  templateName,
  templateDisplayName,
  targetCount,
  skipCount,
  excludedCount = 0,
}) {
  const SEP = chalk.dim('═'.repeat(COL_WIDTH));

  console.log('\n' + SEP);
  console.log(chalk.bold(' 送信プレビュー'));
  console.log(` テンプレート: ${chalk.cyan(templateDisplayName)} (${templateName})`);

  const excludedNote = excludedCount > 0 ? `  今回除外: ${chalk.yellow(excludedCount)}件` : '';
  console.log(` 送信対象: ${chalk.green.bold(targetCount)}件  対象外: ${skipCount}件${excludedNote}`);
  console.log(SEP);
}

/**
 * 送信対象・対象外・今回のみ除外した企業を一覧表示する（コンパクト表）。
 * @param {Array<{ company: object, subject: string }>} targets
 * @param {Array<{ company: object, reason: string }>} skips
 * @param {Array<{ company: object, subject: string }>} [excluded]
 */
export function renderPreviewTable(targets, skips, excluded = []) {
  console.log(
    '\n' + chalk.green(`──── 送信対象 ${targets.length}件`) + chalk.dim(' ' + '─'.repeat(38))
  );

  if (targets.length === 0) {
    console.log(chalk.dim('  （送信対象なし）'));
  } else {
    targets.forEach((target, i) => {
      const { company, subject } = target;
      const no = chalk.dim(`[${i + 1}]`);
      const id = chalk.dim(String(company.companyId || '').padEnd(8));
      const name = String(company.companyName || '(会社名なし)').padEnd(20);
      const email = chalk.cyan(String(company.email || '').padEnd(24));
      console.log(`${no} ${id} ${name} ${email} ${truncate(subject, SUBJECT_PREVIEW_LENGTH)}`);
    });
  }

  if (skips.length > 0) {
    console.log(
      '\n' + chalk.yellow(`──── 送信対象外 ${skips.length}件`) + chalk.dim(' ' + '─'.repeat(36))
    );
    for (const { company, reason } of skips) {
      const id = chalk.dim(String(company.companyId || '').padEnd(8));
      const name = String(company.companyName || '(会社名なし)').padEnd(24);
      console.log(`  ${id}  ${name}  → ${chalk.yellow(reason)}`);
    }
  }

  if (excluded.length > 0) {
    console.log(
      '\n' + chalk.yellow(`──── 今回のみ除外 ${excluded.length}件`) + chalk.dim(' ' + '─'.repeat(30))
    );
    for (const { company } of excluded) {
      const id = chalk.dim(String(company.companyId || '').padEnd(8));
      const name = String(company.companyName || '(会社名なし)').padEnd(24);
      console.log(`  ${id}  ${name}  → ${chalk.yellow('手動で除外（営業リストは変更されません）')}`);
    }
  }

  console.log('');
}

/**
 * 1社分の件名・本文全文を表示する（省略なし）。
 * @param {{ company: object, subject: string, textBody: string, htmlBody?: string }} target
 * @param {number} index  0-based
 * @param {number} total
 */
export function renderTargetDetail(target, index, total) {
  const { company, subject, textBody, htmlBody } = target;
  const LINE = chalk.dim('─'.repeat(COL_WIDTH));

  console.log('\n' + LINE);
  console.log(`[${index + 1}/${total}] ${chalk.dim(company.companyId)}  ${chalk.bold(company.companyName)}`);
  console.log(`      ${chalk.cyan(company.email)}`);
  console.log(`      件名: ${subject}`);
  console.log(`      HTML版: ${htmlBody ? 'あり' : 'なし'}`);
  console.log(LINE);
  console.log(textBody);
  console.log(LINE + '\n');
}

// ─── 対話プロンプト ─────────────────────────────────────────────────────────────

/**
 * 一覧画面での操作を選択させる。
 * @returns {Promise<'send' | 'inspect' | 'cancel'>}
 */
export async function promptPreviewAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'どうしますか？',
      choices: [
        { name: 'このまま送信する', value: 'send' },
        { name: '番号を指定して本文を確認する', value: 'inspect' },
        { name: 'キャンセル', value: 'cancel' },
      ],
    },
  ]);
  return action;
}

/**
 * 確認する企業の番号（1-based表示 → 0-basedで返す）を尋ねる。
 * @param {number} total
 * @returns {Promise<number>}
 */
export async function promptPreviewNumber(total) {
  const { number } = await inquirer.prompt([
    {
      type: 'number',
      name: 'number',
      message: `確認する番号を入力してください (1-${total}):`,
      validate: (v) => (Number.isInteger(v) && v >= 1 && v <= total) || `1〜${total}の番号を入力してください`,
    },
  ]);
  return number - 1;
}

/**
 * 本文確認画面での操作を選択させる。
 * @returns {Promise<'back' | 'exclude'>}
 */
export async function promptDetailAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'どうしますか？',
      choices: [
        { name: '一覧に戻る', value: 'back' },
        { name: 'この企業を今回の送信対象から外す', value: 'exclude' },
      ],
    },
  ]);
  return action;
}

// ─── オーケストレーション ────────────────────────────────────────────────────────

/**
 * プレビュー画面を表示して最終確認を取る。
 * 送信対象が 0 件の場合は確認なしで false を返す。
 * 本文確認画面から「今回だけ送信対象から外す」を選べる。除外は今回の送信にのみ影響し、
 * 営業リスト（送信可否等）は一切変更しない。
 *
 * @param {import('../../models/company.js').Company[]} companies
 * @param {{ textTemplate: string, htmlTemplate: string|null, subjectTemplate: string|null }} templates
 * @param {{ force?: boolean, templateName?: string, templateDisplayName?: string }} [options]
 * @returns {Promise<{ confirmed: boolean, excludedCompanyIds: string[] }>}
 */
export async function runPreview(
  companies,
  templates,
  { force = false, templateName = '', templateDisplayName = '' } = {}
) {
  const { targets: initialTargets, skips } = await buildPreviewItems(companies, templates, { force });

  if (initialTargets.length === 0) {
    renderPreviewHeader({ templateName, templateDisplayName, targetCount: 0, skipCount: skips.length });
    renderPreviewTable([], skips);
    return { confirmed: false, excludedCompanyIds: [] };
  }

  let targets = initialTargets;
  const excluded = [];

  while (true) {
    renderPreviewHeader({
      templateName,
      templateDisplayName,
      targetCount: targets.length,
      skipCount: skips.length,
      excludedCount: excluded.length,
    });
    renderPreviewTable(targets, skips, excluded);

    if (targets.length === 0) {
      return { confirmed: false, excludedCompanyIds: excluded.map((t) => t.company.companyId) };
    }

    const action = await promptPreviewAction();

    if (action === 'send') {
      return { confirmed: true, excludedCompanyIds: excluded.map((t) => t.company.companyId) };
    }
    if (action === 'cancel') {
      return { confirmed: false, excludedCompanyIds: excluded.map((t) => t.company.companyId) };
    }

    // action === 'inspect'
    const index = await promptPreviewNumber(targets.length);
    const target = targets[index];
    renderTargetDetail(target, index, targets.length);

    const detailAction = await promptDetailAction();
    if (detailAction === 'exclude') {
      targets = targets.filter((_, i) => i !== index);
      excluded.push(target);
    }
  }
}
