import { describe, it, expect } from 'vitest';
import { detectCategory, generateIntroText } from './rules.js';

function company(overrides = {}) {
  return { industry: '', memo: '', ...overrides };
}

// ─── detectCategory ───────────────────────────────────────────────────────────

describe('detectCategory', () => {
  it('業種に「美容」が含まれるとき beauty を返す', () => {
    expect(detectCategory(company({ industry: '美容室' }))).toBe('beauty');
  });

  it('業種に「ヘアサロン」が含まれるとき beauty を返す', () => {
    expect(detectCategory(company({ industry: 'ヘアサロン' }))).toBe('beauty');
  });

  it('業種に「エステ」が含まれるとき beauty を返す', () => {
    expect(detectCategory(company({ industry: 'エステサロン' }))).toBe('beauty');
  });

  it('業種に「飲食」が含まれるとき food を返す', () => {
    expect(detectCategory(company({ industry: '飲食店' }))).toBe('food');
  });

  it('業種に「カフェ」が含まれるとき food を返す', () => {
    expect(detectCategory(company({ industry: 'カフェ・喫茶' }))).toBe('food');
  });

  it('業種に「ラーメン」が含まれるとき food を返す', () => {
    expect(detectCategory(company({ industry: 'ラーメン店' }))).toBe('food');
  });

  it('業種に「税理士」が含まれるとき legal を返す', () => {
    expect(detectCategory(company({ industry: '税理士事務所' }))).toBe('legal');
  });

  it('業種に「弁護士」が含まれるとき legal を返す', () => {
    expect(detectCategory(company({ industry: '弁護士法人' }))).toBe('legal');
  });

  it('業種に「士業」が含まれるとき legal を返す', () => {
    expect(detectCategory(company({ industry: '士業' }))).toBe('legal');
  });

  it('業種に「IT」が含まれるとき it を返す', () => {
    expect(detectCategory(company({ industry: 'IT企業' }))).toBe('it');
  });

  it('業種に「システム」が含まれるとき it を返す', () => {
    expect(detectCategory(company({ industry: 'システム開発' }))).toBe('it');
  });

  it('業種に「SaaS」が含まれるとき it を返す', () => {
    expect(detectCategory(company({ industry: 'SaaS' }))).toBe('it');
  });

  it('memo だけにキーワードがある場合も検出する', () => {
    expect(detectCategory(company({ industry: '', memo: '美容室を経営しています' }))).toBe(
      'beauty'
    );
  });

  it('一致しないとき other を返す', () => {
    expect(detectCategory(company({ industry: '建設業', memo: '' }))).toBe('other');
  });

  it('industry も memo も空のとき other を返す', () => {
    expect(detectCategory(company())).toBe('other');
  });
});

// ─── generateIntroText ────────────────────────────────────────────────────────

describe('generateIntroText', () => {
  it('美容カテゴリは「SNS集客のお手伝い」を返す', () => {
    expect(generateIntroText(company({ industry: '美容院' }))).toBe('SNS集客のお手伝い');
  });

  it('飲食カテゴリは「来店促進のお手伝い」を返す', () => {
    expect(generateIntroText(company({ industry: '飲食店' }))).toBe('来店促進のお手伝い');
  });

  it('士業カテゴリは「問い合わせ獲得のお手伝い」を返す', () => {
    expect(generateIntroText(company({ industry: '税理士事務所' }))).toBe(
      '問い合わせ獲得のお手伝い'
    );
  });

  it('IT カテゴリは「リード獲得のお手伝い」を返す', () => {
    expect(generateIntroText(company({ industry: 'システム開発' }))).toBe('リード獲得のお手伝い');
  });

  it('その他カテゴリで memo が短い場合は「〜のお手伝い」を返す', () => {
    const result = generateIntroText(company({ industry: '建設業', memo: '地域の住宅建設' }));
    expect(result).toBe('地域の住宅建設のお手伝い');
  });

  it('その他カテゴリで memo が長い場合は汎用フォールバックを返す', () => {
    const longMemo =
      '弊社は地域密着型の建設会社として長年にわたり住宅・商業施設の建設を行ってきました';
    const result = generateIntroText(company({ industry: '建設業', memo: longMemo }));
    expect(result).toBe('業務効率化のお手伝い');
  });

  it('その他カテゴリで memo が空の場合は「業務効率化のお手伝い」を返す', () => {
    expect(generateIntroText(company({ industry: '建設業' }))).toBe('業務効率化のお手伝い');
  });

  it('industry も memo も空の場合は「業務効率化のお手伝い」を返す', () => {
    expect(generateIntroText(company())).toBe('業務効率化のお手伝い');
  });
});
