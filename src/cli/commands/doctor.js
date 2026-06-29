import chalk from 'chalk';
import { runAllChecks } from './diagnostics.js';

function icon(ok) {
  if (ok === true) return chalk.green('✅');
  if (ok === false) return chalk.red('❌');
  return chalk.yellow('⚠️ ');
}

function printResult(result) {
  const label = result.label.padEnd(24);
  console.log(`  ${icon(result.ok)} ${label} ${result.message}`);
}

export async function doctorCommand() {
  console.log('');
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('  Sales Pilot AI 環境診断'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');

  const checks = await runAllChecks();

  console.log(chalk.bold('.env 設定'));
  for (const r of checks.env) {
    printResult(r);
  }
  console.log('');

  console.log(chalk.bold('テンプレートファイル'));
  printResult(checks.templates);
  console.log('');

  console.log(chalk.bold('接続確認'));
  printResult(checks.auth);
  printResult(checks.sheets);
  printResult(checks.gmail);
  console.log('');

  const all = [...checks.env, checks.templates, checks.auth, checks.sheets, checks.gmail];
  const errors = all.filter((r) => r.ok === false);
  const warnings = all.filter((r) => r.ok === null);

  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  if (errors.length === 0 && warnings.length === 0) {
    console.log(chalk.green(chalk.bold('  ✅ すべての項目が正常です')));
  } else {
    if (errors.length > 0) {
      console.log(chalk.red(chalk.bold(`  ❌ ${errors.length} 件のエラーがあります`)));
    }
    if (warnings.length > 0) {
      console.log(chalk.yellow(chalk.bold(`  ⚠️  ${warnings.length} 件の注意事項があります`)));
    }
    console.log('');
    console.log('  詳細は sales-pilot setup で確認できます');
  }
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
}
