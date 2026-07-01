import { describe, it, expect } from 'vitest';
import { shouldSkip } from './send-filter.js';
import { SEND_STATUS } from '../../constants/index.js';

function company(status) {
  return { email: 'test@example.com', status };
}

describe('shouldSkip', () => {
  // ─── メールなし ──────────────────────────────────────────────────────────────

  it('email が空文字のときスキップする', () => {
    const result = shouldSkip({ email: '' });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('メールなし');
  });

  it('email が undefined のときスキップする', () => {
    const result = shouldSkip({});
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('メールなし');
  });

  it('email がスペースのみのときスキップする', () => {
    const result = shouldSkip({ email: '   ' });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('メールなし');
  });

  it('force=true でもメールなしはスキップする', () => {
    const result = shouldSkip({ email: '' }, { force: true });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('メールなし');
  });

  // ─── 未送信 ─────────────────────────────────────────────────────────────────

  it('未送信はスキップしない', () => {
    expect(shouldSkip(company(SEND_STATUS.NOT_SENT)).skip).toBe(false);
  });

  it('status が空文字はスキップしない（未送信扱い）', () => {
    expect(shouldSkip(company('')).skip).toBe(false);
  });

  it('status が undefined はスキップしない（未送信扱い）', () => {
    expect(shouldSkip({ email: 'test@example.com' }).skip).toBe(false);
  });

  // ─── 送信失敗（再送対象）───────────────────────────────────────────────────

  it('送信失敗はスキップしない（再送対象）', () => {
    expect(shouldSkip(company(SEND_STATUS.FAILED)).skip).toBe(false);
  });

  // ─── 送信済（--force なし）──────────────────────────────────────────────────

  it('送信済は --force なしでスキップする', () => {
    const result = shouldSkip(company(SEND_STATUS.SENT), { force: false });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe(SEND_STATUS.SENT);
  });

  it('送信済は --force ありでスキップしない', () => {
    expect(shouldSkip(company(SEND_STATUS.SENT), { force: true }).skip).toBe(false);
  });

  // ─── 返信あり（常にスキップ）────────────────────────────────────────────────

  it('返信ありは --force なしでスキップする', () => {
    const result = shouldSkip(company(SEND_STATUS.REPLIED), { force: false });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe(SEND_STATUS.REPLIED);
  });

  it('返信ありは --force ありでもスキップする', () => {
    const result = shouldSkip(company(SEND_STATUS.REPLIED), { force: true });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe(SEND_STATUS.REPLIED);
  });

  // ─── 配信停止（常にスキップ）────────────────────────────────────────────────

  it('配信停止は --force なしでスキップする', () => {
    const result = shouldSkip(company(SEND_STATUS.UNSUBSCRIBED), { force: false });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe(SEND_STATUS.UNSUBSCRIBED);
  });

  it('配信停止は --force ありでもスキップする', () => {
    const result = shouldSkip(company(SEND_STATUS.UNSUBSCRIBED), { force: true });
    expect(result.skip).toBe(true);
    expect(result.reason).toBe(SEND_STATUS.UNSUBSCRIBED);
  });

  // ─── デフォルト引数 ──────────────────────────────────────────────────────────

  it('options を省略しても動作する（force=false 相当）', () => {
    const result = shouldSkip(company(SEND_STATUS.SENT));
    expect(result.skip).toBe(true);
  });
});
