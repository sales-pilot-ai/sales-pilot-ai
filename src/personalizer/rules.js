// ─── Category detection ───────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'beauty',
    keywords: [
      '美容',
      '美容院',
      '美容室',
      'ヘアサロン',
      'エステ',
      'ネイル',
      'まつ毛',
      'アイラッシュ',
      'リラク',
      'マッサージ',
      '脱毛',
    ],
  },
  {
    key: 'food',
    keywords: [
      '飲食',
      'レストラン',
      '食堂',
      '居酒屋',
      'カフェ',
      '喫茶',
      'ラーメン',
      '焼肉',
      '寿司',
      '料理',
      '定食',
      'ベーカリー',
      'パティスリー',
    ],
  },
  {
    key: 'legal',
    keywords: [
      '士業',
      '弁護士',
      '税理士',
      '司法書士',
      '行政書士',
      '社労士',
      '弁理士',
      '公認会計士',
      '中小企業診断士',
      '不動産鑑定士',
    ],
  },
  {
    key: 'it',
    keywords: [
      'IT',
      'システム',
      'ソフトウェア',
      'SaaS',
      'DX',
      'アプリ',
      'クラウド',
      'AI',
      'デジタル',
      'エンジニア',
      'プログラミング',
      'テック',
      'スタートアップ',
    ],
  },
];

const INTRO_TEXT_MAP = {
  beauty: 'SNS集客のお手伝い',
  food: '来店促進のお手伝い',
  legal: '問い合わせ獲得のお手伝い',
  it: 'リード獲得のお手伝い',
};

/**
 * 企業情報から業種カテゴリを検出する。
 * @param {import('../models/company.js').Company} company
 * @returns {'beauty' | 'food' | 'legal' | 'it' | 'other'}
 */
export function detectCategory(company) {
  const text = [company.industry, company.memo].filter(Boolean).join(' ');
  for (const { key, keywords } of CATEGORIES) {
    if (keywords.some((kw) => text.includes(kw))) return key;
  }
  return 'other';
}

/**
 * 「その他」カテゴリのときに memo/description から短い紹介文を生成する。
 * @param {import('../models/company.js').Company} company
 * @returns {string}
 */
function buildFallbackIntroText(company) {
  const memo = company.memo ?? '';
  if (memo) {
    const sentence = memo.split(/[。.!！\n]/)[0].trim();
    if (sentence.length > 0 && sentence.length <= 25) {
      return `${sentence}のお手伝い`;
    }
  }
  return '業務効率化のお手伝い';
}

/**
 * ルールベースで introText を生成する。
 * @param {import('../models/company.js').Company} company
 * @returns {string}
 */
export function generateIntroText(company) {
  const category = detectCategory(company);
  return INTRO_TEXT_MAP[category] ?? buildFallbackIntroText(company);
}
