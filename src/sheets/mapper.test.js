import { describe, it, expect } from 'vitest';
import {
  HEADER_TO_FIELD,
  FIELD_TO_HEADER,
  APPROVAL_VALUE,
  PROTECTED_FIELDS,
  colIndexToLetter,
  companyToRowByHeaders,
  rowToCompanyByHeaders,
  generateDedupKey,
  formatCompanyId,
} from './mapper.js';
import { createCompany } from '../models/company.js';

// ユーザー定義のヘッダー列（テスト全体で共通: 19列）
const HEADERS = [
  '会社名', // 0  → A
  '業種', // 1  → B
  'エリア', // 2  → C
  'ホームページ', // 3  → D
  'メールアドレス', // 4  → E
  'お問い合わせフォーム', // 5  → F
  '電話番号', // 6  → G
  '住所', // 7  → H
  'メモ', // 8  → I
  '送信日', // 9  → J
  '送信可否', // 10 → K
  '送信状況', // 11 → L
  '担当者名', // 12 → M
  '最終更新', // 13 → N
  '企業ID', // 14 → O
  '返信有無', // 15 → P
  '商談日', // 16 → Q
  '成約', // 17 → R
  'Place ID', // 18 → S
];

// ─── HEADER_TO_FIELD ──────────────────────────────────────────────────────────

describe('HEADER_TO_FIELD', () => {
  it('19 個のマッピングを持つ', () => {
    expect(Object.keys(HEADER_TO_FIELD)).toHaveLength(19);
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

// ─── PROTECTED_FIELDS ─────────────────────────────────────────────────────────

describe('PROTECTED_FIELDS', () => {
  it('8 個の保護フィールドを持つ', () => {
    expect(PROTECTED_FIELDS.size).toBe(8);
  });

  it('送信可否・送信状況・送信日 が含まれる', () => {
    expect(PROTECTED_FIELDS.has('sendApproval')).toBe(true);
    expect(PROTECTED_FIELDS.has('status')).toBe(true);
    expect(PROTECTED_FIELDS.has('sentDate')).toBe(true);
  });

  it('担当者名・メモ が含まれる', () => {
    expect(PROTECTED_FIELDS.has('contactName')).toBe(true);
    expect(PROTECTED_FIELDS.has('memo')).toBe(true);
  });

  it('返信有無・商談日・成約 が含まれる', () => {
    expect(PROTECTED_FIELDS.has('hasReply')).toBe(true);
    expect(PROTECTED_FIELDS.has('meetingDate')).toBe(true);
    expect(PROTECTED_FIELDS.has('closed')).toBe(true);
  });

  it('会社名・ホームページ は含まれない（更新可能）', () => {
    expect(PROTECTED_FIELDS.has('companyName')).toBe(false);
    expect(PROTECTED_FIELDS.has('websiteUrl')).toBe(false);
  });
});

// ─── generateDedupKey ────────────────────────────────────────────────────────

describe('generateDedupKey', () => {
  it('placeId があれば "place:" プレフィックスを使う', () => {
    const company = createCompany({ placeId: 'ChIJabc123xyz' });
    expect(generateDedupKey(company)).toBe('place:ChIJabc123xyz');
  });

  it('placeId がなく websiteUrl があれば "web:" プレフィックスを使う', () => {
    const company = createCompany({ websiteUrl: 'https://www.example.com/path' });
    expect(generateDedupKey(company)).toBe('web:example.com');
  });

  it('websiteUrl の www. を除去する', () => {
    const company = createCompany({ websiteUrl: 'https://www.melt-tokyo.happytry.org/' });
    expect(generateDedupKey(company)).toBe('web:melt-tokyo.happytry.org');
  });

  it('placeId も websiteUrl もなければ "name:" プレフィックスを使う', () => {
    const company = createCompany({ companyName: '株式会社テスト', phone: '+81-3-1234-5678' });
    const key = generateDedupKey(company);
    expect(key).toMatch(/^name:/);
    expect(key).toContain('株式会社テスト');
  });

  it('placeId が優先される（websiteUrl より）', () => {
    const company = createCompany({
      placeId: 'ChIJ999',
      websiteUrl: 'https://example.com',
    });
    expect(generateDedupKey(company)).toBe('place:ChIJ999');
  });

  it('websiteUrl が優先される（name より）', () => {
    const company = createCompany({
      companyName: 'テスト',
      phone: '0312345678',
      websiteUrl: 'https://test.co.jp',
    });
    expect(generateDedupKey(company)).toBe('web:test.co.jp');
  });

  it('同じ placeId から同じキーを生成する（冪等性）', () => {
    const c1 = createCompany({ placeId: 'ChIJ1234' });
    const c2 = createCompany({ placeId: 'ChIJ1234' });
    expect(generateDedupKey(c1)).toBe(generateDedupKey(c2));
  });
});

// ─── formatCompanyId ──────────────────────────────────────────────────────────

describe('formatCompanyId', () => {
  it('1 → "000001"', () => {
    expect(formatCompanyId(1)).toBe('000001');
  });

  it('42 → "000042"', () => {
    expect(formatCompanyId(42)).toBe('000042');
  });

  it('999999 → "999999"（6 桁）', () => {
    expect(formatCompanyId(999999)).toBe('999999');
  });

  it('1000000 → "1000000"（7 桁以上は切り捨てしない）', () => {
    expect(formatCompanyId(1000000)).toBe('1000000');
  });

  it('常に文字列を返す', () => {
    expect(typeof formatCompanyId(1)).toBe('string');
  });
});
