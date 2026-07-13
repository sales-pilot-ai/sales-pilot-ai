// Places API (New) 呼び出し（UrlFetchApp、現行CLI版 src/providers/google-maps.js 相当）
// 設計書⑨の制約により、メール取得は現行のPlaywright解析ではなく
// UrlFetchAppで取得できるHTMLからの簡易正規表現抽出に縮退する。

var PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
var PLACES_DETAILS_URL_BASE = 'https://places.googleapis.com/v1/places/';
var PLACES_PAGE_SIZE = 20;

// mailto:リンクを最優先で抽出する（最も確実なため）。
var MAILTO_PATTERN =
  /mailto:([a-zA-Z0-9.!#$%&'*+=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})/i;

// mailto:が見つからない場合、本文中の通常のメールアドレス文字列を抽出する。
// ローカル部に「/」を含めない・末尾ラベル（TLD相当）を英字2文字以上に限定することで、
// 「cdn.jsdelivr.net/npm/destyle.css@3.0.2」のようなCDN/バージョン文字列の誤検出を防ぐ。
var EMAIL_SCRAPE_PATTERN =
  /[a-zA-Z0-9.!#$%&'*+=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/;

// STEP3: リンクのhref・リンクテキストのいずれかにこれらのキーワードを含む<a>タグを
// 「お問い合わせフォームへのリンク」とみなす。
var CONTACT_LINK_PATTERN = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
var CONTACT_KEYWORDS = ['お問い合わせ', 'お問合せ', '問い合わせ', '問合せ', 'contact', 'inquiry', 'toiawase'];

// hrefが相対URLの場合、Webサイトのトップページのアドレスを基準に絶対URLへ変換する。
function resolveUrl_(baseUrl, href) {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }
  if (href.indexOf('//') === 0) {
    return 'https:' + href;
  }
  var originMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i);
  var origin = originMatch ? originMatch[1] : baseUrl;
  if (href.indexOf('/') === 0) {
    return origin + href;
  }
  var baseDir = baseUrl.replace(/[^/]*$/, '');
  return baseDir + href;
}

// mailto:/tel:/javascript: 等はフォームURLではないため除外する。
var NON_FORM_LINK_SCHEME_PATTERN = /^(mailto|tel|sms|javascript|fax):/i;

// STEP3: HTML内の<a>タグから、お問い合わせフォームらしきリンクを1件だけ抽出する。
function findContactFormUrl_(html, baseUrl) {
  var pattern = new RegExp(CONTACT_LINK_PATTERN.source, CONTACT_LINK_PATTERN.flags);
  var match;
  while ((match = pattern.exec(html)) !== null) {
    var href = match[1].trim();
    if (NON_FORM_LINK_SCHEME_PATTERN.test(href)) {
      continue; // mailto:等はリンクテキストがキーワードに一致してもフォームURLとして扱わない
    }
    var text = match[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
    var hrefLower = href.toLowerCase();
    var isContactLink = CONTACT_KEYWORDS.some(function (keyword) {
      var kw = keyword.toLowerCase();
      return hrefLower.indexOf(kw) !== -1 || text.indexOf(kw) !== -1;
    });
    if (isContactLink) {
      return resolveUrl_(baseUrl, href);
    }
  }
  return null;
}

function searchPlacesTextPage_(apiKey, textQuery, pageToken) {
  var body = { textQuery: textQuery, languageCode: 'ja', pageSize: PLACES_PAGE_SIZE };
  if (pageToken) {
    body.pageToken = pageToken;
  }
  var response = UrlFetchApp.fetch(PLACES_SEARCH_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'nextPageToken,places.id,places.displayName,places.formattedAddress,places.businessStatus',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) {
    throw new Error('Places API検索でエラーが発生しました: ' + response.getContentText());
  }
  return JSON.parse(response.getContentText() || '{}');
}

function getPlaceDetails_(apiKey, placeId) {
  var response = UrlFetchApp.fetch(PLACES_DETAILS_URL_BASE + placeId, {
    method: 'get',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri',
    },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) {
    return {};
  }
  return JSON.parse(response.getContentText() || '{}');
}

// Webサイトを取得し、メールアドレス・問い合わせフォームURLを抽出する。
// 取得できなかった理由・解析したURL・どこまで処理できたかを診断情報として返す（設計書要件⑤対応）。
function analyzeWebsite_(websiteUrl) {
  var diagnosis = {
    analyzedUrl: websiteUrl || null,
    httpStatus: null,
    success: false,
    error: null,
    email: null,
    emailError: null,
    contactFormUrl: null,
    contactFormError: null,
  };

  if (!websiteUrl) {
    diagnosis.error = 'ホームページURLが取得できなかったため、Webサイト解析をスキップしました';
    return diagnosis;
  }

  var html;
  try {
    var response = UrlFetchApp.fetch(websiteUrl, { muteHttpExceptions: true, followRedirects: true });
    diagnosis.httpStatus = response.getResponseCode();
    if (diagnosis.httpStatus >= 300) {
      diagnosis.error = 'Webサイトの取得に失敗しました（HTTP ' + diagnosis.httpStatus + '）';
      return diagnosis;
    }
    diagnosis.success = true;
    html = response.getContentText();
  } catch (err) {
    diagnosis.error = 'Webサイトの取得中にエラーが発生しました: ' + err.message;
    return diagnosis;
  }

  var mailtoMatch = html.match(MAILTO_PATTERN);
  if (mailtoMatch) {
    diagnosis.email = mailtoMatch[1];
  } else {
    // ライブラリのバージョン表記（例: jquery@3.6.0.min.js）が「.js」「.css」で終わる
    // ドメイン風の文字列にマッチしてしまうことがあるため、そのようなものは除外する。
    var candidates = html.match(new RegExp(EMAIL_SCRAPE_PATTERN.source, 'g')) || [];
    var validEmail = candidates.filter(function (candidate) {
      return !/\.(js|css)$/i.test(candidate);
    })[0];
    if (validEmail) {
      diagnosis.email = validEmail;
    } else {
      diagnosis.emailError = 'ページ内にメールアドレスが見つかりませんでした';
    }
  }

  var contactFormUrl = findContactFormUrl_(html, websiteUrl);
  if (contactFormUrl) {
    diagnosis.contactFormUrl = contactFormUrl;
  } else {
    diagnosis.contactFormError = 'お問い合わせフォームらしきリンクが見つかりませんでした';
  }

  return diagnosis;
}

// 業種・エリアからPlaces API (New) で企業候補を検索する。この時点では営業リストへ保存しない。
function searchCompaniesViaMaps_(params) {
  var apiKey = getMapsApiKey_();
  if (!apiKey) {
    throw new Error(
      'Google Maps APIキーが未設定です。スクリプトプロパティ「MAPS_API_KEY」を設定してください。'
    );
  }

  var industry = String((params && params.industry) || '').trim();
  var area = String((params && params.area) || '').trim();
  var limit = Math.max(1, Math.min(50, Number((params && params.limit) || 20)));
  var skipAnalyzer = !!(params && params.skipAnalyzer);

  if (!industry && !area) {
    throw new Error('業種またはエリアを入力してください');
  }

  var textQuery = [industry, area].filter(Boolean).join(' ');
  var places = [];
  var pageToken = null;
  do {
    var page = searchPlacesTextPage_(apiKey, textQuery, pageToken);
    places = places.concat(page.places || []);
    pageToken = page.nextPageToken || null;
    if (pageToken && places.length < limit) {
      Utilities.sleep(1500); // nextPageTokenが有効になるまでの待機（現行CLI版と同じ待機時間）
    }
  } while (pageToken && places.length < limit);

  places = places.slice(0, limit);

  // 件数が多いとWebサイト解析（外部サイトへのHTTPアクセス）分だけ実行時間が伸びる。
  // Apps Scriptの実行時間上限（6分）に近づく規模になった場合は、時間主導トリガーによる
  // 分割継続実行の導入を検討する（設計書⑨参照）。
  return places.map(function (place) {
    var details = getPlaceDetails_(apiKey, place.id);
    var websiteUrl = details.websiteUri || '';
    var analysis = skipAnalyzer ? null : analyzeWebsite_(websiteUrl);

    return {
      placeId: place.id,
      companyName: (place.displayName && place.displayName.text) || '',
      industry: industry,
      area: area,
      address: place.formattedAddress || '',
      phone: details.internationalPhoneNumber || '',
      websiteUrl: websiteUrl,
      email: analysis && analysis.email ? analysis.email : '',
      contactFormUrl: analysis && analysis.contactFormUrl ? analysis.contactFormUrl : '',
      analysis: analysis, // Webサイト解析の診断情報（画面表示用）。
    };
  });
}
