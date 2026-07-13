// 営業レポート（Sprint7⑦）。営業リストを集計し、総企業数・送信率・返信率・商談率・成約率、
// および月別送信件数の推移（グラフ表示用）を返す。読み取り専用でシートは更新しない。
// 各種割合の算出（calculateRate_）はServices/DashboardStatsService.jsのものをそのまま再利用する。

// 送信日（YYYY-MM-DD HH:mm:ss形式の文字列。未送信の場合は空文字）から年月（YYYY-MM）を
// 抽出し、直近6か月分の送信件数を月ごとに集計する。送信日が無い（=未送信）企業は集計対象外。
function buildMonthlySendCounts_(companies) {
  var counts = {};
  companies.forEach(function (c) {
    if (!c.sentDate) {
      return;
    }
    var month = String(c.sentDate).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return;
    }
    counts[month] = (counts[month] || 0) + 1;
  });

  var now = new Date();
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var label = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    months.push({ month: label, count: counts[label] || 0 });
  }
  return months;
}

function getReportStats_() {
  var companies = listCompaniesFromSheet_();

  var totalCount = companies.length;
  var approvedCount = 0;
  var sentCount = 0;
  var repliedCount = 0;
  var meetingCount = 0;
  var wonCount = 0;
  var lostCount = 0;

  companies.forEach(function (c) {
    if (c.sendApproval === SEND_APPROVAL.YES) {
      approvedCount += 1;
    }
    if (c.sendStatus === SEND_STATUS.SENT || c.sendStatus === SEND_STATUS.REPLIED) {
      sentCount += 1;
    }
    if (c.hasReply === '返信あり') {
      repliedCount += 1;
    }
    if (c.meetingDate) {
      meetingCount += 1;
    }
    if (c.dealResult === DEAL_RESULT.WON) {
      wonCount += 1;
    }
    if (c.dealResult === DEAL_RESULT.LOST) {
      lostCount += 1;
    }
  });

  return {
    totalCount: totalCount,
    sentCount: sentCount,
    wonCount: wonCount,
    // 送信率: 送信可否○の対象企業のうち、実際に送信できた割合
    sendRate: calculateRate_(sentCount, approvedCount),
    // 返信率: 正常に送信できた企業のうち、返信があった割合
    replyRate: calculateRate_(repliedCount, sentCount),
    // 商談率: 正常に送信できた企業のうち、商談日が設定された割合
    meetingRate: calculateRate_(meetingCount, sentCount),
    // 成約率: 商談の決着（成約+失注）がついた企業のうち、成約した割合
    winRate: calculateRate_(wonCount, wonCount + lostCount),
    monthlySendCounts: buildMonthlySendCounts_(companies),
  };
}
