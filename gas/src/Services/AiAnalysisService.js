// 企業情報のAI解析（Gemini）結果・営業メールDM下書きのCRUD、プロンプト組み立てを担当する
// （Sprint3設計書参照）。詳細な解析結果は「企業分析」シートに保存し、営業リストには
// AI要約(summary)のみ反映する。下書きは履歴を持たず、同シートの列に直近1件のみ上書き保存する。

var COMPANY_ANALYSIS_SHEET_NAME = '企業分析';

var COMPANY_ANALYSIS_HEADERS = [
  '企業ID',
  '会社名',
  '要約',
  '事業内容',
  '特徴',
  'ターゲット',
  '営業ポイント',
  'おすすめサービス',
  '解析元URL',
  '解析日時',
  'モデル名',
  '解析ステータス',
  '解析エラー内容',
  '下書き件名',
  '下書き本文',
  '下書きトーン',
  '下書き生成日時',
  '下書きステータス',
  '下書きエラー内容',
  'Gmail下書き作成済',
  'Gmail下書き作成日時',
  'メール送信済み',
  'メール送信日時',
];

var COMPANY_ANALYSIS_FIELD_TO_HEADER = {
  companyId: '企業ID',
  companyName: '会社名',
  summary: '要約',
  business: '事業内容',
  features: '特徴',
  target: 'ターゲット',
  salesPoint: '営業ポイント',
  recommendedService: 'おすすめサービス',
  analyzedUrl: '解析元URL',
  analyzedAt: '解析日時',
  model: 'モデル名',
  status: '解析ステータス',
  errorMessage: '解析エラー内容',
  draftSubject: '下書き件名',
  draftBody: '下書き本文',
  draftTone: '下書きトーン',
  draftGeneratedAt: '下書き生成日時',
  draftStatus: '下書きステータス',
  draftErrorMessage: '下書きエラー内容',
  gmailDraftStatus: 'Gmail下書き作成済',
  gmailDraftCreatedAt: 'Gmail下書き作成日時',
  mailSentStatus: 'メール送信済み',
  mailSentAt: 'メール送信日時',
};

// Geminiに構造化出力（JSON固定）させるためのレスポンススキーマ（企業情報解析用）。
var COMPANY_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    business: { type: 'STRING' },
    features: { type: 'STRING' },
    target: { type: 'STRING' },
    salesPoint: { type: 'STRING' },
    recommendedService: { type: 'STRING' },
  },
  required: ['summary', 'business', 'features', 'target', 'salesPoint', 'recommendedService'],
};

// Geminiに構造化出力させるためのレスポンススキーマ（営業メール・DM下書き用）。
// Sprint3 Step5より、件名・本文は固定テンプレート（Config/SalesEmailTemplate.js）を使用し、
// Geminiには「ホームページを見た感想・共感ポイント・提案理由」の1段落のみを生成させる。
var SALES_DRAFT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    personalizedNote: { type: 'STRING' },
  },
  required: ['personalizedNote'],
};

// Geminiに渡すHTMLの最大文字数（トークン数・料金を抑えるため、大きすぎるページは先頭を切り詰める）。
var ANALYSIS_HTML_MAX_LENGTH = 20000;

var DEFAULT_DRAFT_TONE = '初回アプローチ';

function getCompanyAnalysisSheet_() {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  var sheet = spreadsheet.getSheetByName(COMPANY_ANALYSIS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(COMPANY_ANALYSIS_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COMPANY_ANALYSIS_HEADERS);
    return sheet;
  }
  ensureHeaders_(sheet, COMPANY_ANALYSIS_HEADERS);
  return sheet;
}

// 企業IDで1行分の値を取得する（企業情報解析済みか、下書き生成の元データ取得に使う）。
function getCompanyAnalysisRow_(companyId) {
  var sheet = getCompanyAnalysisSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headerIndex = buildHeaderIndex_(values[0]);
  var idCol = headerIndex['企業ID'];

  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === companyId) {
      var row = {};
      Object.keys(COMPANY_ANALYSIS_FIELD_TO_HEADER).forEach(function (field) {
        var col = headerIndex[COMPANY_ANALYSIS_FIELD_TO_HEADER[field]];
        var value = col === undefined ? '' : values[i][col];
        row[field] = value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : value;
      });
      return row;
    }
  }
  return null;
}

// 企業分析シートの指定企業IDの行のうち、fieldsに含まれる列だけを更新する（他の列はそのまま残す）。
// 行が存在しない場合は、fieldsの内容のみで新規行を追記する。
function upsertCompanyAnalysisFields_(companyId, fields) {
  var sheet = getCompanyAnalysisSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerIndex = buildHeaderIndex_(headerRow);
  var idCol = headerIndex['企業ID'];

  var targetRow = null;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === companyId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (!targetRow) {
    var newRow = headerRow.map(function () {
      return '';
    });
    Object.keys(fields).forEach(function (field) {
      var col = headerIndex[COMPANY_ANALYSIS_FIELD_TO_HEADER[field]];
      if (col !== undefined) {
        newRow[col] = fields[field] === undefined || fields[field] === null ? '' : fields[field];
      }
    });
    sheet.appendRow(newRow);
    return;
  }

  Object.keys(fields).forEach(function (field) {
    var col = headerIndex[COMPANY_ANALYSIS_FIELD_TO_HEADER[field]];
    if (col === undefined) {
      return;
    }
    var value = fields[field];
    sheet.getRange(targetRow, col + 1).setValue(value === undefined || value === null ? '' : value);
  });
}

function buildAnalysisPrompt_(companyName, html) {
  var truncatedHtml = html.length > ANALYSIS_HTML_MAX_LENGTH ? html.slice(0, ANALYSIS_HTML_MAX_LENGTH) : html;
  return [
    'あなたは営業支援AIです。以下の企業のWebサイトHTMLを読み、営業活動に使える情報を日本語で抽出してください。',
    '会社名: ' + (companyName || '不明'),
    '次の項目を、HTMLの内容から読み取れる範囲で埋めてください。読み取れない項目は「不明」としてください。',
    '- summary: 1〜2文程度の簡潔な会社概要',
    '- business: 事業内容の説明',
    '- features: 会社・サービスの特徴',
    '- target: 想定される顧客・ターゲット層',
    '- salesPoint: 営業提案の切り口になりそうなポイント',
    '- recommendedService: この会社に提案すると良さそうな商材・サービスの方向性',
    '--- Webサイト HTML ここから ---',
    truncatedHtml,
    '--- Webサイト HTML ここまで ---',
  ].join('\n');
}

// 対象企業のホームページHTMLをGeminiで解析し、企業分析シート・営業リストのAI要約列を更新する。
function analyzeCompanyWebsite_(companyId, companyName, websiteUrl) {
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var result = {
    companyId: companyId,
    companyName: companyName || '',
    summary: '',
    business: '',
    features: '',
    target: '',
    salesPoint: '',
    recommendedService: '',
    analyzedUrl: websiteUrl || '',
    analyzedAt: now,
    model: getGeminiModel_(),
    status: '',
    errorMessage: '',
  };

  if (!websiteUrl) {
    result.status = '失敗';
    result.errorMessage = 'ホームページURLが未設定のため解析できませんでした';
    upsertCompanyAnalysisFields_(companyId, result);
    return result;
  }

  try {
    var response = UrlFetchApp.fetch(websiteUrl, { muteHttpExceptions: true, followRedirects: true });
    if (response.getResponseCode() >= 300) {
      throw new Error('Webサイトの取得に失敗しました（HTTP ' + response.getResponseCode() + '）');
    }
    var html = response.getContentText();

    var analysis = callGemini_(buildAnalysisPrompt_(companyName, html), {
      responseSchema: COMPANY_ANALYSIS_RESPONSE_SCHEMA,
    });

    result.summary = analysis.summary || '';
    result.business = analysis.business || '';
    result.features = analysis.features || '';
    result.target = analysis.target || '';
    result.salesPoint = analysis.salesPoint || '';
    result.recommendedService = analysis.recommendedService || '';
    result.status = '成功';
  } catch (err) {
    result.status = '失敗';
    result.errorMessage = err.message;
  }

  upsertCompanyAnalysisFields_(companyId, result);
  if (result.status === '成功') {
    updateCompanySummary_(companyId, result.summary);
  }
  return result;
}

// 既存の企業分析データ（AI要約・特徴・営業ポイント等）のみを用いて、
// 「ホームページを見た感想・共感ポイント・提案理由」の1段落（200〜400文字程度）を生成させる。
// 件名・本文の他の部分は固定テンプレート（Config/SalesEmailTemplate.js）が担うため、ここでは対象外。
function buildDraftPrompt_(analysis, companyName, tone) {
  return [
    'あなたは営業支援AIです。以下は、ある企業のホームページ解析結果です。新たな調査や推測による事実の追加は行わないでください。',
    '会社名: ' + (companyName || '不明'),
    'トーン/目的: ' + (tone || DEFAULT_DRAFT_TONE),
    '--- 企業分析結果 ---',
    'AI要約: ' + (analysis.summary || '不明'),
    '事業内容: ' + (analysis.business || '不明'),
    '特徴: ' + (analysis.features || '不明'),
    'ターゲット: ' + (analysis.target || '不明'),
    '営業ポイント: ' + (analysis.salesPoint || '不明'),
    'おすすめサービス: ' + (analysis.recommendedService || '不明'),
    '--- ここまで ---',
    '上記の情報のみを踏まえ、次の3点を含む1つの文章を日本語で作成してください。',
    '1. ホームページを見た感想',
    '2. この企業への共感ポイント',
    '3. この企業へ提案する理由',
    '文章は200〜400文字程度としてください。挨拶・自己紹介・署名・件名は含めず、本文に差し込む1段落のみを生成してください。',
  ].join('\n');
}

// 保存済みの企業分析結果を元に、営業メール・DMの下書き（件名・本文）を生成する。
// 件名・本文は営業メールテンプレート（Sheets「営業メールテンプレート」、Sprint7⑤で
// テンプレート管理画面から複数管理可能に変更）で組み立て、Geminiには個別文言
// （感想・共感ポイント・提案理由）の1段落のみを生成させる。templateIdを省略した場合は
// デフォルトテンプレートを使用する。
// Geminiによる個別文言の生成に失敗した場合も、営業メール生成全体を失敗にはせず、
// その段落を省いたテンプレートのみで下書きを作成する（フォールバック）。
// 下書きは履歴を持たず、企業分析シートの下書き列を直近1件のみ上書き保存する。
// emailは営業メール生成を実行した本人（ログイン中ユーザー）のメールアドレスで、
// 本文中の{{salesPersonName}}等の署名プレースホルダーの解決に使う（追加依頼）。
function generateSalesDraft_(companyId, tone, templateId, email) {
  var analysis = getCompanyAnalysisRow_(companyId);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var resolvedTone = tone || DEFAULT_DRAFT_TONE;

  var result = {
    draftSubject: '',
    draftBody: '',
    draftTone: resolvedTone,
    draftGeneratedAt: now,
    draftStatus: '',
    draftErrorMessage: '',
  };

  if (!analysis || analysis.status !== '成功') {
    result.draftStatus = '失敗';
    result.draftErrorMessage = '企業分析結果が見つかりません。先に企業情報解析を実行してください。';
    upsertCompanyAnalysisFields_(companyId, result);
    return result;
  }

  var personalizedNote = '';
  try {
    var generated = callGemini_(buildDraftPrompt_(analysis, analysis.companyName, resolvedTone), {
      responseSchema: SALES_DRAFT_RESPONSE_SCHEMA,
    });
    personalizedNote = generated.personalizedNote || '';
  } catch (err) {
    result.draftErrorMessage =
      'AIによる個別紹介文の生成に失敗したため、固定テンプレートのみで下書きを作成しました: ' + err.message;
  }

  result.draftSubject = buildSalesEmailSubject_(analysis.companyName, templateId);
  result.draftBody = buildSalesEmailBody_(analysis.companyName, personalizedNote, templateId, email);
  result.draftStatus = '成功';

  upsertCompanyAnalysisFields_(companyId, result);
  return result;
}
