// ダッシュボードの集計値表示（Sprint6 Step3）。営業リストを集計し、返信あり・送信待ち・
// 商談中・本日のアクション（本日商談予定）・成約の件数を返す（成約はStep14で追加）。
// 返信率・送信成功率・成約率はSprint6②で追加。読み取り専用でシートは更新しない。

// 分子・分母から百分率（小数第1位）を算出する。分母が0の場合はnull（画面側で「—」表示）。
function calculateRate_(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

// 営業リストを集計し、ダッシュボードの5カード＋パフォーマンス指標に表示する値を返す。
function getDashboardStats_() {
  var companies = listCompaniesFromSheet_();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var repliedCount = 0;
  var pendingSendCount = 0;
  var inNegotiationCount = 0;
  var todayActionCount = 0;
  var wonCount = 0;
  var lostCount = 0;
  var approvedCount = 0;
  // 送信状況が「送信済」または「返信あり」の企業を、このアプリから正常に送信できた件数として扱う
  // （「送信失敗」はSheetsに書き戻す仕組みが現状ないため、送信試行に対する成功率ではなく、
  // 送信可否○の対象企業のうち実際に送信できた割合＝送信成功率として算出する）。
  var sentCount = 0;

  companies.forEach(function (company) {
    if (company.hasReply === '返信あり') {
      repliedCount += 1;
    }
    if (company.sendApproval === SEND_APPROVAL.YES && company.sendStatus !== SEND_STATUS.SENT) {
      pendingSendCount += 1;
    }
    if (company.meetingDate && !company.dealResult) {
      inNegotiationCount += 1;
    }
    if (company.meetingDate && String(company.meetingDate).indexOf(today) === 0) {
      todayActionCount += 1;
    }
    if (company.dealResult === DEAL_RESULT.WON) {
      wonCount += 1;
    }
    if (company.dealResult === DEAL_RESULT.LOST) {
      lostCount += 1;
    }
    if (company.sendApproval === SEND_APPROVAL.YES) {
      approvedCount += 1;
    }
    if (company.sendStatus === SEND_STATUS.SENT || company.sendStatus === SEND_STATUS.REPLIED) {
      sentCount += 1;
    }
  });

  return {
    repliedCount: repliedCount,
    pendingSendCount: pendingSendCount,
    inNegotiationCount: inNegotiationCount,
    todayActionCount: todayActionCount,
    wonCount: wonCount,
    // 返信率: 正常に送信できた企業のうち、返信があった割合
    replyRate: calculateRate_(repliedCount, sentCount),
    // 送信成功率: 送信可否○の対象企業のうち、実際に送信できた割合
    sendSuccessRate: calculateRate_(sentCount, approvedCount),
    // 成約率: 商談の決着（成約+失注）がついた企業のうち、成約した割合
    winRate: calculateRate_(wonCount, wonCount + lostCount),
  };
}
