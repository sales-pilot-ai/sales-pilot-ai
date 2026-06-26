import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * 対話形式で業種・地域・取得件数を入力させ、確認画面を表示する。
 *
 * defaultIndustry / defaultArea が渡された場合、その項目の入力はスキップされる。
 * (CLI で --industry や --area が一方だけ指定された場合に対応)
 *
 * @param {{
 *   defaultIndustry?: string,
 *   defaultArea?: string,
 *   defaultLimit?: number,
 * }} [defaults]
 * @returns {Promise<{ industry: string, area: string, limit: number, confirmed: boolean }>}
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

  const industry = defaultIndustry || answers.industry;
  const area = defaultArea || answers.area;
  const limit = answers.limit ?? defaultLimit;

  console.log(chalk.cyan('\n検索条件の確認:'));
  console.log(`  業種     : ${chalk.bold(industry)}`);
  console.log(`  地域     : ${chalk.bold(area)}`);
  console.log(`  取得件数 : ${chalk.bold(limit)} 件\n`);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'この条件で検索を開始しますか？',
      default: true,
    },
  ]);

  return { industry, area, limit, confirmed };
}
