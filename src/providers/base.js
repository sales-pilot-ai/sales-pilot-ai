/**
 * @typedef {Object} FindOptions
 * @property {string} industry - 業種
 * @property {string} area     - 地域
 * @property {number} limit    - 取得件数の上限
 */

/**
 * 全 Provider が実装すべき共通インターフェース。
 * このクラスを直接インスタンス化することはできない。
 *
 * @abstract
 */
export class BaseProvider {
  /**
   * @param {string} name - プロバイダ識別名
   */
  constructor(name) {
    if (new.target === BaseProvider) {
      throw new TypeError(
        'BaseProvider は直接インスタンス化できません。サブクラスを使用してください。'
      );
    }
    /** @type {string} */
    this.name = name;
  }

  /**
   * 業種・地域を指定して企業リストを取得する。
   * サブクラスで必ずオーバーライドすること。
   *
   * @abstract
   * @param {string} industry - 業種（例: "飲食業"）
   * @param {string} area     - 地域（例: "東京都渋谷区"）
   * @param {number} [limit]  - 取得件数の上限
   * @returns {Promise<import('../models/company.js').Company[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async find(industry, area, limit) {
    throw new Error(
      `${this.constructor.name}.find() は未実装です。サブクラスでオーバーライドしてください。`
    );
  }
}
