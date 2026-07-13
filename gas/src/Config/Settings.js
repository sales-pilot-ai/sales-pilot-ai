// スクリプトプロパティ（PropertiesService）のラッパー。秘密情報はSheetsに置かない（設計書⑧参照）。

var SETTINGS_KEYS = {
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  MAPS_API_KEY: 'MAPS_API_KEY',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',
  TIMEREX_URL: 'TIMEREX_URL',
  SALES_PERSON_NAME: 'SALES_PERSON_NAME',
  SALES_PERSON_TEL: 'SALES_PERSON_TEL',
  SALES_PERSON_MAIL: 'SALES_PERSON_MAIL',
};

// GEMINI_MODELスクリプトプロパティが未設定の場合に使うデフォルトモデル。
// モデルを変更したい場合はスクリプトプロパティ側を設定するだけでよく、コード変更は不要。
var DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

// TIMEREX_URLスクリプトプロパティが未設定の場合に使うデフォルトのTimeRexリンク
// （株式会社イノゼロリテイリング 営業メールテンプレート固定値）。
var DEFAULT_TIMEREX_URL = 'https://timerex.net/s/inozerosales_2d6c/afa61502';

// 営業リスト用スプレッドシートのIDを返す。スクリプトプロパティに事前登録されたIDのみを使用する。
// 「アクセスしているユーザーとして実行」では新規ファイル作成（SpreadsheetApp.create）の権限がなく
// 例外になるため、自動作成は行わない（管理者が事前に作成しIDを登録しておく運用とする）。
function getSpreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.SPREADSHEET_ID);
  if (!id) {
    throw new Error('SPREADSHEET_ID が設定されていません');
  }
  return id;
}

// Google Maps (Places API) のAPIキーを返す。未設定の場合はnull。
function getMapsApiKey_() {
  return PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.MAPS_API_KEY);
}

// Gemini APIキーを返す。未設定の場合はnull。
function getGeminiApiKey_() {
  return PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.GEMINI_API_KEY);
}

// 使用するGeminiモデル名を返す。スクリプトプロパティ未設定時はDEFAULT_GEMINI_MODELを使う。
function getGeminiModel_() {
  var model = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.GEMINI_MODEL);
  return model || DEFAULT_GEMINI_MODEL;
}

// 営業メール下書きに挿入するTimeRex（日程調整）リンクを返す。
// スクリプトプロパティ未設定時はDEFAULT_TIMEREX_URL（固定値）を使う。
function getTimeRexUrl_() {
  var url = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.TIMEREX_URL);
  return url || DEFAULT_TIMEREX_URL;
}

// スクリプトプロパティを取得する共通ヘルパー。未設定の場合はフォールバックせずエラーとする
// （GEMINI_MODEL・TIMEREX_URLのようにデフォルト値が許容される設定には使わず、
// 営業担当者情報のように必須の設定にのみ使用する）。
function getRequiredScriptProperty_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('スクリプトプロパティ「' + key + '」が設定されていません。');
  }
  return value;
}

// 営業担当者情報（氏名・電話番号・メールアドレス）をまとめて返す。
// 担当者変更時にコード修正・再デプロイが不要になるよう、スクリプトプロパティから取得する。
function getSalesPerson_() {
  return {
    name: getRequiredScriptProperty_(SETTINGS_KEYS.SALES_PERSON_NAME),
    tel: getRequiredScriptProperty_(SETTINGS_KEYS.SALES_PERSON_TEL),
    mail: getRequiredScriptProperty_(SETTINGS_KEYS.SALES_PERSON_MAIL),
  };
}

// 設定画面（Sprint7⑥）向けに、現在のスクリプトプロパティを返す。APIキー（MAPS_API_KEY/
// GEMINI_API_KEY）は値そのものを画面へ渡さず、設定済みかどうかの真偽値のみを返す
// （画面はパスワード欄を空欄表示し、入力があった場合のみ上書きする設計。値を平文で
// ブラウザへ送り返さないことで、APIキーが画面表示・ブラウザ履歴に残るリスクを避ける）。
function getSettingsForAdmin_() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty(SETTINGS_KEYS.SPREADSHEET_ID) || '',
    mapsApiKeySet: !!props.getProperty(SETTINGS_KEYS.MAPS_API_KEY),
    geminiApiKeySet: !!props.getProperty(SETTINGS_KEYS.GEMINI_API_KEY),
    geminiModel: props.getProperty(SETTINGS_KEYS.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL,
    timeRexUrl: props.getProperty(SETTINGS_KEYS.TIMEREX_URL) || DEFAULT_TIMEREX_URL,
    salesPersonName: props.getProperty(SETTINGS_KEYS.SALES_PERSON_NAME) || '',
    salesPersonTel: props.getProperty(SETTINGS_KEYS.SALES_PERSON_TEL) || '',
    salesPersonMail: props.getProperty(SETTINGS_KEYS.SALES_PERSON_MAIL) || '',
  };
}

// 設定画面からの保存。dataの各フィールドは省略可能（undefinedのフィールドは変更しない）。
// mapsApiKey/geminiApiKeyは空文字の場合、既存の値を変更しない（画面はパスワード欄を
// 常に空欄表示するため、「変更したい場合だけ入力する」運用と対応させるため）。
function updateSettings_(data) {
  var props = PropertiesService.getScriptProperties();

  if (data.spreadsheetId !== undefined) {
    if (!data.spreadsheetId) {
      throw new Error('スプレッドシートIDは必須です。');
    }
    props.setProperty(SETTINGS_KEYS.SPREADSHEET_ID, data.spreadsheetId);
  }
  if (data.mapsApiKey) {
    props.setProperty(SETTINGS_KEYS.MAPS_API_KEY, data.mapsApiKey);
  }
  if (data.geminiApiKey) {
    props.setProperty(SETTINGS_KEYS.GEMINI_API_KEY, data.geminiApiKey);
  }
  if (data.geminiModel !== undefined) {
    props.setProperty(SETTINGS_KEYS.GEMINI_MODEL, data.geminiModel || DEFAULT_GEMINI_MODEL);
  }
  if (data.timeRexUrl !== undefined) {
    props.setProperty(SETTINGS_KEYS.TIMEREX_URL, data.timeRexUrl || DEFAULT_TIMEREX_URL);
  }
  if (data.salesPersonName !== undefined) {
    if (!data.salesPersonName) {
      throw new Error('営業担当者名は必須です。');
    }
    props.setProperty(SETTINGS_KEYS.SALES_PERSON_NAME, data.salesPersonName);
  }
  if (data.salesPersonTel !== undefined) {
    if (!data.salesPersonTel) {
      throw new Error('営業担当者の電話番号は必須です。');
    }
    props.setProperty(SETTINGS_KEYS.SALES_PERSON_TEL, data.salesPersonTel);
  }
  if (data.salesPersonMail !== undefined) {
    if (!data.salesPersonMail) {
      throw new Error('営業担当者のメールアドレスは必須です。');
    }
    props.setProperty(SETTINGS_KEYS.SALES_PERSON_MAIL, data.salesPersonMail);
  }

  return getSettingsForAdmin_();
}
