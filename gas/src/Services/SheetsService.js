// 営業リストのCRUD（現行CLI版 src/sheets/service.js 相当）

function getCompanySheet_() {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  var sheet = spreadsheet.getSheetByName(COMPANY_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(COMPANY_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COMPANY_HEADERS);
    return sheet;
  }
  ensureHeaders_(sheet, COMPANY_HEADERS);
  return sheet;
}

// 既存シートにCOMPANY_HEADERS等で新しく追加された列が無い場合、末尾に補って追加する
// （スキーマ拡張時に、稼働中のシートを手動で作り直さずに済むようにするため）。
function ensureHeaders_(sheet, requiredHeaders) {
  var lastCol = sheet.getLastColumn();
  var headerRow = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  requiredHeaders.forEach(function (header) {
    if (headerRow.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headerRow.push(header);
    }
  });
}

function readAllCompanies_() {
  var sheet = getCompanySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { headerIndex: buildHeaderIndex_(COMPANY_HEADERS), rows: [] };
  }
  var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headerIndex = buildHeaderIndex_(values[0]);
  var rows = values.slice(1).map(function (row, i) {
    return { sheetRow: i + 2, values: row };
  });
  return { headerIndex: headerIndex, rows: rows };
}

// キーワード・業種・送信状況・送信可否でフィルタした企業一覧を返す
function listCompaniesFromSheet_(filter) {
  filter = filter || {};
  var data = readAllCompanies_();
  var companies = data.rows.map(function (r) {
    return rowToCompany_(data.headerIndex, r.values);
  });

  if (filter.keyword) {
    var keyword = String(filter.keyword).toLowerCase();
    companies = companies.filter(function (c) {
      return (
        String(c.companyName || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(c.address || '').toLowerCase().indexOf(keyword) !== -1
      );
    });
  }
  if (filter.industry) {
    companies = companies.filter(function (c) {
      return c.industry === filter.industry;
    });
  }
  if (filter.sendStatus) {
    companies = companies.filter(function (c) {
      return c.sendStatus === filter.sendStatus;
    });
  }
  if (filter.sendApproval) {
    companies = companies.filter(function (c) {
      return c.sendApproval === filter.sendApproval;
    });
  }

  return companies;
}

// 企業IDから営業リストの1件を取得する（AI分析等、単体参照が必要な場面で使用）。
function findCompanyById_(companyId) {
  var data = readAllCompanies_();
  var idCol = data.headerIndex['企業ID'];
  for (var i = 0; i < data.rows.length; i++) {
    if (data.rows[i].values[idCol] === companyId) {
      return rowToCompany_(data.headerIndex, data.rows[i].values);
    }
  }
  return null;
}

// 営業リストシートの「AI要約」列を更新する（企業分析実行後に呼び出す）。
function updateCompanySummary_(companyId, summaryText) {
  var sheet = getCompanySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerIndex = buildHeaderIndex_(headerRow);
  var idCol = headerIndex['企業ID'];
  var summaryCol = headerIndex['AI要約'];
  if (idCol === undefined || summaryCol === undefined) {
    return;
  }
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === companyId) {
      sheet.getRange(i + 2, summaryCol + 1).setValue(summaryText);
      return;
    }
  }
}

// 営業リストシートの「送信状況」「送信日」列を更新する（営業メール送信成功後に呼び出す）。
function markCompanySent_(companyId, sentDate) {
  var sheet = getCompanySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerIndex = buildHeaderIndex_(headerRow);
  var idCol = headerIndex['企業ID'];
  var sendStatusCol = headerIndex['送信状況'];
  var sentDateCol = headerIndex['送信日'];
  if (idCol === undefined || sendStatusCol === undefined || sentDateCol === undefined) {
    return;
  }
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === companyId) {
      sheet.getRange(i + 2, sendStatusCol + 1).setValue(SEND_STATUS.SENT);
      sheet.getRange(i + 2, sentDateCol + 1).setValue(sentDate);
      return;
    }
  }
}

// 営業リストシートの「返信有無」列を更新する（Gmail返信同期で受信を検知した際に呼び出す）。
function markCompanyReplied_(companyId) {
  var sheet = getCompanySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerIndex = buildHeaderIndex_(headerRow);
  var idCol = headerIndex['企業ID'];
  var hasReplyCol = headerIndex['返信有無'];
  if (idCol === undefined || hasReplyCol === undefined) {
    return;
  }
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === companyId) {
      sheet.getRange(i + 2, hasReplyCol + 1).setValue('返信あり');
      return;
    }
  }
}

// 営業リストシートの「送信状況」列を任意の値に更新する（一括ステータス変更で使用。
// Sprint6 Step12）。markCompanySent_/markCompanyReplied_は特定の状態遷移専用に固定された
// 関数のため変更せず、値を引数で指定できる汎用版としてこちらを新設する。
function updateCompanyStatus_(companyId, status) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getCompanySheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }
    var lastCol = sheet.getLastColumn();
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var headerIndex = buildHeaderIndex_(headerRow);
    var idCol = headerIndex['企業ID'];
    var sendStatusCol = headerIndex['送信状況'];
    if (idCol === undefined || sendStatusCol === undefined) {
      return;
    }
    var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === companyId) {
        sheet.getRange(i + 2, sendStatusCol + 1).setValue(status);
        return;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function findCompanyByPlaceId_(data, placeId) {
  var placeIdCol = data.headerIndex['Place ID'];
  if (placeIdCol === undefined) {
    return null;
  }
  for (var i = 0; i < data.rows.length; i++) {
    if (data.rows[i].values[placeIdCol] === placeId) {
      return data.rows[i];
    }
  }
  return null;
}

function nextCompanyId_(data) {
  var idCol = data.headerIndex['企業ID'];
  var max = 0;
  data.rows.forEach(function (r) {
    var raw = String(r.values[idCol] || '');
    var match = raw.match(/^C(\d{6})$/);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  });
  var next = max + 1;
  return 'C' + ('000000' + next).slice(-6);
}

// 検索候補1件を営業リストへ保存する。Place IDが既存行と一致する場合は空欄フィールドのみ補完し、
// 手動編集済みの列（COMPANY_PROTECTED_HEADERS）は上書きしない。新規なら企業IDを採番して追記する。
function upsertCompanyCandidate_(candidate) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getCompanySheet_();
    var data = readAllCompanies_();
    var existing = candidate.placeId ? findCompanyByPlaceId_(data, candidate.placeId) : null;

    if (existing) {
      var updated = false;
      Object.keys(COMPANY_FIELD_TO_HEADER).forEach(function (field) {
        var header = COMPANY_FIELD_TO_HEADER[field];
        if (COMPANY_PROTECTED_HEADERS.indexOf(header) !== -1) {
          return;
        }
        var colIndex = data.headerIndex[header];
        if (colIndex === undefined) {
          return;
        }
        var currentValue = existing.values[colIndex];
        var candidateValue = candidate[field];
        if (!currentValue && candidateValue) {
          sheet.getRange(existing.sheetRow, colIndex + 1).setValue(candidateValue);
          updated = true;
        }
      });
      return { status: updated ? 'updated' : 'unchanged', companyId: existing.values[data.headerIndex['企業ID']] };
    }

    var companyId = nextCompanyId_(data);
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var row = companyToRow_(
      Object.assign({}, candidate, {
        companyId: companyId,
        updatedAt: now,
      })
    );
    sheet.appendRow(row);
    return { status: 'created', companyId: companyId };
  } finally {
    lock.releaseLock();
  }
}
