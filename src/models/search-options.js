/**
 * @typedef {{ min: number|null, max: number|null }} EmployeeRange
 *
 * @typedef {Object} SearchOptions
 *
 * — 基本条件 —
 * @property {string} industry        - 業種（例: "飲食店"）
 * @property {string} area            - 地域（自由記述。prefecture / city と併用可）
 * @property {number} limit           - 取得件数の上限
 *
 * — 構造化地域 —
 * @property {string} prefecture      - 都道府県（例: "東京都"）
 * @property {string} city            - 市区町村（例: "渋谷区"）
 *
 * — キーワードフィルタ —
 * @property {string[]} keywords        - 企業名・説明に含むべきキーワード（AND）
 * @property {string[]} excludeKeywords - 除外キーワード（いずれか一致で除外）
 *
 * — 必須フィールドフィルタ —
 * @property {boolean} websiteRequired      - 公式サイトを持つ企業のみ
 * @property {boolean} phoneRequired        - 電話番号を持つ企業のみ
 * @property {boolean} emailRequired        - メールアドレスを持つ企業のみ（将来実装）
 * @property {boolean} contactFormRequired  - お問い合わせフォームを持つ企業のみ（将来実装）
 *
 * — スコアフィルタ —
 * @property {boolean}    excludeClosed    - 閉業済み（CLOSED_PERMANENTLY）を除外する
 * @property {number|null} minRating       - 最低評価点（null = 制限なし）
 * @property {number|null} minReviewCount  - 最低評価件数（null = 制限なし）
 * @property {boolean}    excludeChains    - チェーン店を除外する（将来実装）
 *
 * — 規模フィルタ —
 * @property {EmployeeRange} employeeRange - 従業員数の範囲（null = 制限なし）
 */

/**
 * SearchOptions を生成する。未指定フィールドにはデフォルト値を適用する。
 *
 * Provider 側では返値を参照専用として扱い、値を書き換えないこと。
 * 検索条件の追加は このファクトリ関数のみで行い、Provider のシグネチャは変更しない。
 *
 * @param {Partial<SearchOptions>} [data]
 * @returns {SearchOptions}
 */
export function createSearchOptions(data = {}) {
  return {
    // 基本条件
    industry: data.industry ?? '',
    area: data.area ?? '',
    limit: data.limit ?? 20,

    // 構造化地域
    prefecture: data.prefecture ?? '',
    city: data.city ?? '',

    // キーワードフィルタ
    keywords: data.keywords ?? [],
    excludeKeywords: data.excludeKeywords ?? [],

    // 必須フィールドフィルタ
    websiteRequired: data.websiteRequired ?? false,
    phoneRequired: data.phoneRequired ?? false,
    emailRequired: data.emailRequired ?? false,
    contactFormRequired: data.contactFormRequired ?? false,

    // スコアフィルタ
    excludeClosed: data.excludeClosed ?? true,
    minRating: data.minRating ?? null,
    minReviewCount: data.minReviewCount ?? null,
    excludeChains: data.excludeChains ?? false,

    // 規模フィルタ
    employeeRange: {
      min: data.employeeRange?.min ?? null,
      max: data.employeeRange?.max ?? null,
    },
  };
}
