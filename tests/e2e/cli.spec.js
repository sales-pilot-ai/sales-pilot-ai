import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

test('CLIエントリーポイントが存在する', async () => {
  expect(existsSync(resolve('src/cli/index.js'))).toBe(true);
});

test('sales-pilot --help がusageを出力する', async () => {
  const output = execSync('node src/cli/index.js --help').toString();
  expect(output).toContain('sales-pilot');
  expect(output).toContain('find');
  expect(output).toContain('send');
  expect(output).toContain('status');
});

// Phase 2 実装後に有効化: スクレイパーの実際のブラウザ動作確認
test.skip('企業サイトからメールアドレスを抽出できる', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
});
