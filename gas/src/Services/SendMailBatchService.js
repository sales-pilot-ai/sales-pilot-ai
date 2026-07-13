// 営業メール一括送信（Sprint4 Step8）。
// 送信可否=○ かつ 送信状況≠送信済の企業に対し、Step7のcreateSendMailForCompany_を1件ずつ実行する。
// createSendMailForCompany_自体は変更せず、そのまま再利用する（送信処理の重複実装は行わない）。
// 1件が失敗しても処理を継続し、対象企業すべてに送信を試みる。
//
// 営業管理タブの一括送信（Sprint8④-2、選択した企業＋テンプレートを指定して送信）は、
// この関数（全対象への一括送信）ではなく、既存のanalyzeCompanyInfo/generateSalesDraft/
// sendSalesMail（Router.js）をクライアント側で1件ずつ順に呼び出す方式で実装する
// （選択企業のみを対象にするため）。そのためこの関数・Router引数は変更しない。
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
