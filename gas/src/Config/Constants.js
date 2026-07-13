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

// IN_PROGRESS（対応中）・ON_HOLD（保留）はSprint8で追加。既存の「送信状況」列
// （updateCompanyStatus_で任意の値に更新できる汎用ステータス列）をそのまま流用し、
// 新しい列・新しい更新ロジックは追加しない。IN_PROGRESSは返信確認「新着返信」で
// 「対応済みにする」ボタンを押した際に設定し、以後は「継続返信」タブの対象になる。
var SEND_STATUS = {
  NOT_SENT: '未送信',
  SENT: '送信済',
  FAILED: '送信失敗',
  REPLIED: '返信あり',
  UNSUBSCRIBED: '配信停止',
  IN_PROGRESS: '対応中',
  ON_HOLD: '保留',
};

var DEAL_RESULT = {
  WON: '成約',
  LOST: '失注',
};

// 返信有無（タスクC）。企業検索からの新規保存時に明示的にNOを設定し、空欄のまま
// 保存されることを防ぐ（既存ロジックは引き続きc.hasReply === HAS_REPLY.YESでのみ判定するため、
// 空欄との互換性は保たれる）。
var HAS_REPLY = {
  YES: '返信あり',
  NO: '未返信',
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
