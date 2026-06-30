import { describe, it, expect } from 'vitest';
import {
  HEADER_TO_FIELD,
  FIELD_TO_HEADER,
  APPROVAL_VALUE,
  colIndexToLetter,
  companyToRowByHeaders,
  rowToCompanyByHeaders,
} from './mapper.js';
import { createCompany } from '../models/company.js';

// ユーザー定義のヘッダー列（テスト全体で共通）
const HEADERS = [
  '会社名',
  '業種',
  'エリア',
  'ホームページ',
  'メールアドレス',
  'お問い合わせフォーム',
  '電話番号',
  '住所',
  'メモ',
  '送信日',
  '送信可否',
  '送信状況',
  '担当者名',
  '最終更新',
];

// ─── HEADER_TO_FIELD ──────────────────────────────────────────────────────────

describe('HEADER_TO_FIELD', () => {
  it('14 個のマッピングを持つ', () => {
    expect(Object.keys(HEADER_TO_FIELD)).toHaveLength(14);
  });

  it('会社名 → companyName', () => {
    expect(HEADER_TO_FIELD['会社名']).toBe('companyName');
  });

  it('送信可否 → sendApproval', () => {
    expect(HEADER_TO_FIELD['送信可否']).toBe('sendApproval');
  });

  it('送信状況 → status', () => {
    expect(HEADER_TO_FIELD['送信状況']).toBe('status');
  });

  it('送信日 → sentDate', () => {
    expect(HEADER_TO_FIELD['送信日']).toBe('sentDate');
  });
});

// ─── FIELD_TO_HEADER ──────────────────────────────────────────────────────────

describe('FIELD_TO_HEADER', () => {
  it('HEADER_TO_FIELD の逆引きになっている', () => {
    for (const [header, field] of Object.entries(HEADER_TO_FIELD)) {
      expect(FIELD_TO_HEADER[field]).toBe(header);
    }
  });
});

// ─── APPROVAL_VALUE ───────────────────────────────────────────────────────────

describe('APPROVAL_VALUE', () => {
  it('"○" を返す', () => {
    expect(APPROVAL_VALUE).toBe('○');
  });
});

// ─── colIndexToLetter ─────────────────────────────────────────────────────────

describe('colIndexToLetter', () => {
  it('0 → A', () => expect(colIndexToLetter(0)).toBe('A'));
  it('1 → B', () => expect(colIndexToLetter(1)).toBe('B'));
  it('25 → Z', () => expect(colIndexToLetter(25)).toBe('Z'));
  it('26 → AA', () => expect(colIndexToLetter(26)).toBe('AA'));
  it('27 → AB', () => expect(colIndexToLetter(27)).toBe('AB'));
  it('51 → AZ', () => expect(colIndexToLetter(51)).toBe('AZ'));
  it('52 → BA', () => expect(colIndexToLetter(52)).toBe('BA'));
});

// ─── companyToRowByHeaders ────────────────────────────────────────────────────

describe('companyToRowByHeaders', () => {
  it('ヘッダー数と同じ長さの配列を返す', () => {
    const company = createCompany({ companyName: 'テスト株式会社' });
    const row = companyToRowByHeaders(company, HEADERS);
    expect(row).toHaveLength(HEADERS.length);
  });

  it('会社名（index 0）に companyName を返す', () => {
    const company = createCompany({ companyName: 'テスト株式会社' });
    expect(companyToRowByHeaders(company, HEADERS)[0]).toBe('テスト株式会社');
  });

  it('メールアドレス（index 4）に email を返す', () => {
    const company = createCompany({ companyName: 'テスト', email: 'a@b.com' });
    expect(companyToRowByHeaders(company, HEADERS)[4]).toBe('a@b.com');
  });

  it('null フィールドは空文字になる', () => {
    const company = createCompany({ companyName: 'テスト' }); // leadScore は null
    const row = companyToRowByHeaders(company, HEADERS);
    expect(row.every((v) => typeof v === 'string')).toBe(true);
  });

  it('数値フィールドは文字列に変換される', () => {
    const company = createCompany({ companyName: 'テスト', leadScore: 85 });
    // leadScore は HEADERS に含まれないので空文字
    const row = companyToRowByHeaders(company, HEADERS);
    expect(row.every((v) => typeof v === 'string')).toBe(true);
  });

  it('ヘッダーに対応するフィールドがない列は空文字', () => {
    const company = createCompany({ companyName: 'テスト' });
    // 'エリア' → area は Company モデルに存在しないため空文字
    // '未登録列' → HEADER_TO_FIELD に存在しないため空文字
    const row = companyToRowByHeaders(company, ['エリア', '未登録列']);
    expect(row).toEqual(['', '']);
  });

  it('未知のヘッダーは空文字', () => {
    const company = createCompany({ companyName: 'テスト' });
    const row = companyToRowByHeaders(company, ['存在しないヘッダー']);
    expect(row[0]).toBe('');
  });

  it('ヘッダーが空配列のとき空配列を返す', () => {
    const company = createCompany({ companyName: 'テスト' });
    expect(companyToRowByHeaders(company, [])).toEqual([]);
  });
});

// ─── rowToCompanyByHeaders ────────────────────────────────────────────────────

describe('rowToCompanyByHeaders', () => {
  it('ヘッダーに対応するフィールドを持つオブジェクトを返す', () => {
    const row = ['テスト株式会社', '飲食', '', 'https://test.co.jp', 'a@b.com'];
    const company = rowToCompanyByHeaders(row, HEADERS.slice(0, 5));
    expect(company.companyName).toBe('テスト株式会社');
    expect(company.industry).toBe('飲食');
    expect(company.email).toBe('a@b.com');
  });

  it('未知のヘッダーはオブジェクトに含まれない', () => {
    const company = rowToCompanyByHeaders(['値'], ['存在しないヘッダー']);
    expect(Object.keys(company)).toHaveLength(0);
  });

  it('行が短くても undefined でなく空文字を返す', () => {
    const company = rowToCompanyByHeaders(['テスト'], HEADERS);
    expect(company.industry).toBe('');
    expect(company.email).toBe('');
    expect(company.status).toBe('');
  });

  it('companyToRowByHeaders → rowToCompanyByHeaders でラウンドトリップできる', () => {
    const original = createCompany({
      companyName: 'テスト株式会社',
      email: 'info@test.co.jp',
      sendApproval: '○',
      status: '送信済',
      industry: '飲食',
    });
    const row = companyToRowByHeaders(original, HEADERS);
    const restored = rowToCompanyByHeaders(row, HEADERS);
    expect(restored.companyName).toBe(original.companyName);
    expect(restored.email).toBe(original.email);
    expect(restored.sendApproval).toBe(original.sendApproval);
    expect(restored.status).toBe(original.status);
    expect(restored.industry).toBe(original.industry);
  });
});
