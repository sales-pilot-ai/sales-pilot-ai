// 営業リストシートの列・値定義（現行CLI版 src/constants/index.js の値を踏襲。設計書④参照）

var COMPANY_SHEET_NAME = '営業リスト';

var COMPANY_HEADERS = [
  '企業ID',
  '会社名',
  '業種',
  'エリア',
  'ホームページ',
  'メールアドレス',
  'お問い合わせフォーム',
  '電話番号',
  '住所',
  'メモ',
  '送信日',
  '送信可否',
  '送信状況',
  '担当者名',
  '最終更新',
  '返信有無',
  '商談日',
  '成約',
  'Place ID',
  'AI要約',
];

var SEND_APPROVAL = {
  YES: '○',
  NO: '×',
};

var SEND_STATUS = {
  NOT_SENT: '未送信',
  SENT: '送信済',
  FAILED: '送信失敗',
  REPLIED: '返信あり',
  UNSUBSCRIBED: '配信停止',
};

var DEAL_RESULT = {
  WON: '成約',
  LOST: '失注',
};

// 保存済み企業を検索候補保存で上書きしてはいけない列（現行CLI版のPROTECTED_FIELDS相当）
var COMPANY_PROTECTED_HEADERS = [
  '企業ID',
  '送信日',
  '送信可否',
  '送信状況',
  '担当者名',
  'メモ',
  '返信有無',
  '商談日',
  '成約',
  'AI要約',
];
