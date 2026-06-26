#!/usr/bin/env node
import { program } from 'commander';
import { findCommand } from './commands/find.js';
import { sendCommand } from './commands/send.js';
import { statusCommand } from './commands/status.js';

program
  .name('sales-pilot')
  .description('営業リストの作成からメール送信までを半自動化するツール')
  .version('0.1.0');

program
  .command('find')
  .description('業種を指定して企業リストを取得し、スプレッドシートへ保存する')
  .argument('<industry>', '検索する業種（例: "IT企業 東京"）')
  .option('-l, --limit <number>', '取得件数の上限', '20')
  .action(findCommand);

program
  .command('send')
  .description('送信可否が○の企業にメールを送信する')
  .option('--dry-run', '実際には送信せず内容を確認のみ')
  .action(sendCommand);

program
  .command('status')
  .description('送付日・進行ステータスをスプレッドシートへ反映する')
  .action(statusCommand);

program.parse();
