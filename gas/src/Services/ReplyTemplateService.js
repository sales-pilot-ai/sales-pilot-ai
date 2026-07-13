// 返信テンプレート（Sprint5 Step2で固定4種類のオブジェクトとして新設、Sprint7⑤で
// テンプレート管理画面から作成・編集・削除できるようSheets（新規タブ「返信テンプレート」）へ移行）。
// 受信メール詳細画面で、AI返信とは別にワンクリックで挿入できる定型文を提供する。Geminiは使用しない。

var REPLY_TEMPLATE_SHEET_NAME = '返信テンプレート';

var REPLY_TEMPLATE_HEADERS = ['テンプレートID', '表示名', '本文', '作成日時', '更新日時'];

// Sprint5 Step2で固定オブジェクトとして定義されていた4種類をそのまま初期データとして移行する
// （既存のInbox画面のクイック返信ボタンの内容を変えないため）。
var REPLY_TEMPLATE_SEEDS = [
  { displayName: '資料送付', body: 'お問い合わせありがとうございます。\n\n資料を添付いたしますのでご確認ください。\n\nよろしくお願いいたします。' },
  { displayName: '日程調整', body: 'お問い合わせありがとうございます。\n\nご都合の良い日時をいくつかお知らせいただけますでしょうか。\n\nよろしくお願いいたします。' },
  { displayName: 'お礼', body: 'ご連絡ありがとうございます。\n\n今後ともよろしくお願いいたします。' },
  { displayName: 'お断り', body: 'ご連絡ありがとうございます。\n\n誠に恐縮ですが今回は見送らせていただきます。\n\nよろしくお願いいたします。' },
];

function getReplyTemplateSheet_() {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  var sheet = spreadsheet.getSheetByName(REPLY_TEMPLATE_SHEET_NAME);
  var isNewSheet = false;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(REPLY_TEMPLATE_SHEET_NAME);
    isNewSheet = true;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(REPLY_TEMPLATE_HEADERS);
    isNewSheet = true;
  } else {
    ensureHeaders_(sheet, REPLY_TEMPLATE_HEADERS);
  }

  if (isNewSheet) {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    REPLY_TEMPLATE_SEEDS.forEach(function (seed, index) {
      var padded = String(index + 1);
      while (padded.length < 6) {
        padded = '0' + padded;
      }
      sheet.appendRow(['R' + padded, seed.displayName, seed.body, now, now]);
    });
  }

  return sheet;
}

function rowToReplyTemplate_(headerIndex, row) {
  return {
    templateId: row[headerIndex['テンプレートID']],
    displayName: row[headerIndex['表示名']],
    body: row[headerIndex['本文']],
    createdAt: row[headerIndex['作成日時']],
    updatedAt: row[headerIndex['更新日時']],
  };
}

// Inbox画面のクイック返信ボタン・テンプレート管理画面の両方から使う一覧取得（読み取り専用）。
function getReplyTemplates_() {
  var sheet = getReplyTemplateSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headerIndex = buildHeaderIndex_(values[0]);
  var templates = [];
  for (var i = 1; i < values.length; i++) {
    templates.push(rowToReplyTemplate_(headerIndex, values[i]));
  }
  return templates;
}

function nextReplyTemplateId_() {
  var templates = getReplyTemplates_();
  var maxNumber = 0;
  templates.forEach(function (t) {
    var match = /^R(\d+)$/.exec(t.templateId);
    if (match) {
      maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
    }
  });
  var nextNumber = maxNumber + 1;
  var padded = String(nextNumber);
  while (padded.length < 6) {
    padded = '0' + padded;
  }
  return 'R' + padded;
}

function findReplyTemplateRowIndex_(sheet, templateId) {
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

function createReplyTemplate_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getReplyTemplateSheet_();
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var templateId = nextReplyTemplateId_();
    sheet.appendRow([templateId, data.displayName || '', data.body || '', now, now]);
    return { templateId: templateId, displayName: data.displayName || '', body: data.body || '', createdAt: now, updatedAt: now };
  } finally {
    lock.releaseLock();
  }
}

function updateReplyTemplate_(templateId, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getReplyTemplateSheet_();
    var rowIndex = findReplyTemplateRowIndex_(sheet, templateId);
    if (rowIndex === -1) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    var headerIndex = buildHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    if (data.displayName !== undefined) {
      sheet.getRange(rowIndex, headerIndex['表示名'] + 1).setValue(data.displayName);
    }
    if (data.body !== undefined) {
      sheet.getRange(rowIndex, headerIndex['本文'] + 1).setValue(data.body);
    }
    sheet.getRange(rowIndex, headerIndex['更新日時'] + 1).setValue(now);
  } finally {
    lock.releaseLock();
  }
}

function deleteReplyTemplate_(templateId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getReplyTemplateSheet_();
    var rowIndex = findReplyTemplateRowIndex_(sheet, templateId);
    if (rowIndex === -1) {
      throw new Error('テンプレートが見つかりません（' + templateId + '）');
    }
    sheet.deleteRow(rowIndex);
  } finally {
    lock.releaseLock();
  }
}
