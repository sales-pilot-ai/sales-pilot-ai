import { describe, it, expect } from 'vitest';
import { createSearchOptions } from './search-options.js';

describe('createSearchOptions', () => {
  // ─── デフォルト値 ────────────────────────────────────────────────────────────

  it('引数なしでデフォルト値のオブジェクトを返す', () => {
    const opts = createSearchOptions();
    expect(opts).toEqual({
      // 基本条件
      industry: '',
      area: '',
      limit: 20,
      // 構造化地域
      prefecture: '',
      city: '',
      // キーワードフィルタ
      keywords: [],
      excludeKeywords: [],
      // 必須フィールドフィルタ
      websiteRequired: false,
      phoneRequired: false,
      emailRequired: false,
      contactFormRequired: false,
      // スコアフィルタ
      excludeClosed: true,
      minRating: null,
      minReviewCount: null,
      excludeChains: false,
      // 規模フィルタ
      employeeRange: { min: null, max: null },
    });
  });

  it('全フィールドを持つ', () => {
    const opts = createSearchOptions();
    const expectedKeys = [
      'industry',
      'area',
      'limit',
      'prefecture',
      'city',
      'keywords',
      'excludeKeywords',
      'websiteRequired',
      'phoneRequired',
      'emailRequired',
      'contactFormRequired',
      'excludeClosed',
      'minRating',
      'minReviewCount',
      'excludeChains',
      'employeeRange',
    ];
    for (const key of expectedKeys) {
      expect(opts, `${key} が存在しない`).toHaveProperty(key);
    }
  });

  // ─── 基本条件 ─────────────────────────────────────────────────────────────────

  it('industry と area を上書きできる', () => {
    const opts = createSearchOptions({ industry: '飲食店', area: '東京都渋谷区' });
    expect(opts.industry).toBe('飲食店');
    expect(opts.area).toBe('東京都渋谷区');
  });

  it('limit を上書きできる', () => {
    expect(createSearchOptions({ limit: 50 }).limit).toBe(50);
  });

  // ─── 構造化地域 ───────────────────────────────────────────────────────────────

  it('prefecture を設定できる', () => {
    expect(createSearchOptions({ prefecture: '東京都' }).prefecture).toBe('東京都');
  });

  it('city を設定できる', () => {
    expect(createSearchOptions({ city: '渋谷区' }).city).toBe('渋谷区');
  });

  // ─── キーワードフィルタ ──────────────────────────────────────────────────────

  it('keywords を設定できる', () => {
    const opts = createSearchOptions({ keywords: ['カフェ', 'テイクアウト'] });
    expect(opts.keywords).toEqual(['カフェ', 'テイクアウト']);
  });

  it('excludeKeywords を設定できる', () => {
    const opts = createSearchOptions({ excludeKeywords: ['チェーン', 'フランチャイズ'] });
    expect(opts.excludeKeywords).toEqual(['チェーン', 'フランチャイズ']);
  });

  it('keywords のデフォルトは空配列', () => {
    expect(createSearchOptions().keywords).toEqual([]);
  });

  it('excludeKeywords のデフォルトは空配列', () => {
    expect(createSearchOptions().excludeKeywords).toEqual([]);
  });

  // ─── 必須フィールドフィルタ ──────────────────────────────────────────────────

  it('websiteRequired を true に設定できる', () => {
    expect(createSearchOptions({ websiteRequired: true }).websiteRequired).toBe(true);
  });

  it('phoneRequired を true に設定できる', () => {
    expect(createSearchOptions({ phoneRequired: true }).phoneRequired).toBe(true);
  });

  it('emailRequired を true に設定できる', () => {
    expect(createSearchOptions({ emailRequired: true }).emailRequired).toBe(true);
  });

  it('contactFormRequired を true に設定できる', () => {
    expect(createSearchOptions({ contactFormRequired: true }).contactFormRequired).toBe(true);
  });

  // ─── スコアフィルタ ───────────────────────────────────────────────────────────

  it('excludeClosed のデフォルトは true', () => {
    expect(createSearchOptions().excludeClosed).toBe(true);
  });

  it('excludeClosed を false に設定できる', () => {
    expect(createSearchOptions({ excludeClosed: false }).excludeClosed).toBe(false);
  });

  it('minRating を設定できる', () => {
    expect(createSearchOptions({ minRating: 3.5 }).minRating).toBe(3.5);
  });

  it('minReviewCount を設定できる', () => {
    expect(createSearchOptions({ minReviewCount: 10 }).minReviewCount).toBe(10);
  });

  it('excludeChains を true に設定できる', () => {
    expect(createSearchOptions({ excludeChains: true }).excludeChains).toBe(true);
  });

  // ─── 規模フィルタ ─────────────────────────────────────────────────────────────

  it('employeeRange のデフォルトは { min: null, max: null }', () => {
    expect(createSearchOptions().employeeRange).toEqual({ min: null, max: null });
  });

  it('employeeRange.min を設定できる', () => {
    expect(createSearchOptions({ employeeRange: { min: 10 } }).employeeRange.min).toBe(10);
  });

  it('employeeRange.max を設定できる', () => {
    expect(createSearchOptions({ employeeRange: { max: 100 } }).employeeRange.max).toBe(100);
  });

  it('employeeRange.min だけ指定すると max は null を維持する', () => {
    const opts = createSearchOptions({ employeeRange: { min: 5 } });
    expect(opts.employeeRange.min).toBe(5);
    expect(opts.employeeRange.max).toBeNull();
  });

  // ─── 部分上書き ───────────────────────────────────────────────────────────────

  it('指定したフィールドのみ上書きし、残りはデフォルトを維持する', () => {
    const opts = createSearchOptions({ limit: 5, minRating: 4.0 });
    expect(opts.limit).toBe(5);
    expect(opts.minRating).toBe(4.0);
    expect(opts.industry).toBe('');
    expect(opts.websiteRequired).toBe(false);
    expect(opts.excludeClosed).toBe(true);
    expect(opts.keywords).toEqual([]);
    expect(opts.employeeRange).toEqual({ min: null, max: null });
  });
});
