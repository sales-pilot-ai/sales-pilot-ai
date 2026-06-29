/**
 * @typedef {{ introText: string }} PersonalizedContent
 */

/**
 * @callback PersonalizerFn
 * @param {import('../models/company.js').Company} company
 * @returns {PersonalizedContent | Promise<PersonalizedContent>}
 */

/**
 * パーソナライザー実装をラップして統一インターフェースを返す。
 *
 * AI プロバイダーへ差し替える場合は同じ関数シグネチャを実装し、
 * index.js の createPersonalizer 呼び出しを切り替えるだけでよい。
 *
 * @param {PersonalizerFn} impl
 * @returns {PersonalizerFn}
 */
export function createPersonalizer(impl) {
  return impl;
}
