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

// タスクC「返信有無」空欄一括補完の手動実行用ラッパー。
// backfillMissingHasReply_（末尾アンダースコア付き）はApps Scriptエディタの実行欄の
// ドロップダウンに表示されないため、アンダースコアなしのこの関数をエディタから
// 一度だけ手動実行する。
function runBackfillMissingHasReply() {
  var result = backfillMissingHasReply_();
  Logger.log('runBackfillMissingHasReply: updatedCount=' + result.updatedCount);
}

// 「送信状況」版のbackfill実行用ラッパー（追加依頼）。backfillMissingSendStatus_
// （末尾アンダースコア付き）はApps Scriptエディタの実行欄のドロップダウンに表示されないため、
// アンダースコアなしのこの関数をエディタから一度だけ手動実行する。
function runBackfillMissingSendStatus() {
  var result = backfillMissingSendStatus_();
  Logger.log('runBackfillMissingSendStatus: updatedCount=' + result.updatedCount);
}

// 権限シートの秘匿化（タスクD代替案①・採用済み）。共有スプレッドシートを他メンバーと
// 共有しても、「権限」シートだけは非表示にする。
//
// 重要な制約: Webアプリの実行モードはUSER_ACCESSING（Code.js/appsscript.json参照）のため、
// シート保護（Protection）で編集可能ユーザーをオーナーのみに制限すると、Apps Scriptからの
// 書き込みも「アクセスしている本人自身の権限」で実行される。PermissionService.jsの
// getCurrentUserContext_()は、Admin・User問わずログインのたびに「最終ログイン日時」列へ
// 書き込みを行うため、オーナー以外の全ユーザーがログインするたびにこの書き込みが
// 「保護されたセルを編集する権限がありません」という例外で失敗し、オーナー以外の
// 全員がログインできなくなる（オーナー以外のAdminによるユーザー追加・削除・権限変更も
// 同様に失敗する）。この影響は「既存機能を壊さないこと」という制約に反するため、
// 本関数では編集制限（protect）は行わず、非表示（hideSheet）のみを行う。
function setupProtectPermissionSheet() {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());

  var sheet = spreadsheet.getSheetByName(PERMISSION_SHEET_NAME);
  if (sheet) {
    sheet.hideSheet();
  }

  var oldSheet = spreadsheet.getSheetByName(PERMISSION_SHEET_NAME + '_旧');
  if (oldSheet) {
    oldSheet.hideSheet();
  }

  Logger.log(
    'setupProtectPermissionSheet: 「権限」シート（および「権限_旧」があれば同様に）を非表示にしました。' +
      'USER_ACCESSING実行モードのため、編集制限（シート保護）は実施していません（コード内コメント参照）。'
  );
}
