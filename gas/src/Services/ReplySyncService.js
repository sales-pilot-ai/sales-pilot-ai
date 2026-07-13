// 営業リストの「返信有無」を自動更新する（Sprint4 Step12）。
// メールアドレスが登録済みの企業について、そのメールアドレスからの受信メールが1件以上存在する場合、
// 「返信あり」に更新する。受信が存在しない場合は変更しない。
//
// 企業数が多い場合、1社ごとにGmail検索を行うため実行時間が伸びる点に留意する
// （Apps Scriptの実行時間上限。既存のMapsService.jsの検索処理と同様の制約）。

// 最終同期日時をScript Propertiesへ保存するためのキー（Sprint8追記）。
var REPLY_SYNC_LAST_SYNCED_AT_KEY = 'REPLY_SYNC_LAST_SYNCED_AT';

// 営業リストの全企業についてGmail受信を確認し、「返信あり」に更新した企業数を返す。
// 手動実行（返信確認タブのボタン）と時間主導型トリガーの両方から呼ばれる可能性があるため、
// LockServiceで二重実行を防止する（Sheets書き込みの整合性を守るため）。
function syncReplyStatus_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('返信の同期処理は既に実行中です。しばらくしてから再度お試しください。');
  }
  try {
    var data = readAllCompanies_();
    var updatedCount = 0;

    data.rows.forEach(function (row) {
      var company = rowToCompany_(data.headerIndex, row.values);
      if (!company.email) {
        return;
      }

      var threads = GmailApp.search('from:' + company.email, 0, 1);
      if (threads.length > 0) {
        markCompanyReplied_(company.companyId);
        updatedCount += 1;
      }
    });

    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    PropertiesService.getScriptProperties().setProperty(REPLY_SYNC_LAST_SYNCED_AT_KEY, now);

    return { updatedCount: updatedCount, lastSyncedAt: now };
  } finally {
    lock.releaseLock();
  }
}

// 返信確認タブの「返信を同期」ボタン付近に最終同期日時を表示するための取得専用関数。
function getReplySyncStatus_() {
  return {
    lastSyncedAt: PropertiesService.getScriptProperties().getProperty(REPLY_SYNC_LAST_SYNCED_AT_KEY) || null,
  };
}
