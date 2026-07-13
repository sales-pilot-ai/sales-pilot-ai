// 営業メールテンプレート管理（Sprint7⑤）。Sprint3 Step5では件名・本文を1種類のみの
// 固定テンプレートとしていたが、テンプレート管理画面から複数テンプレートを作成・編集・削除・
// デフォルト切り替えできるよう、Sheets（新規タブ「営業メールテンプレート」）へ移行する。
// 本文は{{personalizedNote}}{{salesPersonName}}{{salesPersonTel}}{{salesPersonMail}}
// {{timeRexUrl}}のプレースホルダーを持ち、送信時に実際の値へ置換する（Config/SalesEmailTemplate.js参照）。

var SALES_TEMPLATE_SHEET_NAME = '営業メールテンプレート';

var SALES_TEMPLATE_HEADERS = ['テンプレートID', '表示名', '件名', '本文テンプレート', 'デフォルト', '作成日時', '更新日時'];

// Sprint3 Step5で固定化されていた正式テンプレートの内容をそのまま初期データとして
// 移行する（既存の送信内容を変えないため）。
var SALES_TEMPLATE_SEED_SUBJECT = '【ご提案】SNSショート動画制作のご支援について｜INNOZERO RETAILING';

var SALES_TEMPLATE_SEED_BODY = [
  '突然のご連絡失礼いたします。\n株式会社イノゼロリテイリング、営業部の{{salesPersonName}}と申します。',
  '弊社はTikTok・Meta・YouTube向けのショート動画制作を中心に、\nSNSアカウント運用代行・漫画LP・記事LP制作まで一気通貫でご支援しております。',
  '{{personalizedNote}}',
  '現在、SNS広告市場の急速な拡大に伴い、支援実績のある業界を中心に\n順次ご提案させていただいております。',
  '他社との大きな違いは、弊社自身が月間8,000万円規模のSNS広告を運用している点です。\n代理店として制作するだけでなく、自らも広告主として勝ちにいった経験があるからこそ、\n再生数ではなく"売上"にコミットしたご支援が可能です。',
  'もし現在、SNS運用や動画広告の強化をご検討されていましたら、\nまずは15〜30分ほど、ご都合のよいお時間をいただけますと幸いです。\n\n▼ ご都合のよい日程はこちらからお選びください\n{{timeRexUrl}}',
  'ご多忙のところ恐縮ですが、ご検討のほどよろしくお願いいたします。',
  '━━━━━━━━━━━━━━━━━━━━━━\n【弊社実績】\n・累計動画制作本数：50,000本以上\n・TikTok For Business Agency Award：6冠\n・月間自社SNS広告運用規模：8,000万円\n・Yahoo!マーケティングソリューション セールスパートナー認定\n・LINEヤフー 2024年度上半期 Sales Partner Certified\n・オスカープロモーション所属タレントの起用実績あり\n・有名インフルエンサーとの制作実績多数\n━━━━━━━━━━━━━━━━━━━━━━\n株式会社イノゼロリテイリング\n営業部　{{salesPersonName}}\nTEL：{{salesPersonTel}}\nMAIL：{{salesPersonMail}}\nWEB：innozero-retailing.com',
].join('\n\n');

function getSalesTemplateSheet_() {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  var sheet = spreadsheet.getSheetByName(SALES_TEMPLATE_SHEET_NAME);
  var isNewSheet = false;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SALES_TEMPLATE_SHEET_NAME);
    isNewSheet = true;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SALES_TEMPLATE_HEADERS);
    isNewSheet = true;
  } else {
    ensureHeaders_(sheet, SALES_TEMPLATE_HEADERS);
  }

  if (isNewSheet) {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow(['T000001', '初回アプローチ（標準）', SALES_TEMPLATE_SEED_SUBJECT, SALES_TEMPLATE_SEED_BODY, 'Y', now, now]);
  }

  return sheet;
}

function rowToSalesTemplate_(headerIndex, row) {
  return {
    templateId: row[headerIndex['テンプレートID']],
    displayName: row[headerIndex['表示名']],
    subject: row[headerIndex['件名']],
    bodyTemplate: row[headerIndex['本文テンプレート']],
    isDefault: row[headerIndex['デフォルト']] === 'Y',
    createdAt: row[headerIndex['作成日時']],
    updatedAt: row[headerIndex['更新日時']],
  };
}

function listSalesTemplates_() {
  var sheet = getSalesTemplateSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headerIndex = buildHeaderIndex_(values[0]);
  var templates = [];
  for (var i = 1; i < values.length; i++) {
    templates.push(rowToSalesTemplate_(headerIndex, values[i]));
  }
  return templates;
}

function getSalesTemplateById_(templateId) {
  var templates = listSalesTemplates_();
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].templateId === templateId) {
      return templates[i];
    }
  }
  return null;
}

function getDefaultSalesTemplate_() {
  var templates = listSalesTemplates_();
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].isDefault) {
      return templates[i];
    }
  }
  // デフォルトフラグがどの行にも立っていない場合のフォールバック（想定外の状態からの復旧用）。
  return templates.length > 0 ? templates[0] : null;
}

function nextSalesTemplateId_() {
  var templates = listSalesTemplates_();
  var maxNumber = 0;
  templates.forEach(function (t) {
    var match = /^T(\d+)$/.exec(t.templateId);
    if (match) {
      maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
    }
  });
  var nextNumber = maxNumber + 1;
  var padded = String(nextNumber);
  while (padded.length < 6) {
    padded = '0' + padded;
  }
  return 'T' + padded;
}

// 表示名・件名・本文テンプレートを指定して新規作成する。isDefaultは指定しない限り'N'
// （最初の1件はgetSalesTemplateSheet_()のシート初期化時にデフォルトとして作成済みのため、
// 通常の新規作成では常に非デフォルトから始まる）。
function createSalesTemplate_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSalesTemplateSheet_();
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var templateId = nextSalesTemplateId_();
    sheet.appendRow([
      templateId,
      data.displayName || '',
      data.subject || '',
      data.bodyTemplate || '',
      'N',
      now,
      now,
    ]);
    return getSalesTemplateById_(templateId);
  } finally {
    lock.releaseLock();
  }
}

function findSalesTemplateRowIndex_(sheet, templateId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }
  var idCol = buildHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0])['テンプレートID'];
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === templateId) {
      return i + 2;
    }
  }
  return -1;
}

function updateSalesTemplate_(templateId, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSalesTemplateSheet_();
    var rowIndex = findSalesTemplateRowIndex_(sheet, templateId);
    if (rowIndex === -1) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    var headerIndex = buildHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    if (data.displayName !== undefined) {
      sheet.getRange(rowIndex, headerIndex['表示名'] + 1).setValue(data.displayName);
    }
    if (data.subject !== undefined) {
      sheet.getRange(rowIndex, headerIndex['件名'] + 1).setValue(data.subject);
    }
    if (data.bodyTemplate !== undefined) {
      sheet.getRange(rowIndex, headerIndex['本文テンプレート'] + 1).setValue(data.bodyTemplate);
    }
    sheet.getRange(rowIndex, headerIndex['更新日時'] + 1).setValue(now);
    return getSalesTemplateById_(templateId);
  } finally {
    lock.releaseLock();
  }
}

// 削除対象がデフォルトテンプレートの場合や、最後の1件の場合は削除できない
// （営業メール生成が必ず1つのデフォルトテンプレートを参照できる状態を保つため）。
function deleteSalesTemplate_(templateId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var templates = listSalesTemplates_();
    if (templates.length <= 1) {
      throw new Error('最後の1件のテンプレートは削除できません。');
    }
    var target = templates.filter(function (t) {
      return t.templateId === templateId;
    })[0];
    if (!target) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    if (target.isDefault) {
      throw new Error('デフォルトテンプレートは削除できません。先に他のテンプレートをデフォルトに設定してください。');
    }

    var sheet = getSalesTemplateSheet_();
    var rowIndex = findSalesTemplateRowIndex_(sheet, templateId);
    if (rowIndex === -1) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    sheet.deleteRow(rowIndex);
  } finally {
    lock.releaseLock();
  }
}

// 指定したテンプレートをデフォルトにする（他の全行のデフォルトフラグは解除する）。
function setDefaultSalesTemplate_(templateId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSalesTemplateSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    var headerIndex = buildHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    var idCol = headerIndex['テンプレートID'];
    var defaultCol = headerIndex['デフォルト'];
    var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();

    var found = false;
    for (var i = 0; i < ids.length; i++) {
      var isTarget = ids[i][0] === templateId;
      if (isTarget) {
        found = true;
      }
      sheet.getRange(i + 2, defaultCol + 1).setValue(isTarget ? 'Y' : 'N');
    }
    if (!found) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    return getSalesTemplateById_(templateId);
  } finally {
    lock.releaseLock();
  }
}
