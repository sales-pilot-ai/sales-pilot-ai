#!/usr/bin/env node
import { program } from 'commander';
import { configCommand } from './commands/config.js';
import { findCommand } from './commands/find.js';
import { sendCommand } from './commands/send.js';
import { statusCommand } from './commands/status.js';
import { setupCommand } from './commands/setup.js';
import { doctorCommand } from './commands/doctor.js';

program
  .name('sales-pilot')
  .description('営業リストの作成からメール送信までを半自動化するツール')
  .version('0.1.0');

program
  .command('config')
  .description('設定を対話形式で変更する（Google Sheets ID・Sheet名・Gmail送信元・Meeting URL 等）')
  .action(configCommand);

program
  .command('find')
  .description('業種・地域を指定して企業リストを取得し、スプレッドシートへ保存する')
  .option('-i, --industry <業種>', '検索する業種（例: 飲食店）')
  .option('-a, --area <地域>', '検索する地域（例: 東京都渋谷区）')
  .option('-l, --limit <件数>', '最大取得件数', '20')
  .option('--skip-analyzer', 'WebsiteAnalyzer をスキップする', false)
  .option('--dry-run', 'スプレッドシートへの保存をスキップする', false)
  .action(findCommand);

program
  .command('send')
  .description('送信可否が○の企業にメールを送信する')
  .option('--dry-run', '実際には送信せず内容を確認のみ')
  .option('--force', '送信済企業にも強制送信する')
  .action(sendCommand);

program
  .command('status')
  .description('送付日・進行ステータスをスプレッドシートへ反映する')
  .action(statusCommand);

program
  .command('setup')
  .description('.env・認証・接続・テンプレートをまとめて確認するセットアップガイド')
  .action(setupCommand);

program
  .command('doctor')
  .description('現在の環境を診断して ✅/⚠️/❌ で一覧表示する')
  .action(doctorCommand);

program.parse();
