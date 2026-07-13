// 時間主導型トリガーの設定（Sprint8追記）。
// syncReplyStatus_を1時間ごとに自動実行したい場合、Apps Scriptエディタの実行欄から
// setupReplySyncTrigger()を一度だけ手動実行する（この関数自体はトリガーを作成するだけで、
// このファイルをpush/deployしただけではトリガーは有効化されない）。
//
// 注意: 時間主導型トリガーは、この関数を実行したアカウントの権限で動く。Webアプリ
// （executeAs: USER_ACCESSING）とは異なり、トリガー実行時のGmail検索・送信は各利用者
// ではなく「トリガーを設定したアカウント」のGmail受信箱を対象にsyncReplyStatus_が動く点に
// 留意すること。
function setupReplySyncTrigger() {
  removeReplySyncTrigger_();
  ScriptApp.newTrigger('scheduledReplySync_').timeBased().everyHours(1).create();
}

// 既存の同名トリガーを削除する（重複作成の防止・無効化に使う）。
function removeReplySyncTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'scheduledReplySync_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// 時間主導型トリガーから呼ばれるエントリーポイント。google.script.run経由の呼び出しでは
// ないためRouter層のrequireUser_は通さず、Service関数を直接呼ぶ。
function scheduledReplySync_() {
  syncReplyStatus_();
}
