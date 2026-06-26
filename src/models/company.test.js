import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createCompany,
  validateCompany,
  isApproved,
  updateCompany,
  SEND_APPROVAL_VALUES,
  STATUS,
  STATUS_VALUES,
} from './company.js';

afterEach(() => {
  vi.useRealTimers();
});

// ─── createCompany ────────────────────────────────────────────────────────────

describe('createCompany', () => {
  it('全フィールドが存在する', () => {
    const company = createCompany();
    const expected = [
      'id',
      'companyName',
      'contactName',
      'industry',
      'email',
      'phone',
      'websiteUrl',
      'contactFormUrl',
      'instagram',
      'tiktok',
      'location',
      'employeeCount',
      'storeCount',
      'sendApproval',
      'status',
      'sentDate',
      'reply',
      'memo',
      'leadScore',
      'timeRexUrl',
      'sendCount',
      'createdAt',
      'updatedAt',
    ];
    for (const field of expected) {
      expect(company, `${field} が存在しない`).toHaveProperty(field);
    }
  });

  it('id は UUID v4 形式', () => {
    const { id } = createCompany();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('デフォルト status は STATUS.NEW', () => {
    expect(createCompany().status).toBe(STATUS.NEW);
  });

  it('デフォルト sendApproval は ""', () => {
    expect(createCompany().sendApproval).toBe('');
  });

  it('数値フィールドのデフォルトは null', () => {
    const { employeeCount, storeCount, leadScore } = createCompany();
    expect(employeeCount).toBeNull();
    expect(storeCount).toBeNull();
    expect(leadScore).toBeNull();
  });

  it('デフォルト sendCount は 0', () => {
    expect(createCompany().sendCount).toBe(0);
  });

  it('デフォルト timeRexUrl は ""', () => {
    expect(createCompany().timeRexUrl).toBe('');
  });

  it('sentDate のデフォルトは null', () => {
    expect(createCompany().sentDate).toBeNull();
  });

  it('createdAt と updatedAt は同一の ISO 文字列（新規作成時）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const company = createCompany();
    expect(company.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(company.createdAt).toBe(company.updatedAt);
  });

  it('渡したデータでフィールドを上書きできる', () => {
    const company = createCompany({
      companyName: '株式会社テスト',
      email: 'test@example.com',
      industry: 'IT',
      employeeCount: 50,
      storeCount: 3,
      sendApproval: '○',
      status: STATUS.SENT,
      timeRexUrl: 'https://timerex.net/s/example',
      sendCount: 3,
    });
    expect(company.companyName).toBe('株式会社テスト');
    expect(company.email).toBe('test@example.com');
    expect(company.industry).toBe('IT');
    expect(company.employeeCount).toBe(50);
    expect(company.storeCount).toBe(3);
    expect(company.sendApproval).toBe('○');
    expect(company.status).toBe(STATUS.SENT);
    expect(company.timeRexUrl).toBe('https://timerex.net/s/example');
    expect(company.sendCount).toBe(3);
  });

  it('id を指定した場合はそのまま使用する', () => {
    const company = createCompany({ id: 'fixed-id' });
    expect(company.id).toBe('fixed-id');
  });

  it('createdAt を指定した場合はそのまま使用する', () => {
    const company = createCompany({ createdAt: '2020-01-01T00:00:00.000Z' });
    expect(company.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });
});

// ─── validateCompany ─────────────────────────────────────────────────────────

describe('validateCompany', () => {
  it('有効な Company はエラーなし', () => {
    const company = createCompany({
      companyName: '株式会社テスト',
      email: 'test@example.com',
      sendApproval: '○',
      status: STATUS.NEW,
      sentDate: '2024-06-01',
      employeeCount: 100,
      storeCount: 5,
      sendCount: 0,
    });
    expect(validateCompany(company)).toEqual([]);
  });

  it('companyName が空文字でエラー', () => {
    const errors = validateCompany(createCompany({ companyName: '' }));
    expect(errors.some((e) => e.field === 'companyName')).toBe(true);
  });

  it('companyName が空白のみでエラー', () => {
    const errors = validateCompany(createCompany({ companyName: '   ' }));
    expect(errors.some((e) => e.field === 'companyName')).toBe(true);
  });

  it('不正なメールアドレスでエラー', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', email: 'not-an-email' }));
    expect(errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('email が空文字の場合はエラーなし', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', email: '' }));
    expect(errors.every((e) => e.field !== 'email')).toBe(true);
  });

  it('不正な sendApproval でエラー', () => {
    const company = { ...createCompany({ companyName: 'テスト' }), sendApproval: '△' };
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'sendApproval')).toBe(true);
  });

  it('不正な status でエラー', () => {
    const company = { ...createCompany({ companyName: 'テスト' }), status: '不明' };
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });

  it('YYYY-MM-DD 形式以外の sentDate でエラー', () => {
    const company = createCompany({ companyName: 'テスト', sentDate: '2024/06/01' });
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'sentDate')).toBe(true);
  });

  it('sentDate が null の場合はエラーなし', () => {
    const company = createCompany({ companyName: 'テスト', sentDate: null });
    const errors = validateCompany(company);
    expect(errors.every((e) => e.field !== 'sentDate')).toBe(true);
  });

  it('employeeCount が負数でエラー', () => {
    const company = createCompany({ companyName: 'テスト', employeeCount: -1 });
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'employeeCount')).toBe(true);
  });

  it('employeeCount が小数でエラー', () => {
    const company = createCompany({ companyName: 'テスト', employeeCount: 10.5 });
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'employeeCount')).toBe(true);
  });

  it('employeeCount が null の場合はエラーなし', () => {
    const company = createCompany({ companyName: 'テスト', employeeCount: null });
    const errors = validateCompany(company);
    expect(errors.every((e) => e.field !== 'employeeCount')).toBe(true);
  });

  it('storeCount が負数でエラー', () => {
    const company = createCompany({ companyName: 'テスト', storeCount: -5 });
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'storeCount')).toBe(true);
  });

  it('leadScore が負数でエラー', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', leadScore: -1 }));
    expect(errors.some((e) => e.field === 'leadScore')).toBe(true);
  });

  it('leadScore が Infinity でエラー', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', leadScore: Infinity }));
    expect(errors.some((e) => e.field === 'leadScore')).toBe(true);
  });

  it('leadScore が 0 の場合はエラーなし', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', leadScore: 0 }));
    expect(errors.every((e) => e.field !== 'leadScore')).toBe(true);
  });

  it('leadScore が null の場合はエラーなし', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', leadScore: null }));
    expect(errors.every((e) => e.field !== 'leadScore')).toBe(true);
  });

  it('leadScore が正の小数の場合はエラーなし', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', leadScore: 85.5 }));
    expect(errors.every((e) => e.field !== 'leadScore')).toBe(true);
  });

  it('sendCount が負数でエラー', () => {
    const company = createCompany({ companyName: 'テスト', sendCount: -1 });
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'sendCount')).toBe(true);
  });

  it('sendCount が小数でエラー', () => {
    const company = createCompany({ companyName: 'テスト', sendCount: 1.5 });
    const errors = validateCompany(company);
    expect(errors.some((e) => e.field === 'sendCount')).toBe(true);
  });

  it('sendCount が 0 の場合はエラーなし', () => {
    const errors = validateCompany(createCompany({ companyName: 'テスト', sendCount: 0 }));
    expect(errors.every((e) => e.field !== 'sendCount')).toBe(true);
  });

  it('複数フィールドが不正な場合は複数エラーを返す', () => {
    const company = {
      ...createCompany(),
      companyName: '',
      email: 'bad',
      sendApproval: '?',
    };
    const errors = validateCompany(company);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── isApproved ───────────────────────────────────────────────────────────────

describe('isApproved', () => {
  it('sendApproval が "○" のとき true', () => {
    expect(isApproved(createCompany({ sendApproval: '○' }))).toBe(true);
  });

  it('sendApproval が "×" のとき false', () => {
    expect(isApproved(createCompany({ sendApproval: '×' }))).toBe(false);
  });

  it('sendApproval が "" のとき false', () => {
    expect(isApproved(createCompany({ sendApproval: '' }))).toBe(false);
  });
});

// ─── updateCompany ────────────────────────────────────────────────────────────

describe('updateCompany', () => {
  it('指定したフィールドが更新される', () => {
    const original = createCompany({ companyName: 'before', industry: 'IT' });
    const updated = updateCompany(original, { companyName: 'after' });
    expect(updated.companyName).toBe('after');
    expect(updated.industry).toBe('IT'); // 未指定フィールドは保持
  });

  it('id は変更されない', () => {
    const original = createCompany();
    const updated = updateCompany(original, { id: 'new-id' });
    expect(updated.id).toBe(original.id);
  });

  it('createdAt は変更されない', () => {
    const original = createCompany();
    const updated = updateCompany(original, { createdAt: '1970-01-01T00:00:00.000Z' });
    expect(updated.createdAt).toBe(original.createdAt);
  });

  it('updatedAt が新しい時刻に更新される', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const original = createCompany({ companyName: 'before' });
    expect(original.updatedAt).toBe('2024-01-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    const updated = updateCompany(original, { companyName: 'after' });

    expect(updated.updatedAt).toBe('2024-06-01T12:00:00.000Z');
    expect(updated.updatedAt).not.toBe(original.updatedAt);
  });

  it('元のオブジェクトは変更されない（immutable）', () => {
    const original = createCompany({ companyName: 'original' });
    updateCompany(original, { companyName: 'mutated' });
    expect(original.companyName).toBe('original');
  });
});

// ─── 定数 ─────────────────────────────────────────────────────────────────────

describe('SEND_APPROVAL_VALUES', () => {
  it('"○", "×", "" を含む', () => {
    expect(SEND_APPROVAL_VALUES).toContain('○');
    expect(SEND_APPROVAL_VALUES).toContain('×');
    expect(SEND_APPROVAL_VALUES).toContain('');
  });

  it('freeze されている（変更不可）', () => {
    expect(() => {
      // @ts-ignore
      SEND_APPROVAL_VALUES.push('△');
    }).toThrow();
  });
});

describe('STATUS', () => {
  it('6 種類のステータスを持つ', () => {
    expect(Object.keys(STATUS)).toHaveLength(6);
  });

  it('各キーが期待値を持つ', () => {
    expect(STATUS.NEW).toBe('NEW');
    expect(STATUS.SENT).toBe('SENT');
    expect(STATUS.REPLIED).toBe('REPLIED');
    expect(STATUS.MEETING).toBe('MEETING');
    expect(STATUS.CLOSED).toBe('CLOSED');
    expect(STATUS.NG).toBe('NG');
  });

  it('freeze されている（変更不可）', () => {
    expect(() => {
      // @ts-ignore
      STATUS.UNKNOWN = 'UNKNOWN';
    }).toThrow();
  });
});

describe('STATUS_VALUES', () => {
  it('STATUS のすべての値を含む', () => {
    for (const val of Object.values(STATUS)) {
      expect(STATUS_VALUES).toContain(val);
    }
  });

  it('6 要素を持つ', () => {
    expect(STATUS_VALUES).toHaveLength(6);
  });

  it('freeze されている（変更不可）', () => {
    expect(() => {
      // @ts-ignore
      STATUS_VALUES.push('UNKNOWN');
    }).toThrow();
  });
});
