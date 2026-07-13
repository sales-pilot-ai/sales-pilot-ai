// Gmail受信メールの詳細（本文）取得。受信トレイ一覧の行クリック時に使用する。
// 返信機能・送信処理は実装しない（返信はStep11）。HTML本文は返さず、getPlainBody()のみ使用する。

// 指定したスレッドの最新メッセージから、詳細表示に必要な項目のみを返す。
function getInboxMessageDetail_(threadId) {
  var thread = GmailApp.getThreadById(threadId);
  if (!thread) {
    throw new Error('指定されたスレッドが見つかりません（threadId: ' + threadId + '）');
  }

  var messages = thread.getMessages();
  var latestMessage = messages[messages.length - 1];

  return {
    threadId: threadId,
    subject: thread.getFirstMessageSubject(),
    from: latestMessage.getFrom(),
    to: latestMessage.getTo(),
    date: Utilities.formatDate(latestMessage.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    plainBody: latestMessage.getPlainBody(),
  };
}
