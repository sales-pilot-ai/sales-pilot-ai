// 営業リストの「返信有無」を自動更新する（Sprint4 Step12）。
// メールアドレスが登録済みの企業について、そのメールアドレスからの受信メールが1件以上存在する場合、
// 「返信あり」に更新する。受信が存在しない場合は変更しない。
//
// 企業数が多い場合、1社ごとにGmail検索を行うため実行時間が伸びる点に留意する
// （Apps Scriptの実行時間上限。既存のMapsService.jsの検索処理と同様の制約）。

// 営業リストの全企業についてGmail受信を確認し、「返信あり」に更新した企業数を返す。
function syncReplyStatus_() {
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

  return { updatedCount: updatedCount };
}
