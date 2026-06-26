import { describe, it, expect } from 'vitest';
import {
  COLUMN_FIELDS,
  SHEET_RANGE,
  APPROVAL_VALUE,
  companyToRow,
  rowToCompany,
} from './mapper.js';
import { createCompany } from '../models/company.js';

// ─── COLUMN_FIELDS ────────────────────────────────────────────────────────────

describe('COLUMN_FIELDS', () => {
  it('18 列分のフィールド名を持つ', () => {
    expect(COLUMN_FIELDS).toHaveLength(18);
  });

  it('A 列（companyName）から始まる', () => {
    expect(COLUMN_FIELDS[0]).toBe('companyName');
  });

  it('Q 列（timeRexUrl）を含む', () => {
    expect(COLUMN_FIELDS[16]).toBe('timeRexUrl');
  });

  it('R 列（sendCount）で終わる', () => {
    expect(COLUMN_FIELDS[17]).toBe('sendCount');
  });

  it('全フィールドが定義済みである（undefined なし）', () => {
    expect(COLUMN_FIELDS.every((f) => typeof f === 'string')).toBe(true);
  });
});

// ─── SHEET_RANGE ──────────────────────────────────────────────────────────────

describe('SHEET_RANGE', () => {
  it('"A:R" を返す', () => {
    expect(SHEET_RANGE).toBe('A:R');
  });
});

// ─── APPROVAL_VALUE ───────────────────────────────────────────────────────────

describe('APPROVAL_VALUE', () => {
  it('"○" を返す', () => {
    expect(APPROVAL_VALUE).toBe('○');
  });
});

// ─── companyToRow ─────────────────────────────────────────────────────────────

describe('companyToRow', () => {
  it('Company を 18 要素の配列に変換する', () => {
    const company = createCompany({ companyName: 'テスト株式会社' });
    const row = companyToRow(company);
    expect(row).toHaveLength(18);
  });

  it('最初の要素が companyName になる', () => {
    const company = createCompany({ companyName: 'テスト株式会社' });
    expect(companyToRow(company)[0]).toBe('テスト株式会社');
  });

  it('null フィールドは空文字に変換される', () => {
    const company = createCompany({ companyName: 'テスト' });
    // leadScore は null がデフォルト
    const row = companyToRow(company);
    const leadScoreIndex = COLUMN_FIELDS.indexOf('leadScore');
    expect(row[leadScoreIndex]).toBe('');
  });

  it('数値フィールドは文字列に変換される', () => {
    const company = createCompany({ companyName: 'テスト', leadScore: 85 });
    const row = companyToRow(company);
    const leadScoreIndex = COLUMN_FIELDS.indexOf('leadScore');
    expect(row[leadScoreIndex]).toBe('85');
  });

  it('全フィールドが文字列になる', () => {
    const company = createCompany({
      companyName: 'テスト株式会社',
      email: 'info@test.co.jp',
      phone: '03-1234-5678',
      leadScore: 72,
    });
    const row = companyToRow(company);
    expect(row.every((v) => typeof v === 'string')).toBe(true);
  });

  it('列定義の順序通りに値が並ぶ', () => {
    const company = createCompany({
      companyName: '名前',
      contactName: '担当',
      industry: '飲食',
      email: 'a@b.com',
    });
    const row = companyToRow(company);
    expect(row[0]).toBe('名前'); // A: companyName
    expect(row[1]).toBe('担当'); // B: contactName
    expect(row[2]).toBe('飲食'); // C: industry
    expect(row[3]).toBe('a@b.com'); // D: email
  });
});

// ─── rowToCompany ─────────────────────────────────────────────────────────────

describe('rowToCompany', () => {
  it('配列を Company 相当のオブジェクトに変換する', () => {
    const row = Array(16).fill('');
    row[0] = 'テスト株式会社';
    row[3] = 'info@test.co.jp';
    const company = rowToCompany(row);
    expect(company.companyName).toBe('テスト株式会社');
    expect(company.email).toBe('info@test.co.jp');
  });

  it('18 フィールドすべてを持つ', () => {
    const row = Array(18).fill('値');
    const company = rowToCompany(row);
    expect(Object.keys(company)).toHaveLength(18);
  });

  it('短い配列でも undefined ではなく空文字を返す', () => {
    const row = ['テスト']; // companyName のみ
    const company = rowToCompany(row);
    expect(company.contactName).toBe('');
    expect(company.email).toBe('');
    expect(company.leadScore).toBe('');
    expect(company.timeRexUrl).toBe('');
    expect(company.sendCount).toBe('');
  });

  it('companyToRow → rowToCompany でラウンドトリップできる', () => {
    const original = createCompany({
      companyName: 'テスト株式会社',
      email: 'info@test.co.jp',
      sendApproval: '○',
      status: 'NEW',
      leadScore: 90,
      timeRexUrl: 'https://timerex.net/s/example',
      sendCount: 2,
    });
    const row = companyToRow(original);
    const restored = rowToCompany(row);
    expect(restored.companyName).toBe(original.companyName);
    expect(restored.email).toBe(original.email);
    expect(restored.sendApproval).toBe(original.sendApproval);
    expect(restored.leadScore).toBe('90'); // 数値→文字列になる
    expect(restored.timeRexUrl).toBe('https://timerex.net/s/example');
    expect(restored.sendCount).toBe('2'); // 数値→文字列になる
  });
});
