import inquirer from 'inquirer';

/**
 * 1社分の表示ブロックを組み立てる（純粋関数）。
 * @param {import('../../models/company.js').Company} company
 * @param {number} index  0-based
 * @param {number} total
 * @returns {string}
 */
export function formatCandidate(company, index, total) {
  return [
    `[${index + 1}/${total}]`,
    `会社名: ${company.companyName ?? ''}`,
    `メール: ${company.email ?? ''}`,
    `URL: ${company.websiteUrl ?? ''}`,
    `住所: ${company.location ?? ''}`,
    `電話: ${company.phone ?? ''}`,
    `業種: ${company.industry ?? ''}`,
  ].join('\n');
}

/**
 * 1社分の候補を表示して y/n/q の判断を尋ねる（唯一 I/O を行う関数）。
 * @param {import('../../models/company.js').Company} company
 * @param {number} index  0-based
 * @param {number} total
 * @returns {Promise<'y' | 'n' | 'q'>}
 */
export async function promptReviewDecision(company, index, total) {
  console.log('\n' + formatCandidate(company, index, total));

  const { decision } = await inquirer.prompt([
    {
      type: 'expand',
      name: 'decision',
      message: '操作を選択してください',
      default: 0,
      choices: [
        { key: 'y', name: '保存', value: 'y' },
        { key: 'n', name: 'スキップ', value: 'n' },
        { key: 'q', name: '終了', value: 'q' },
      ],
    },
  ]);

  return decision;
}

/**
 * 企業一覧を1社ずつレビューし、y/n/q の判断を集計する純粋関数。
 * promptDecision を注入する設計のため、実際のキー入力なしにテストできる。
 * q で終了した場合、それまでに y と判断した企業は approved に残る。
 *
 * @param {import('../../models/company.js').Company[]} companies
 * @param {(company: object, index: number, total: number) => Promise<'y'|'n'|'q'>} promptDecision
 * @returns {Promise<{
 *   approved: import('../../models/company.js').Company[],
 *   skippedCount: number,
 *   remainingCount: number,
 * }>}
 */
export async function reviewCompanies(companies, promptDecision) {
  const approved = [];
  let skippedCount = 0;

  for (let i = 0; i < companies.length; i++) {
    const decision = await promptDecision(companies[i], i, companies.length);

    if (decision === 'q') {
      return { approved, skippedCount, remainingCount: companies.length - i };
    }
    if (decision === 'y') {
      approved.push(companies[i]);
    } else {
      skippedCount++;
    }
  }

  return { approved, skippedCount, remainingCount: 0 };
}

/**
 * レビュー結果のサマリーを表示する。
 * @param {{ addedCount: number, mergedCount: number, skippedCount: number, remainingCount: number }} summary
 */
export function printReviewSummary({ addedCount, mergedCount, skippedCount, remainingCount }) {
  const line = '━'.repeat(24);
  console.log('\n' + line);
  console.log('レビュー完了');
  console.log('');
  console.log(`追加件数    : ${addedCount}件`);
  console.log(`重複更新件数: ${mergedCount}件`);
  console.log(`スキップ件数: ${skippedCount}件`);
  console.log(`残件数      : ${remainingCount}件`);
  console.log(line);
}
