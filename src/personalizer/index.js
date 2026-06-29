import { generateIntroText } from './rules.js';
import { createPersonalizer } from './template.js';

const personalizer = createPersonalizer((company) => ({
  introText: generateIntroText(company),
}));

/**
 * 企業情報からパーソナライズされたメール変数を生成する。
 *
 * 現在はルールベース実装。AI プロバイダーへ切り替える場合は
 * personalizer の実装を差し替えるだけでよく、このシグネチャは変わらない。
 *
 * @param {import('../models/company.js').Company} company
 * @returns {Promise<import('./template.js').PersonalizedContent>}
 */
export async function createPersonalizedContent(company) {
  return personalizer(company);
}
