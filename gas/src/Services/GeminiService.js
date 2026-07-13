// Gemini API 呼び出し（UrlFetchApp）。モデル名・APIキーはConfig/Settings.js経由で取得し、
// コードにベタ書きしない（設計書Sprint3参照。1箇所の変更で切り替えられるようにする）。
//
// 例外メッセージの方針: UrlFetchAppのネットワーク例外・レスポンス本文には、リクエストURL
// （APIキーを含む）や内部情報が含まれる場合があるため、詳細はLogger.log（実行ログ）にのみ出力し、
// throwするErrorのメッセージにはAPIキー・URL・レスポンス本文を含めない
// （呼び出し元がエラーメッセージをスプレッドシートに保存するため）。

var GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

// リトライ設定: タイムアウト・HTTP429（レート制限）・HTTP5xxを対象に、
// 指数バックオフ（1秒→2秒→4秒）で最大3回リトライする（将来の複数企業一括解析時の安定性のため）。
var GEMINI_MAX_RETRIES = 3;
var GEMINI_RETRY_BASE_DELAY_MS = 1000;

// prompt文字列をGeminiへ送信し、テキスト（またはoptions.responseSchema指定時はパース済みJSON）を返す。
function callGemini_(prompt, options) {
  var apiKey = getGeminiApiKey_();
  if (!apiKey) {
    throw new Error('Gemini APIキーが未設定です。スクリプトプロパティ「GEMINI_API_KEY」を設定してください。');
  }

  var model = getGeminiModel_();
  var url = GEMINI_API_BASE_URL + model + ':generateContent?key=' + encodeURIComponent(apiKey);

  var body = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (options && options.responseSchema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: options.responseSchema,
    };
  }

  var response = fetchGeminiWithRetry_(
    url,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    },
    model
  );

  var json = JSON.parse(response.getContentText());
  var candidate = json.candidates && json.candidates[0];
  var part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  var text = part && part.text;

  if (text === undefined) {
    Logger.log('callGemini_: unexpected response format: ' + response.getContentText());
    throw new Error('Gemini APIのレスポンス形式が想定と異なります。詳細はスクリプトの実行ログを確認してください。');
  }

  return options && options.responseSchema ? JSON.parse(text) : text;
}

// 現在利用可能なGeminiモデル一覧を取得する（generateContentに対応するモデルのみ）。
// モデル名を推測せず、実際にAPIから取得した名前で確認するためのデバッグ用ヘルパー。
function listAvailableGeminiModels_() {
  var apiKey = getGeminiApiKey_();
  if (!apiKey) {
    throw new Error('Gemini APIキーが未設定です。スクリプトプロパティ「GEMINI_API_KEY」を設定してください。');
  }
  var url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) {
    throw new Error('モデル一覧の取得に失敗しました（HTTP ' + response.getResponseCode() + '）: ' + response.getContentText());
  }
  var json = JSON.parse(response.getContentText());
  return (json.models || [])
    .filter(function (m) {
      return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
    })
    .map(function (m) {
      return m.name.replace(/^models\//, '');
    });
}

// タイムアウト等のネットワーク例外、およびHTTP429/5xxを指数バックオフでリトライする。
// それ以外のHTTPエラー（4xxの認証エラー・不正リクエスト等）は再試行せず即座に投げる。
// ネットワーク例外・レスポンス本文はAPIキーを含むURLや内部情報を含み得るため、
// 詳細はLogger.logにのみ出力し、throwするメッセージには含めない。
function fetchGeminiWithRetry_(url, fetchOptions, model) {
  var attempt = 0;

  while (true) {
    var response;
    try {
      response = UrlFetchApp.fetch(url, fetchOptions);
    } catch (networkErr) {
      Logger.log('fetchGeminiWithRetry_: network error on attempt ' + attempt + ': ' + networkErr.message);
      if (attempt >= GEMINI_MAX_RETRIES) {
        throw new Error(
          'Gemini API（モデル: ' + model + '）への接続に失敗しました（' + attempt + '回リトライ後）。詳細はスクリプトの実行ログを確認してください。'
        );
      }
      Utilities.sleep(GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      attempt++;
      continue;
    }

    var statusCode = response.getResponseCode();

    if (statusCode === 429 || statusCode >= 500) {
      Logger.log('fetchGeminiWithRetry_: HTTP ' + statusCode + ' on attempt ' + attempt + ': ' + response.getContentText());
      if (attempt >= GEMINI_MAX_RETRIES) {
        throw new Error(
          'Gemini API（モデル: ' + model + '）が一時的なエラーを返しました（HTTP ' + statusCode + '、' + attempt + '回リトライ後）。詳細はスクリプトの実行ログを確認してください。'
        );
      }
      Utilities.sleep(GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      attempt++;
      continue;
    }

    if (statusCode >= 300) {
      Logger.log('fetchGeminiWithRetry_: HTTP ' + statusCode + ': ' + response.getContentText());
      throw new Error(
        'Gemini API（モデル: ' + model + '）の呼び出しに失敗しました（HTTP ' + statusCode + '）。詳細はスクリプトの実行ログを確認してください。'
      );
    }

    return response;
  }
}
