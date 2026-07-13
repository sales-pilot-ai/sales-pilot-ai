// 本日フォローすべき企業一覧（Sprint6 Step4）。優先順位（①本日商談予定 ②返信あり・未対応
// ③送信待ち）に沿って対象企業を抽出し、会社名・担当者名・ステータス・対象理由を返す。
// 読み取り専用でシートは更新しない。1社が複数条件に該当する場合は最も優先順位の高い
// 区分のみに含める（重複表示しない）。

// 商談日が本日かどうかを判定する（meetingDateは'yyyy-MM-dd HH:mm:ss'形式を想定）。
function isTodayMeeting_(meetingDate, today) {
  return !!meetingDate && String(meetingDate).indexOf(today) === 0;
}

// 返信があるが、商談予定・成約結果のいずれも未設定（＝未対応）かどうかを判定する。
function isUnhandledReply_(company) {
  return company.hasReply === '返信あり' && !company.meetingDate && !company.dealResult;
}

// 一括送信の対象条件（送信可否が○かつ未送信）と同じ基準で送信待ちを判定する。
function isPendingSend_(company) {
  return company.sendApproval === SEND_APPROVAL.YES && company.sendStatus !== SEND_STATUS.SENT;
}

// 商談日時から時刻部分（HH:mm）のみを取り出す。取得できない場合は空文字を返す。
function meetingTimeLabel_(meetingDate) {
  var match = String(meetingDate || '').match(/(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

// 営業リストから本日フォローすべき企業を優先順位順（本日商談予定→返信あり・未対応→
// 送信待ち）に抽出し、会社名・担当者名・ステータス・対象理由の一覧を返す。
function listTodayFollowUps_() {
  var companies = listCompaniesFromSheet_();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var todayMeetings = [];
  var unhandledReplies = [];
  var pendingSends = [];

  companies.forEach(function (company) {
    if (isTodayMeeting_(company.meetingDate, today)) {
      var time = meetingTimeLabel_(company.meetingDate);
      todayMeetings.push({
        companyId: company.companyId,
        companyName: company.companyName,
        ownerName: company.ownerName,
        status: company.sendStatus,
        reason: '本日商談予定' + (time ? '（' + time + '）' : ''),
      });
      return;
    }
    if (isUnhandledReply_(company)) {
      unhandledReplies.push({
        companyId: company.companyId,
        companyName: company.companyName,
        ownerName: company.ownerName,
        status: company.sendStatus,
        reason: '返信あり・未対応',
      });
      return;
    }
    if (isPendingSend_(company)) {
      pendingSends.push({
        companyId: company.companyId,
        companyName: company.companyName,
        ownerName: company.ownerName,
        status: company.sendStatus,
        reason: '送信待ち',
      });
    }
  });

  return todayMeetings.concat(unhandledReplies, pendingSends);
}
