// 営業メール一括送信（Sprint4 Step8）。
// 送信可否=○ かつ 送信状況≠送信済の企業に対し、Step7のcreateSendMailForCompany_を1件ずつ実行する。
// createSendMailForCompany_自体は変更せず、そのまま再利用する（送信処理の重複実装は行わない）。
// 1件が失敗しても処理を継続し、対象企業すべてに送信を試みる。

// 送信可否=○ かつ 送信状況≠送信済の企業を1件ずつ送信し、成功件数・失敗件数・失敗企業一覧を返す。
function sendSalesMailBatch_() {
  var candidates = listCompaniesFromSheet_({ sendApproval: SEND_APPROVAL.YES }).filter(function (c) {
    return c.sendStatus !== SEND_STATUS.SENT;
  });

  var successCount = 0;
  var failedCompanies = [];

  candidates.forEach(function (company) {
    try {
      createSendMailForCompany_(company.companyId);
      successCount += 1;
    } catch (err) {
      failedCompanies.push({
        companyId: company.companyId,
        companyName: company.companyName,
        message: err.message,
      });
    }
  });

  return {
    successCount: successCount,
    failureCount: failedCompanies.length,
    failedCompanies: failedCompanies,
  };
}
