// Gmail受信トレイの一覧取得（Sprint4 Step9）。一覧表示のみを目的とし、返信機能は実装しない
// （返信はStep10）。本文全文はレスポンスに含めず、一覧表示用のスニペット（先頭のみ）だけを返す。

var INBOX_THREAD_LIMIT = 50;
var INBOX_SNIPPET_MAX_LENGTH = 100;

// 受信トレイの最新スレッド（最大INBOX_THREAD_LIMIT件）を取得し、
// 一覧表示に必要な最小限の項目（threadId/messageId/from/subject/date/snippet/unread）のみを返す。
function listInboxMessages_() {
  var threads = GmailApp.getInboxThreads(0, INBOX_THREAD_LIMIT);

  return threads.map(function (thread) {
    var messages = thread.getMessages();
    var latestMessage = messages[messages.length - 1];
    var plainBody = latestMessage.getPlainBody() || '';

    return {
      threadId: thread.getId(),
      messageId: latestMessage.getId(),
      from: latestMessage.getFrom(),
      subject: thread.getFirstMessageSubject(),
      date: Utilities.formatDate(latestMessage.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      snippet: plainBody.slice(0, INBOX_SNIPPET_MAX_LENGTH),
      unread: thread.isUnread(),
    };
  });
}
