import { test, expect } from '@playwright/test';
import { createCompany } from '../../src/models/company.js';
import { WebsiteAnalyzer } from '../../src/crawler/website-analyzer.js';

// Phase 2 実装後に有効化する E2E テスト群
// 実際のブラウザを使って WebsiteAnalyzer の動作を確認する

test.skip('example.com — mailto リンクからメールアドレスを取得できる', async ({ page }) => {
  const company = createCompany({
    companyName: 'Example Domain',
    websiteUrl: 'https://example.com',
  });
  const analyzer = new WebsiteAnalyzer({ headless: true });
  const result = await analyzer.analyzePage(company, page);
  // example.com にメールはないため email は ''
  expect(result.companyName).toBe('Example Domain');
});

test.skip('Instagram リンクを持つサイトから SNS URL を取得できる', async ({ page }) => {
  const company = createCompany({
    companyName: 'テスト企業',
    websiteUrl: 'https://example.co.jp', // 実在するテスト用 URL に差し替える
  });
  const analyzer = new WebsiteAnalyzer({ headless: true });
  const result = await analyzer.analyzePage(company, page);
  expect(result.instagram).toMatch(/instagram\.com\//);
});

test.skip('コンタクトページへのナビゲーションで email を補完できる', async ({ page }) => {
  const company = createCompany({
    companyName: 'テスト企業',
    websiteUrl: 'https://example.co.jp', // 実在するテスト用 URL に差し替える
  });
  const analyzer = new WebsiteAnalyzer({ headless: true, visitContactPage: true });
  const result = await analyzer.analyzePage(company, page);
  expect(result.email).toMatch(/@/);
});
