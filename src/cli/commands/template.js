import inquirer from 'inquirer';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
} from '../../templates/manager.js';
import { settings } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/** @returns {string} */
function getDefaultTemplateName() {
  return settings.mailer.defaultTemplate ?? '';
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function templateListCommand() {
  const defaultName = getDefaultTemplateName();
  const templates = listTemplates();

  if (!templates.length) {
    logger.info('テンプレートがまだ登録されていません（sales-pilot template create で作成できます）');
    return;
  }

  console.log('');
  for (const t of templates) {
    const marker = t.name === defaultName ? '★' : ' ';
    const defaultLabel = t.name === defaultName ? ' (default)' : '';
    console.log(`${marker} ${t.name}${defaultLabel}`);
    console.log(`    表示名  : ${t.displayName}`);
    console.log(`    説明    : ${t.description || '(なし)'}`);
    console.log(`    HTML    : ${t.hasHtml ? 'あり' : 'なし'}`);
    console.log(`    最終更新: ${t.updatedAt}`);
    console.log('');
  }
}

// ─── show ─────────────────────────────────────────────────────────────────────

/**
 * @param {string} name
 */
export async function templateShowCommand(name) {
  try {
    const t = getTemplate(name);
    const defaultLabel = name === getDefaultTemplateName() ? ' ★ (default)' : '';

    console.log('');
    console.log(`${t.name}${defaultLabel}`);
    console.log(`表示名: ${t.displayName}`);
    console.log(`説明  : ${t.description || '(なし)'}`);
    console.log('');
    console.log('--- 件名 ---');
    console.log(t.subject || '(未設定)');
    console.log('');
    console.log('--- 本文（テキスト） ---');
    console.log(t.textBody);
    if (t.htmlBody) {
      console.log('');
      console.log('--- 本文（HTML） ---');
      console.log(t.htmlBody);
    }
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function templateCreateCommand() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'テンプレート名（英数字・アンダースコア。例: second_follow_up）:',
        validate: (v) => v.trim().length > 0 || 'テンプレート名は必須です',
      },
      {
        type: 'input',
        name: 'displayName',
        message: '表示名（例: 2回目フォロー）:',
        validate: (v) => v.trim().length > 0 || '表示名は必須です',
      },
      {
        type: 'input',
        name: 'description',
        message: '説明（任意）:',
      },
      {
        type: 'input',
        name: 'subject',
        message: '件名:',
        validate: (v) => v.trim().length > 0 || '件名は必須です',
      },
      {
        type: 'editor',
        name: 'textBody',
        message: '本文（テキスト）をエディタで入力してください:',
      },
      {
        type: 'confirm',
        name: 'wantsHtml',
        message: 'HTML版も作成しますか？',
        default: false,
      },
    ]);

    let htmlBody = null;
    if (answers.wantsHtml) {
      const { htmlBody: html } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'htmlBody',
          message: '本文（HTML）をエディタで入力してください:',
        },
      ]);
      htmlBody = html;
    }

    const created = createTemplate({
      name: answers.name,
      displayName: answers.displayName,
      description: answers.description,
      subject: answers.subject,
      textBody: answers.textBody,
      htmlBody,
    });

    logger.success(`テンプレート「${created.name}」を作成しました`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}

// ─── edit ─────────────────────────────────────────────────────────────────────

const EDIT_FIELDS = Object.freeze([
  { value: 'displayName', label: '表示名' },
  { value: 'description', label: '説明' },
  { value: 'subject', label: '件名' },
  { value: 'textBody', label: '本文（テキスト）' },
  { value: 'htmlBody', label: '本文（HTML）' },
]);

/**
 * @param {string} name
 */
export async function templateEditCommand(name) {
  let current;
  try {
    current = getTemplate(name);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
    return;
  }

  let running = true;
  while (running) {
    const choices = EDIT_FIELDS.map((f) => ({ name: f.label, value: f.value }));
    choices.push(new inquirer.Separator());
    choices.push({ name: '終了', value: null });

    const { field } = await inquirer.prompt([
      { type: 'list', name: 'field', message: '編集する項目を選択してください:', choices },
    ]);

    if (!field) {
      running = false;
      break;
    }

    const updates = {};
    if (field === 'displayName' || field === 'description' || field === 'subject') {
      const { value } = await inquirer.prompt([
        { type: 'input', name: 'value', message: `${EDIT_FIELDS.find((f) => f.value === field).label}:`, default: current[field] },
      ]);
      updates[field] = value;
    } else {
      const { value } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'value',
          message: `${EDIT_FIELDS.find((f) => f.value === field).label}をエディタで編集してください:`,
          default: current[field] ?? '',
        },
      ]);
      updates[field] = value;
    }

    current = updateTemplate(name, updates);
    logger.success(`${EDIT_FIELDS.find((f) => f.value === field).label}を更新しました`);
  }
}

// ─── duplicate ────────────────────────────────────────────────────────────────

/**
 * @param {string} sourceName
 * @param {string} newName
 */
export async function templateDuplicateCommand(sourceName, newName) {
  try {
    const source = getTemplate(sourceName);
    const { displayName, description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'displayName',
        message: '表示名:',
        default: `${source.displayName}のコピー`,
      },
      {
        type: 'input',
        name: 'description',
        message: '説明（任意）:',
        default: source.description,
      },
    ]);

    const created = duplicateTemplate(sourceName, newName, { displayName, description });
    logger.success(`「${sourceName}」を「${created.name}」として複製しました`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}

// ─── delete ───────────────────────────────────────────────────────────────────

/**
 * @param {string} name
 */
export async function templateDeleteCommand(name) {
  try {
    getTemplate(name); // 存在確認（見つからなければ例外）

    if (name === getDefaultTemplateName()) {
      logger.error(
        `「${name}」は現在のデフォルトテンプレートのため削除できません。` +
          '先に sales-pilot config でデフォルトを変更してください'
      );
      process.exit(1);
      return;
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `テンプレート「${name}」を削除します。よろしいですか？（元に戻せません）`,
        default: false,
      },
    ]);

    if (!confirmed) {
      logger.info('キャンセルしました');
      return;
    }

    deleteTemplate(name);
    logger.success(`テンプレート「${name}」を削除しました`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}
