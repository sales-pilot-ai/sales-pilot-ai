// 権限管理（Sprint8）。ログイン中のGoogleアカウント（Session.getActiveUser().getEmail()）を
// 「権限」シートと突き合わせ、ロール（Admin/User）を判定する。Router層の全公開関数は、
// requireUser_()またはrequireAdmin_()を入口で必ず呼び出し、サーバー側で権限チェックを行う
// （クライアント側の表示切り替えだけに依存しない。設計制約⑥参照）。

var PERMISSION_SHEET_NAME = '権限';
// 電話番号・送信者メールは、Gmail設定（送信者情報）のユーザーごとの個別管理化（追加依頼）で
// 追加した列。ensureHeaders_により既存シートにも自動で追記される。
var PERMISSION_HEADERS = ['メールアドレス', '名前', '権限', '作成日時', '最終ログイン日時', '電話番号', '送信者メール'];
var USER_ROLE = { ADMIN: 'Admin', USER: 'User' };

// 「権限が設定されていません」画面をクライアント側で判定するための専用エラーメッセージ。
// Views/Index.htmlのgetCurrentUser()失敗ハンドラーがこの文言を見て専用画面に切り替える。
var UNREGISTERED_USER_MESSAGE = '権限が設定されていません。管理者に連絡してください。';

function getPermissionSheet_() {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  var sheet = spreadsheet.getSheetByName(PERMISSION_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PERMISSION_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(PERMISSION_HEADERS);
  } else {
    ensureHeaders_(sheet, PERMISSION_HEADERS);
  }
  return sheet;
}

// ヘッダーセルの前後に不可視の空白が混入していても列を正しく照合できるよう、
// トリムしてからbuildHeaderIndex_（共通関数）に渡す（タスクB: ヘッダー名不一致対策）。
function buildPermissionHeaderIndex_(headerRow) {
  return buildHeaderIndex_(
    headerRow.map(function (header) {
      return String(header || '').trim();
    })
  );
}

// Sheetsが日付として解釈した値はDateオブジェクトで返ってくるため、google.script.runで
// シリアライズできるよう文字列に変換する（MapperService.jsのrowToCompany_と同じ対処。
// タスクB: Dateシリアライズ対策）。
function formatPermissionDateValue_(value) {
  return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : value;
}

function rowToUser_(headerIndex, row) {
  return {
    email: row[headerIndex['メールアドレス']],
    name: row[headerIndex['名前']],
    role: row[headerIndex['権限']],
    createdAt: formatPermissionDateValue_(row[headerIndex['作成日時']]),
    lastLoginAt: formatPermissionDateValue_(row[headerIndex['最終ログイン日時']]),
    tel: row[headerIndex['電話番号']],
    senderMail: row[headerIndex['送信者メール']],
  };
}

// 権限シートの全ユーザーを返す（ユーザー管理画面用）。
function listUsers_() {
  var sheet = getPermissionSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headerIndex = buildPermissionHeaderIndex_(values[0]);
  var users = [];
  for (var i = 1; i < values.length; i++) {
    users.push(rowToUser_(headerIndex, values[i]));
  }
  return users;
}

function findUserRowIndexByEmail_(sheet, email) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }
  var emailCol = buildPermissionHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0])['メールアドレス'];
  var emails = sheet.getRange(2, emailCol + 1, lastRow - 1, 1).getValues();
  var target = String(email || '').trim().toLowerCase();
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0] || '').trim().toLowerCase() === target) {
      return i + 2;
    }
  }
  return -1;
}

function findUserByEmail_(email) {
  return listUsers_().filter(function (u) {
    return String(u.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase();
  })[0] || null;
}

function countAdmins_(users) {
  return users.filter(function (u) {
    return u.role === USER_ROLE.ADMIN;
  }).length;
}

// ログイン中のGoogleアカウントを権限シートと照合する。未登録の場合はnullを返す
// （呼び出し元のrequireUser_()がエラーに変換する）。
//
// 権限シートが完全に空（1件もユーザー登録がない）の場合、デプロイ直後に全員が
// アクセス不可になる事故を防ぐため、最初にアプリへアクセスした人を自動的にAdminとして
// 登録する（bootstrap）。2人目以降のアクセス時にはこの分岐は通らない
// （権限シートが空でなくなっているため）。
function getCurrentUserContext_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    return null;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getPermissionSheet_();

    // ユーザーの有無はlistUsers_()の呼び出し結果ではなく、シートの行数で直接判定する
    // （タスクB: listUsers_()の全件読み取り・整形処理にbootstrap判定を依存させない）。
    if (sheet.getLastRow() < 2) {
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      var defaultName = String(email).split('@')[0];
      sheet.appendRow([email, defaultName, USER_ROLE.ADMIN, now, now]);
      return { email: email, name: defaultName, role: USER_ROLE.ADMIN };
    }

    var rowIndex = findUserRowIndexByEmail_(sheet, email);
    if (rowIndex === -1) {
      return null;
    }

    var headerIndex = buildPermissionHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    var lastLoginCol = headerIndex['最終ログイン日時'];
    var loginNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(rowIndex, lastLoginCol + 1).setValue(loginNow);

    var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    return rowToUser_(headerIndex, row);
  } finally {
    lock.releaseLock();
  }
}

// Router層の各公開関数の先頭で呼ぶ。未登録ユーザーの場合はUNREGISTERED_USER_MESSAGEを
// メッセージとしてthrowする（google.script.runのwithFailureHandlerでerror.messageとして
// 受け取れる）。
function requireUser_() {
  var user = getCurrentUserContext_();
  if (!user) {
    throw new Error(UNREGISTERED_USER_MESSAGE);
  }
  return user;
}

// Admin専用のRouter関数の先頭で呼ぶ。
function requireAdmin_() {
  var user = requireUser_();
  if (user.role !== USER_ROLE.ADMIN) {
    throw new Error('この操作にはAdmin権限が必要です。');
  }
  return user;
}

// ユーザー管理画面（Sprint8⑤、設定画面内・Admin専用）。

function createUser_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!data.email || !data.name || !data.role) {
      throw new Error('名前・メールアドレス・権限はすべて入力してください。');
    }
    if (data.role !== USER_ROLE.ADMIN && data.role !== USER_ROLE.USER) {
      throw new Error('権限はAdminまたはUserのいずれかを指定してください。');
    }
    var sheet = getPermissionSheet_();
    if (findUserRowIndexByEmail_(sheet, data.email) !== -1) {
      throw new Error('このメールアドレスは既に登録されています。');
    }
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([data.email, data.name, data.role, now, '']);
    return findUserByEmail_(data.email);
  } finally {
    lock.releaseLock();
  }
}

// 名前変更。メールアドレス・権限・作成日時・最終ログイン日時には影響しない。権限変更・削除に
// ある「自分自身は不可」の保護は名前の変更には適用しない（自分自身の名前も変更できる）。
function updateUserName_(email, name) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new Error('名前を入力してください。');
    }
    var sheet = getPermissionSheet_();
    var rowIndex = findUserRowIndexByEmail_(sheet, email);
    if (rowIndex === -1) {
      throw new Error('ユーザーが見つかりません（' + email + '）。');
    }
    var headerIndex = buildPermissionHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    sheet.getRange(rowIndex, headerIndex['名前'] + 1).setValue(trimmedName);
    return findUserByEmail_(email);
  } finally {
    lock.releaseLock();
  }
}

// role変更。Adminが最後の1人の場合、その1人をUserへ変更することは禁止する。
function updateUserRole_(email, role) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (role !== USER_ROLE.ADMIN && role !== USER_ROLE.USER) {
      throw new Error('権限はAdminまたはUserのいずれかを指定してください。');
    }
    var sheet = getPermissionSheet_();
    var rowIndex = findUserRowIndexByEmail_(sheet, email);
    if (rowIndex === -1) {
      throw new Error('ユーザーが見つかりません（' + email + '）。');
    }
    var users = listUsers_();
    var target = findUserByEmail_(email);
    if (target.role === USER_ROLE.ADMIN && role === USER_ROLE.USER && countAdmins_(users) <= 1) {
      throw new Error('最後の1人のAdminの権限は変更できません。先に他のユーザーをAdminに設定してください。');
    }
    var headerIndex = buildPermissionHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    sheet.getRange(rowIndex, headerIndex['権限'] + 1).setValue(role);
    return findUserByEmail_(email);
  } finally {
    lock.releaseLock();
  }
}

// 削除。自分自身の削除・最後の1人のAdminの削除は禁止する。currentEmailは呼び出し元
// （Router）でrequireAdmin_()が返したユーザーのメールアドレスを渡す。
function deleteUser_(email, currentEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (String(email || '').trim().toLowerCase() === String(currentEmail || '').trim().toLowerCase()) {
      throw new Error('自分自身は削除できません。');
    }
    var sheet = getPermissionSheet_();
    var rowIndex = findUserRowIndexByEmail_(sheet, email);
    if (rowIndex === -1) {
      throw new Error('ユーザーが見つかりません（' + email + '）。');
    }
    var users = listUsers_();
    var target = findUserByEmail_(email);
    if (target.role === USER_ROLE.ADMIN && countAdmins_(users) <= 1) {
      throw new Error('最後の1人のAdminは削除できません。');
    }
    sheet.deleteRow(rowIndex);
  } finally {
    lock.releaseLock();
  }
}

// Gmail設定（送信者情報、追加依頼）: 営業メール・返信メールの署名に使う名前・電話番号・
// メールアドレスを、共通のScript Propertiesではなくユーザーごとに権限シート上で管理する。
// 名前は既存の「名前」列（サイドバー表示・ユーザー管理と共通）をそのまま使う。
//
// 電話番号・送信者メールが未設定（列追加直後でまだ個別に保存していない）の場合は、
// 移行前の共通設定値（Script Properties、Config/Settings.js）へフォールバックする。
// 「初回は共通設定と同じ値からスタートし、以降は個別に編集できる」という要件を、
// 別途の一括移行処理を用意せず、読み取り時のフォールバックだけで満たすための実装。
// 送信者メールが共通設定にも無い場合は、ログイン中のGoogleアカウントのメールアドレスを
// 既定値として使う。
function getSenderInfoForUser_(email) {
  var user = findUserByEmail_(email);
  if (!user) {
    throw new Error('ユーザーが見つかりません（' + email + '）。');
  }
  var props = PropertiesService.getScriptProperties();
  return {
    name: user.name,
    tel: user.tel || props.getProperty(SETTINGS_KEYS.SALES_PERSON_TEL) || '',
    mail: user.senderMail || props.getProperty(SETTINGS_KEYS.SALES_PERSON_MAIL) || user.email,
  };
}

// 自分自身の送信者情報の更新。emailは呼び出し元（Router）でrequireUser_()が返した
// 本人のメールアドレスを渡す想定で、他人の情報を書き換えることはできない。
// 名前・電話番号・メールアドレスはすべて必須（空欄は拒否する）。
function updateSenderInfoForUser_(email, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var trimmedName = String((data && data.name) || '').trim();
    var trimmedTel = String((data && data.tel) || '').trim();
    var trimmedMail = String((data && data.mail) || '').trim();
    if (!trimmedName || !trimmedTel || !trimmedMail) {
      throw new Error('担当者名・電話番号・メールアドレスはすべて入力してください。');
    }
    var sheet = getPermissionSheet_();
    var rowIndex = findUserRowIndexByEmail_(sheet, email);
    if (rowIndex === -1) {
      throw new Error('ユーザーが見つかりません（' + email + '）。');
    }
    var headerIndex = buildPermissionHeaderIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    sheet.getRange(rowIndex, headerIndex['名前'] + 1).setValue(trimmedName);
    sheet.getRange(rowIndex, headerIndex['電話番号'] + 1).setValue(trimmedTel);
    sheet.getRange(rowIndex, headerIndex['送信者メール'] + 1).setValue(trimmedMail);
    return getSenderInfoForUser_(email);
  } finally {
    lock.releaseLock();
  }
}
