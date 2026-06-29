import chalk from 'chalk';
import { runAllChecks } from './diagnostics.js';

function icon(ok) {
  if (ok === true) return chalk.green('✅');
  if (ok === false) return chalk.red('❌');
  return chalk.yellow('⚠️ ');
}

function printSection(step, total, title) {
  console.log('');
  console.log(chalk.bold(`[${step}/${total}] ${title}`));
}

function printResult(result, indent = '  ') {
  const label = result.label.padEnd(26);
  console.log(`${indent}${icon(result.ok)} ${label} ${result.message}`);
  if (result.hint) {
    for (const line of result.hint.split('\n')) {
      console.log(`${indent}   ${chalk.gray(line.trim())}`);
    }
  }
}

export async function setupCommand() {
  console.log('');
  console.log(chalk.bold.cyan('╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║    Sales Pilot AI セットアップ確認        ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝'));

  console.log('');
  console.log(chalk.gray('設定を確認しています...'));

  const checks = await runAllChecks();
  const TOTAL = 4;

  // ─── [1] .env 必須項目 ─────────────────────────────────────────────────────
  printSection(1, TOTAL, '.env 必須項目チェック');
  for (const r of checks.env) {
    printResult(r);
  }

  // ─── [2] テンプレートファイル ──────────────────────────────────────────────
  printSection(2, TOTAL, 'メールテンプレート確認');
  printResult(checks.templates);
  if (checks.templates.details) {
    for (const d of checks.templates.details) {
      console.log(`    ${d.ok ? chalk.green('✔') : chalk.red('✖')} ${d.path}`);
    }
  }

  // ─── [3] Google 認証 ───────────────────────────────────────────────────────
  printSection(3, TOTAL, 'Google 認証確認');
  printResult(checks.auth);
  if (checks.auth.ok === false) {
    console.log('');
    console.log(chalk.gray('    【OAuth2 の場合】'));
    console.log(chalk.gray('    1. Google Cloud Console で OAuth2 クライアントを作成'));
    console.log(chalk.gray('    2. credentials/oauth-client.json に配置'));
    console.log(chalk.gray('    3. .env に GOOGLE_AUTH_TYPE=oauth を設定'));
    console.log(chalk.gray('    4. sales-pilot auth を実行してトークンを取得'));
    console.log('');
    console.log(chalk.gray('    【サービスアカウントの場合】'));
    console.log(chalk.gray('    1. Google Cloud Console でサービスアカウントを作成'));
    console.log(chalk.gray('    2. credentials/service-account.json に配置'));
    console.log(chalk.gray('    3. スプレッドシートをサービスアカウントと共有'));
  }

  // ─── [4] 接続確認 ──────────────────────────────────────────────────────────
  printSection(4, TOTAL, 'API 接続確認');
  printResult(checks.sheets);
  printResult(checks.gmail);

  // ─── サマリー ──────────────────────────────────────────────────────────────
  const all = [...checks.env, checks.templates, checks.auth, checks.sheets, checks.gmail];
  const errors = all.filter((r) => r.ok === false);
  const warnings = all.filter((r) => r.ok === null);

  console.log('');
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  if (errors.length === 0 && warnings.length === 0) {
    console.log('');
    console.log(
      chalk.green(chalk.bold('  ✅ セットアップ完了！以下のコマンドで使い始めることができます'))
    );
    console.log('');
    console.log(
      chalk.cyan('  sales-pilot find') + chalk.gray(' — 企業リストを検索してシートへ保存')
    );
    console.log(chalk.cyan('  sales-pilot send --dry-run') + chalk.gray(' — メール送信内容を確認'));
    console.log(chalk.cyan('  sales-pilot send') + chalk.gray(' — メールを一括送信'));
  } else {
    if (errors.length > 0) {
      console.log('');
      console.log(chalk.red(chalk.bold(`  ❌ ${errors.length} 件の設定が不足しています`)));
      console.log('');
      for (const r of errors) {
        console.log(chalk.red(`  • ${r.label}: ${r.message}`));
      }
    }
    if (warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow(chalk.bold(`  ⚠️  ${warnings.length} 件の省略可項目が未設定です`)));
      console.log('');
      for (const r of warnings) {
        console.log(chalk.yellow(`  • ${r.label}: ${r.message}`));
      }
    }
    console.log('');
    console.log(chalk.gray('  詳細は上記のヒントを参照してください。'));
    console.log(chalk.gray('  README.md にもセットアップ手順があります。'));
  }

  console.log('');
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
}
