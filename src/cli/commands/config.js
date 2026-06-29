import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../../utils/logger.js';
import { CONFIG_KEYS, CONFIG_LABELS, getAllSettings, updateSetting } from '../../config/manager.js';

const NUMERIC_KEYS = new Set(['DEFAULT_LIMIT', 'REQUEST_DELAY_MS']);

/**
 * @param {string} key
 * @param {string} currentValue
 */
async function promptNewValue(key, currentValue) {
  const isNumeric = NUMERIC_KEYS.has(key);

  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: `${CONFIG_LABELS[key]}:`,
      default: currentValue || undefined,
      validate: isNumeric
        ? (v) => {
            const n = parseInt(v, 10);
            return (Number.isInteger(n) && n > 0) || '1以上の整数を入力してください';
          }
        : undefined,
    },
  ]);

  return value;
}

export async function configCommand() {
  logger.step('設定変更（.env: インスタンス固有値 / config/settings.json: アプリ動作設定）');

  let running = true;
  while (running) {
    const current = getAllSettings();

    const choices = CONFIG_KEYS.map((key) => ({
      name: `${CONFIG_LABELS[key].padEnd(28)} : ${current[key] ? chalk.cyan(current[key]) : chalk.dim('(未設定)')}`,
      value: key,
    }));
    choices.push(new inquirer.Separator());
    choices.push({ name: '終了', value: null });

    const { key } = await inquirer.prompt([
      {
        type: 'list',
        name: 'key',
        message: '変更する設定を選択してください:',
        choices,
      },
    ]);

    if (!key) {
      running = false;
      break;
    }

    const newValue = await promptNewValue(key, current[key]);
    updateSetting(key, newValue);
    logger.success(`${CONFIG_LABELS[key]} を保存しました`);
  }

  logger.info('設定を終了しました');
}
