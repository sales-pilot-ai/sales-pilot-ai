// 企業データのバリデーション（現行CLI版 src/models/company.js のうち、検索候補保存に必要な範囲を移植）

var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 検索候補として保存できるかを検証する。問題がなければ null、あればエラーメッセージを返す。
function validateCompanyCandidate_(candidate) {
  if (!candidate || !String(candidate.companyName || '').trim()) {
    return '会社名は必須です';
  }
  if (candidate.email && !EMAIL_PATTERN.test(candidate.email)) {
    return 'メールアドレスの形式が不正です';
  }
  return null;
}
