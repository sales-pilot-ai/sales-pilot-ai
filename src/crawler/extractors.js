// ─── URL ──────────────────────────────────────────────────────────────────────

/**
 * 相対 URL を絶対 URL に解決する。無効な URL は '' を返す。
 * @param {string} href
 * @param {string} baseUrl
 * @returns {string}
 */
export function resolveUrl(href, baseUrl) {
  if (!href) return '';
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

/**
 * HTML から最初のメールアドレスを抽出する。
 * mailto: リンクを優先し、なければテキスト内をスキャンする。
 * @param {string} html
 * @returns {string}
 */
export function extractEmail(html) {
  // mailto: リンクを最優先
  const mailtoMatch = html.match(/href=["']mailto:([^"'?&\s]+)/i);
  if (mailtoMatch) return mailtoMatch[1];

  // テキスト内をスキャン（画像ファイル名の誤検知を除外）
  const textContent = html.replace(/<[^>]+>/g, ' ');
  const emailMatch = textContent.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch && !/\.(png|jpg|gif|svg|webp|pdf|zip)$/i.test(emailMatch[0])) {
    return emailMatch[0];
  }

  return '';
}

// ─── Contact form URL ─────────────────────────────────────────────────────────

const CONTACT_HREF_PATTERNS = [/contact/i, /inquiry/i, /toiawase/i, /otoiawase/i, /問い合わせ/];

const CONTACT_TEXT_PATTERNS = [/お問い合わせ/, /ご相談/, /contact\s*us/i, /inquiry/i];

/**
 * HTML からお問い合わせページ（コンタクトフォーム）の URL を抽出する。
 * href のパスパターンを優先し、リンクテキストも参照する。
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string}
 */
export function extractContactFormUrl(html, baseUrl) {
  const anchorRe = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRe.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    const hrefMatches = CONTACT_HREF_PATTERNS.some((re) => re.test(href));
    const textMatches = CONTACT_TEXT_PATTERNS.some((re) => re.test(text));

    if (hrefMatches || textMatches) {
      return resolveUrl(href, baseUrl);
    }
  }

  return '';
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/**
 * HTML から Instagram プロフィール URL を抽出する。
 * 投稿・リール・ストーリーURLは除外する。
 * @param {string} html
 * @returns {string}
 */
export function extractInstagram(html) {
  const re =
    /https?:\/\/(?:www\.)?instagram\.com\/(?!explore\/|p\/|reel\/|tv\/|stories\/)([A-Za-z0-9_.]{1,30})\/?/;
  const match = html.match(re);
  return match ? match[0].replace(/\/$/, '') : '';
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

/**
 * HTML から TikTok プロフィール URL を抽出する。
 * @param {string} html
 * @returns {string}
 */
export function extractTikTok(html) {
  const re = /https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{1,24})\/?/;
  const match = html.match(re);
  return match ? match[0].replace(/\/$/, '') : '';
}

// ─── Employee count ───────────────────────────────────────────────────────────

const EMPLOYEE_PATTERNS = [
  /従業員(?:数)?(?:\s*[：:]\s*|\s+)(?:約\s*)?(\d{1,6}(?:,\d{3})*)\s*(?:名|人)/,
  /社員(?:数)?(?:\s*[：:]\s*|\s+)(?:約\s*)?(\d{1,6}(?:,\d{3})*)\s*(?:名|人)/,
  /スタッフ(?:数)?(?:\s*[：:]\s*|\s+)(?:約\s*)?(\d{1,6}(?:,\d{3})*)\s*(?:名|人)/,
  /(?:約\s*)?(\d{1,6}(?:,\d{3})*)\s*名の(?:従業員|社員|スタッフ)/,
];

/**
 * HTML から従業員数を抽出する。
 * @param {string} html
 * @returns {number | null}
 */
export function extractEmployeeCount(html) {
  const text = html.replace(/<[^>]+>/g, ' ');

  for (const pattern of EMPLOYEE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(num) && num > 0 && num < 10_000_000) return num;
    }
  }

  return null;
}

// ─── Store count ──────────────────────────────────────────────────────────────

const STORE_PATTERNS = [
  /店舗数\s*[：:]\s*(\d{1,4})/,
  /全国\s*(\d{1,4})\s*(?:店舗|店)/,
  /(\d{1,4})\s*店舗(?:を|に|で|が|の|展開)/,
  /直営(?:店)?\s*[：:]?\s*(\d{1,4})\s*(?:店舗|店)/,
];

/**
 * HTML から店舗数を抽出する。
 * @param {string} html
 * @returns {number | null}
 */
export function extractStoreCount(html) {
  const text = html.replace(/<[^>]+>/g, ' ');

  for (const pattern of STORE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > 0 && num < 100_000) return num;
    }
  }

  return null;
}

// ─── Convenience ─────────────────────────────────────────────────────────────

/**
 * 全 extractor を一括実行してオブジェクトで返す。
 * @param {string} html
 * @param {string} baseUrl
 * @returns {{ email: string, contactFormUrl: string, instagram: string, tiktok: string, employeeCount: number | null, storeCount: number | null }}
 */
export function extractAll(html, baseUrl) {
  return {
    email: extractEmail(html),
    contactFormUrl: extractContactFormUrl(html, baseUrl),
    instagram: extractInstagram(html),
    tiktok: extractTikTok(html),
    employeeCount: extractEmployeeCount(html),
    storeCount: extractStoreCount(html),
  };
}
