import chalk from 'chalk';
import inquirer from 'inquirer';
import { buildEmailContent } from './email-builder.js';
import { shouldSkip } from './send-filter.js';

const BODY_PREVIEW_LINES = 5;
const COL_WIDTH = 56;

/**
 * 送信対象と送信対象外に分類し、対象企業のメール内容を構築する。
 *
 * @param {import('../../models/company.js').Company[]} companies
 * @param {{ textTemplate: string, htmlTemplate: string|null, subjectTemplate: string|null }} templates
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{
 *   targets: Array<{ company: object, subject: string, textBody: string }>,
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

/**
 * @param {Array<{ company: object, subject: string, textBody: string }>} targets
 * @param {Array<{ company: object, reason: string }>} skips
 */
export function renderPreview(targets, skips) {
  const SEP = chalk.dim('═'.repeat(COL_WIDTH));
  const LINE = chalk.dim('─'.repeat(COL_WIDTH));

  console.log('\n' + SEP);
  console.log(chalk.bold(' 送信プレビュー'));
  console.log(SEP);

  // ── 送信対象 ──────────────────────────────────────────
  console.log(
    '\n' + chalk.green(`──── 送信対象 ${targets.length}件`) + chalk.dim(' ' + '─'.repeat(38))
  );

  if (targets.length === 0) {
    console.log(chalk.dim('  （送信対象なし）'));
  } else {
    for (let i = 0; i < targets.length; i++) {
      const { company, subject, textBody } = targets[i];
      const id = chalk.dim(company.companyId || '(ID なし)');
      const name = chalk.bold(company.companyName || '(会社名なし)');
      const email = chalk.cyan(company.email);

      console.log(`\n[${i + 1}] ${id}  ${name}`);
      console.log(`    ${email}`);
      console.log(`    件名: ${subject}`);
      console.log(chalk.dim('    ┌─────────────────────────────────────────'));

      const lines = textBody.split('\n');
      const previewLines = lines.slice(0, BODY_PREVIEW_LINES);
      for (const line of previewLines) {
        console.log(chalk.dim('    │ ') + line);
      }
      if (lines.length > BODY_PREVIEW_LINES) {
        console.log(chalk.dim(`    │ …（全${lines.length}行）`));
      }
      console.log(chalk.dim('    └─────────────────────────────────────────'));
    }
  }

  // ── 送信対象外 ────────────────────────────────────────
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

  // ── フッター ──────────────────────────────────────────
  const skipNote = skips.length > 0 ? `  送信対象外: ${chalk.yellow(String(skips.length))}件` : '';
  console.log('\n' + LINE);
  console.log(`  送信対象: ${chalk.green.bold(String(targets.length))}件${skipNote}`);
  console.log(LINE + '\n');
}

/**
 * @returns {Promise<boolean>}
 */
export async function confirmSend() {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: '送信を実行しますか？',
      default: true,
    },
  ]);
  return confirmed;
}

/**
 * プレビュー画面を表示して最終確認を取る。
 * 送信対象が 0 件の場合は確認なしで false を返す。
 *
 * @param {import('../../models/company.js').Company[]} companies
 * @param {{ textTemplate: string, htmlTemplate: string|null, subjectTemplate: string|null }} templates
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<boolean>} 送信を続行する場合 true
 */
export async function runPreview(companies, templates, { force = false } = {}) {
  const { targets, skips } = await buildPreviewItems(companies, templates, { force });
  renderPreview(targets, skips);

  if (targets.length === 0) {
    return false;
  }

  return confirmSend();
}
