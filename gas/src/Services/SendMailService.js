// 営業メール送信（GmailApp.sendEmail）。Sprint3 Step7:
// Step5で生成済みの営業メール下書き（件名・本文）を使って実際に送信する。
// Gmail下書き（Step6, GmailApp.createDraft）は確認用として残し、送信対象にはしない
// （このファイルはGmailApp.sendEmail()のみ使用する）。

// 営業リストのメールアドレス・企業分析シートの下書き（件名・本文）を使って営業メールを送信する。
// 成功時のみ、企業分析シート・営業リストの両方を更新する。
function createSendMailForCompany_(companyId) {
  var company = findCompanyById_(companyId);
  if (!company) {
    throw new Error('企業が見つかりません（企業ID: ' + companyId + '）');
  }
  if (!company.email) {
    throw new Error('メールアドレスが未登録のため、営業メールを送信できません（企業ID: ' + companyId + '）');
  }

  var analysis = getCompanyAnalysisRow_(companyId);
  if (!analysis || analysis.draftStatus !== '成功' || !analysis.draftSubject) {
    throw new Error('営業メールの下書きが見つかりません。先に営業メール生成を実行してください。');
  }

  try {
    GmailApp.sendEmail(company.email, analysis.draftSubject, analysis.draftBody);
  } catch (err) {
    throw new Error('Gmailでのメール送信に失敗しました: ' + err.message);
  }

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var result = {
    mailSentStatus: 'メール送信済み',
    mailSentAt: now,
  };
  upsertCompanyAnalysisFields_(companyId, result);
  markCompanySent_(companyId, now);
  return result;
}
