import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompany } from '../models/company.js';

// ─── モック ───────────────────────────────────────────────────────────────────
// vi.mock はファイル先頭に巻き上げられるため、vi.hoisted で先行定義する

const { mockMapsFind, mockSearchFind, mockAnalyze, mockAppendCompanies } = vi.hoisted(() => ({
  mockMapsFind: vi.fn(),
  mockSearchFind: vi.fn(),
  mockAnalyze: vi.fn(),
  mockAppendCompanies: vi.fn(),
}));

vi.mock('../providers/google-maps.js', () => {
  class MockGoogleMapsProvider {
    constructor() {
      this.name = 'GoogleMaps';
      this.find = mockMapsFind;
    }
  }
  return { GoogleMapsProvider: MockGoogleMapsProvider };
});

vi.mock('../providers/google-search.js', () => {
  class MockGoogleSearchProvider {
    constructor() {
      this.name = 'GoogleSearch';
      this.find = mockSearchFind;
    }
  }
  return { GoogleSearchProvider: MockGoogleSearchProvider };
});

vi.mock('./website-analyzer.js', () => {
  class MockWebsiteAnalyzer {
    constructor() {
      this.analyze = mockAnalyze;
    }
  }
  return { WebsiteAnalyzer: MockWebsiteAnalyzer };
});

vi.mock('../sheets/index.js', () => ({
  appendCompanies: mockAppendCompanies,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn() },
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const { findCompanies, deduplicateCompanies } = await import('./find.js');

// ─── テストデータ ─────────────────────────────────────────────────────────────

const COMPANY_A = createCompany({ companyName: '株式会社A', websiteUrl: 'https://a.co.jp' });
const COMPANY_B = createCompany({ companyName: '株式会社B', websiteUrl: 'https://b.co.jp' });
const COMPANY_C = createCompany({ companyName: '株式会社C', websiteUrl: 'https://c.co.jp' });

beforeEach(() => {
  vi.clearAllMocks();
  mockMapsFind.mockResolvedValue([]);
  mockSearchFind.mockResolvedValue([]);
  mockAnalyze.mockImplementation((c) => Promise.resolve(c));
  mockAppendCompanies.mockResolvedValue(null);
});

// ─── deduplicateCompanies ─────────────────────────────────────────────────────

describe('deduplicateCompanies', () => {
  it('同じ websiteUrl を持つ企業を除去する', () => {
    const dup = createCompany({ companyName: '別名A', websiteUrl: 'https://a.co.jp' });
    const result = deduplicateCompanies([COMPANY_A, dup]);
    expect(result).toHaveLength(1);
    expect(result[0].companyName).toBe('株式会社A');
  });

  it('websiteUrl がなければ companyName でデdup する', () => {
    const c1 = createCompany({ companyName: '同名企業', websiteUrl: '' });
    const c2 = createCompany({ companyName: '同名企業', websiteUrl: '' });
    const result = deduplicateCompanies([c1, c2]);
    expect(result).toHaveLength(1);
  });

  it('websiteUrl と companyName が両方異なれば残す', () => {
    const result = deduplicateCompanies([COMPANY_A, COMPANY_B]);
    expect(result).toHaveLength(2);
  });

  it('companyName も websiteUrl も空の企業はスキップする', () => {
    const empty = createCompany({ companyName: '', websiteUrl: '' });
    expect(deduplicateCompanies([empty])).toHaveLength(0);
  });

  it('空配列は空配列を返す', () => {
    expect(deduplicateCompanies([])).toEqual([]);
  });
});

// ─── findCompanies ────────────────────────────────────────────────────────────

describe('findCompanies', () => {
  // ── Provider 結合 ────────────────────────────────────────────────────────────

  it('GoogleMapsProvider と GoogleSearchProvider を両方呼ぶ', async () => {
    await findCompanies('飲食店', '東京', { skipSheets: true });
    expect(mockMapsFind).toHaveBeenCalledOnce();
    expect(mockSearchFind).toHaveBeenCalledOnce();
  });

  it('各 Provider に industry・area・limit を渡す', async () => {
    await findCompanies('美容室', '大阪', { limit: 5, skipSheets: true });
    expect(mockMapsFind).toHaveBeenCalledWith('美容室', '大阪', 5);
    expect(mockSearchFind).toHaveBeenCalledWith('美容室', '大阪', 5);
  });

  it('両 Provider の結果をマージして返す', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    mockSearchFind.mockResolvedValue([COMPANY_B]);
    const result = await findCompanies('IT', '東京', { skipAnalyzer: true, skipSheets: true });
    expect(result).toHaveLength(2);
  });

  it('Provider がエラーを投げても残りの Provider は続行する', async () => {
    mockMapsFind.mockRejectedValue(new Error('API エラー'));
    mockSearchFind.mockResolvedValue([COMPANY_B]);
    const result = await findCompanies('IT', '東京', { skipAnalyzer: true, skipSheets: true });
    expect(result).toHaveLength(1);
    expect(result[0].companyName).toBe('株式会社B');
  });

  // ── 重複除去・件数制限 ────────────────────────────────────────────────────────

  it('両 Provider に同じ企業があれば重複を除去する', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    mockSearchFind.mockResolvedValue([COMPANY_A]); // 同じ企業
    const result = await findCompanies('IT', '東京', { skipAnalyzer: true, skipSheets: true });
    expect(result).toHaveLength(1);
  });

  it('limit を超えないようにする', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A, COMPANY_B, COMPANY_C]);
    const result = await findCompanies('IT', '東京', {
      limit: 2,
      skipAnalyzer: true,
      skipSheets: true,
    });
    expect(result).toHaveLength(2);
  });

  // ── 空結果の早期リターン ──────────────────────────────────────────────────────

  it('企業が 0 件なら空配列を返し WebsiteAnalyzer・Sheets を呼ばない', async () => {
    const result = await findCompanies('IT', '東京', { skipSheets: true });
    expect(result).toEqual([]);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  // ── WebsiteAnalyzer ──────────────────────────────────────────────────────────

  it('デフォルトで WebsiteAnalyzer を呼ぶ', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    await findCompanies('IT', '東京', { skipSheets: true });
    expect(mockAnalyze).toHaveBeenCalledOnce();
    expect(mockAnalyze).toHaveBeenCalledWith(COMPANY_A);
  });

  it('skipAnalyzer のとき WebsiteAnalyzer を呼ばない', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    await findCompanies('IT', '東京', { skipAnalyzer: true, skipSheets: true });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('WebsiteAnalyzer の補完結果をそのまま返す', async () => {
    const enriched = { ...COMPANY_A, email: 'info@a.co.jp' };
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    mockAnalyze.mockResolvedValue(enriched);
    const result = await findCompanies('IT', '東京', { skipSheets: true });
    expect(result[0].email).toBe('info@a.co.jp');
  });

  // ── Google Sheets ─────────────────────────────────────────────────────────────

  it('デフォルトで appendCompanies を呼ぶ', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    await findCompanies('IT', '東京');
    expect(mockAppendCompanies).toHaveBeenCalledOnce();
  });

  it('skipSheets のとき appendCompanies を呼ばない', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A]);
    await findCompanies('IT', '東京', { skipSheets: true });
    expect(mockAppendCompanies).not.toHaveBeenCalled();
  });

  it('appendCompanies に companies 配列を渡す', async () => {
    mockMapsFind.mockResolvedValue([COMPANY_A, COMPANY_B]);
    await findCompanies('IT', '東京', { skipAnalyzer: true });
    expect(mockAppendCompanies).toHaveBeenCalledWith([COMPANY_A, COMPANY_B]);
  });
});
