// 企業とのメール履歴表示（Sprint6 Step1〜2）。営業リストの企業詳細から、Gmailでその企業と
// やり取りしたスレッドを検索し、スレッド単位で件名・メッセージ一覧（送受信・日時・本文全文）
// を返す。返信機能は追加しない（表示のみ）。

var MAIL_HISTORY_THREAD_LIMIT = 50;

// メッセージの送信元に企業のメールアドレスが含まれるかどうかで送受信を判定する。
function mailHistoryDirection_(message, companyEmail) {
  var from = String(message.getFrom() || '').toLowerCase();
  return from.indexOf(String(companyEmail).toLowerCase()) === -1 ? '送信' : '受信';
}

// 企業ID(companyId)の営業リスト登録メールアドレスを使い、from/toいずれかで一致するGmail
// スレッドを検索して、スレッドごとに件名・メッセージ一覧（送受信・日時・本文全文）を返す。
// thread.getMessages()はスレッド内のメッセージを古い順に返すため、そのまま利用する。
function listCompanyMailHistory_(companyId) {
  var company = findCompanyById_(companyId);
  if (!company) {
    throw new Error('企業が見つかりません（企業ID: ' + companyId + '）');
  }
  if (!company.email) {
    throw new Error('メールアドレスが未登録のため、メール履歴を取得できません（企業ID: ' + companyId + '）');
  }

  var query = 'from:' + company.email + ' OR to:' + company.email;
  var threads = GmailApp.search(query, 0, MAIL_HISTORY_THREAD_LIMIT);

  return threads.map(function (thread) {
    return {
      // threadId: Sprint8の返信確認「継続返信」チャットUIで、このスレッドへ返信する際に使う
      // （replyInboxMessage_の引数）。既存のメール履歴モーダル（CompanyList.html）は
      // この項目を参照しないため、追加しても表示への影響はない。
      threadId: thread.getId(),
      subject: thread.getFirstMessageSubject(),
      messages: thread.getMessages().map(function (message) {
        return {
          direction: mailHistoryDirection_(message, company.email),
          date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
          body: message.getPlainBody() || '',
        };
      }),
    };
  });
}
