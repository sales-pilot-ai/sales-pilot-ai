// 受信トレイを「営業リストに登録された相手からの返信」だけに絞り込む（Sprint5 Step3）。
// Google/Chatwork/Makeやメルマガ等の一般受信メールは営業リストに登録されていないため、
// 送信元メールアドレスが営業リストの「メールアドレス」列と一致するかどうかで判定する。
// これは返信有無の自動更新（ReplySyncService.js）と同じ「送信元メールアドレス一致」方式であり、
// 営業リストにスレッドIDの列を追加する等、既存シート構成の変更は行わない。

// Gmailの送信者ヘッダー（例: "山田太郎 <taro@example.com>"）からメールアドレス部分のみを取り出す。
function extractSenderEmail_(from) {
  var match = String(from || '').match(/<([^<>]+)>/);
  return (match ? match[1] : from || '').trim().toLowerCase();
}

// 営業リストに登録済みのメールアドレス一覧を、大文字小文字を無視して照合できる形（連想配列）で返す。
function listSalesEmailAddresses_() {
  var companies = listCompaniesFromSheet_();
  var emails = {};
  companies.forEach(function (company) {
    if (company.email) {
      emails[String(company.email).trim().toLowerCase()] = true;
    }
  });
  return emails;
}

// 受信トレイ一覧（listInboxMessages_）のうち、送信元が営業リストに登録済みのメールアドレスと
// 一致するもの（＝営業メールへの返信）だけを返す。
function listSalesInboxMessages_() {
  var salesEmails = listSalesEmailAddresses_();
  return listInboxMessages_().filter(function (message) {
    return !!salesEmails[extractSenderEmail_(message.from)];
  });
}
