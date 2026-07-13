// Gmail下書き作成（GmailApp）。Sprint3 Step6:
// Step5で生成済みの営業メール下書き（件名・本文）を使ってGmailの下書きを作成する。
// 送信は行わない（GmailApp.createDraft()のみ使用。GmailApp.sendEmail等は使用しない）。

// 営業リストのメールアドレス・企業分析シートの下書き（件名・本文）を使ってGmail下書きを作成する。
// 成功時のみ、企業分析シートに作成済みステータス・作成日時を保存する。
function createGmailDraftForCompany_(companyId) {
  var company = findCompanyById_(companyId);
  if (!company) {
    throw new Error('企業が見つかりません（企業ID: ' + companyId + '）');
  }
  if (!company.email) {
    throw new Error('メールアドレスが未登録のため、Gmail下書きを作成できません（企業ID: ' + companyId + '）');
  }

  var analysis = getCompanyAnalysisRow_(companyId);
  if (!analysis || analysis.draftStatus !== '成功' || !analysis.draftSubject) {
    throw new Error('営業メールの下書きが見つかりません。先に営業メール生成を実行してください。');
  }

  GmailApp.createDraft(company.email, analysis.draftSubject, analysis.draftBody);

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var result = {
    gmailDraftStatus: 'Gmail下書き作成済',
    gmailDraftCreatedAt: now,
  };
  upsertCompanyAnalysisFields_(companyId, result);
  return result;
}
