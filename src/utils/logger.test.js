import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('全メソッドが関数として公開されている', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.success).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.step).toBe('function');
  });

  it('info は console.log を呼び出す', () => {
    logger.info('test message');
    expect(console.log).toHaveBeenCalled();
  });

  it('error は console.error を呼び出す', () => {
    logger.error('something went wrong');
    expect(console.error).toHaveBeenCalled();
  });
});
