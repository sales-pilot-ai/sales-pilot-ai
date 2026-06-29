import { describe, it, expect } from 'vitest';
import { createPersonalizedContent } from './index.js';

function company(overrides = {}) {
  return { industry: '', memo: '', ...overrides };
}

describe('createPersonalizedContent', () => {
  it('Promise を返す', async () => {
    const result = createPersonalizedContent(company());
    expect(result).toBeInstanceOf(Promise);
  });

  it('introText を含むオブジェクトを返す', async () => {
    const result = await createPersonalizedContent(company({ industry: '美容室' }));
    expect(result).toHaveProperty('introText');
    expect(typeof result.introText).toBe('string');
    expect(result.introText.length).toBeGreaterThan(0);
  });

  it('美容業種の introText が正しい', async () => {
    const result = await createPersonalizedContent(company({ industry: '美容院' }));
    expect(result.introText).toBe('SNS集客のお手伝い');
  });

  it('飲食業種の introText が正しい', async () => {
    const result = await createPersonalizedContent(company({ industry: '飲食店' }));
    expect(result.introText).toBe('来店促進のお手伝い');
  });

  it('士業の introText が正しい', async () => {
    const result = await createPersonalizedContent(company({ industry: '税理士事務所' }));
    expect(result.introText).toBe('問い合わせ獲得のお手伝い');
  });

  it('IT 業種の introText が正しい', async () => {
    const result = await createPersonalizedContent(company({ industry: 'SaaS' }));
    expect(result.introText).toBe('リード獲得のお手伝い');
  });

  it('不明業種はフォールバックを返す', async () => {
    const result = await createPersonalizedContent(company({ industry: '不明業種' }));
    expect(result.introText).toBe('業務効率化のお手伝い');
  });
});
