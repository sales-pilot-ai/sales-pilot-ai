import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * 対話形式で業種・地域・取得件数を入力させる。
 * 未指定の項目だけ質問し、提供済みの項目はスキップする。
 * 確認画面は含まない（{@link confirmFindExecution} で行う）。
 *
 * @param {{
 *   defaultIndustry?: string,
 *   defaultArea?: string,
 *   defaultLimit?: number,
 * }} [defaults]
 * @returns {Promise<{ industry: string, area: string, limit: number }>}
 */
export async function promptFindOptions({
  defaultIndustry = '',
  defaultArea = '',
  defaultLimit = 20,
} = {}) {
  const questions = [];

  if (!defaultIndustry) {
    questions.push({
      type: 'input',
      name: 'industry',
      message: '業種を入力してください（例: 飲食店）:',
      validate: (v) => v.trim().length > 0 || '業種は必須です',
    });
  }

  if (!defaultArea) {
    questions.push({
      type: 'input',
      name: 'area',
      message: '地域を入力してください（例: 東京都渋谷区）:',
      validate: (v) => v.trim().length > 0 || '地域は必須です',
    });
  }

  questions.push({
    type: 'number',
    name: 'limit',
    message: '取得件数を入力してください:',
    default: defaultLimit,
    validate: (v) => (Number.isInteger(v) && v > 0) || '1以上の整数を入力してください',
  });

  const answers = await inquirer.prompt(questions);

  return {
    industry: defaultIndustry || answers.industry,
    area: defaultArea || answers.area,
    limit: answers.limit ?? defaultLimit,
  };
}

/**
 * find コマンド実行前の最終確認画面を表示する。
 * 検索条件に加え、保存先（SPREADSHEET_ID / SHEET_NAME）を表示する。
 *
 * @param {string} industry
 * @param {string} area
 * @param {number} limit
 * @param {{ skipSheets?: boolean }} [options]
 * @returns {Promise<boolean>} ユーザーが確認した場合 true
 */
export async function confirmFindExecution(industry, area, limit, { skipSheets = false } = {}) {
  const spreadsheetId = process.env.SPREADSHEET_ID || '';
  const sheetName = process.env.SHEET_NAME || '営業リスト';
  const destination = skipSheets
    ? chalk.dim('保存なし（dry-run）')
    : `${spreadsheetId ? chalk.cyan(spreadsheetId) : chalk.red('(未設定)')} / ${sheetName}`;

  console.log(chalk.cyan('\n検索条件の最終確認:'));
  console.log(`  業種     : ${chalk.bold(industry)}`);
  console.log(`  地域     : ${chalk.bold(area)}`);
  console.log(`  取得件数 : ${chalk.bold(limit)} 件`);
  console.log(`  保存先   : ${destination}\n`);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'この条件で検索を開始しますか？',
      default: true,
    },
  ]);

  return confirmed;
}
