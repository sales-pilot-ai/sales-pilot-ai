// Gmail受信メールへの返信（Sprint4 Step11）。thread.reply()のみを使用し、plain textのみで返信する
// （HTMLメールは使わない）。営業メール送信（Step6〜8）とは無関係で、既存の送信処理には関与しない。

function replyInboxMessage_(threadId, body) {
  var thread = GmailApp.getThreadById(threadId);
  if (!thread) {
    throw new Error('指定されたスレッドが見つかりません（threadId: ' + threadId + '）');
  }

  thread.reply(body);

  return { success: true };
}
