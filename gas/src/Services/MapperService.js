// 営業リストシートの行(Array) ⇄ 企業オブジェクト の変換（現行CLI版 src/sheets/mapper.js 相当）。
// ヘッダー行を都度読み取ってマッピングする（列の並び替えに強くするため）。

var COMPANY_FIELD_TO_HEADER = {
  companyId: '企業ID',
  companyName: '会社名',
  industry: '業種',
  area: 'エリア',
  websiteUrl: 'ホームページ',
  email: 'メールアドレス',
  contactFormUrl: 'お問い合わせフォーム',
  phone: '電話番号',
  address: '住所',
  memo: 'メモ',
  sentDate: '送信日',
  sendApproval: '送信可否',
  sendStatus: '送信状況',
  ownerName: '担当者名',
  updatedAt: '最終更新',
  hasReply: '返信有無',
  meetingDate: '商談日',
  dealResult: '成約',
  placeId: 'Place ID',
  aiSummary: 'AI要約',
};

// headerRow(Array<string>) -> { ヘッダー名: 列インデックス(0始まり) }
function buildHeaderIndex_(headerRow) {
  var index = {};
  headerRow.forEach(function (header, i) {
    index[header] = i;
  });
  return index;
}

// 1行分の値配列 -> 企業オブジェクト
function rowToCompany_(headerIndex, row) {
  var company = {};
  Object.keys(COMPANY_FIELD_TO_HEADER).forEach(function (field) {
    var header = COMPANY_FIELD_TO_HEADER[field];
    var colIndex = headerIndex[header];
    var value = colIndex === undefined ? '' : row[colIndex];
    // Sheetsが日付として解釈した値はDateオブジェクトで返ってくるため、
    // google.script.runでシリアライズできるよう文字列に変換する。
    company[field] = value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : value;
  });
  return company;
}

// 企業オブジェクト -> COMPANY_HEADERS の並び順に沿った値配列（新規追記用）
function companyToRow_(company) {
  return COMPANY_HEADERS.map(function (header) {
    var field = Object.keys(COMPANY_FIELD_TO_HEADER).filter(function (f) {
      return COMPANY_FIELD_TO_HEADER[f] === header;
    })[0];
    var value = company[field];
    return value === undefined || value === null ? '' : value;
  });
}
