# backfill実行用ラッパー追加＋権限シートの秘匿化（保護は中断・非表示のみ実施）

## 背景・依頼内容

1. `backfillMissingHasReply_`（タスクC）はアンダースコア付きのためApps Scriptエディタの
   実行ドロップダウンに表示されず、実行できなかった。アンダースコアなしの実行用ラッパー
   `runBackfillMissingHasReply`を追加してほしい。
2. タスクD（権限シート秘匿化）は代替案①「シート保護＋非表示」の採用が決定した。
   `setupProtectPermissionSheet`という名前で、権限シートの編集をオーナーのみに制限し、
   かつ非表示にするセットアップ関数を作成してほしい。ただし、実行モードがUSER_ACCESSINGの
   ため、保護後も他ユーザーのアクセス時にアプリの書き込みがブロックされないか必ず検証し、
   問題があれば中断して報告すること、という条件付きだった。

## 実施したこと

### タスク1: `runBackfillMissingHasReply`
`gas/src/Triggers.js`に追加。`backfillMissingHasReply_()`を呼び出し、戻り値の
`updatedCount`を`Logger.log`へ出力するだけの薄いラッパー。

### タスク2: `setupProtectPermissionSheet`（編集制限は実装せず、非表示のみ実施）

依頼の検証条件に従い、シート保護（Protection）を編集可能ユーザーをオーナーのみに
制限する形で実装した場合の影響を検証した結果、**重大な問題を発見したため、
編集制限（protect）の実装は中断した。**

**発見した問題**: Webアプリの実行モードはUSER_ACCESSING（`appsscript.json`）であり、
Apps Scriptからのすべての書き込みは「今アクセスしているユーザー自身の権限」で実行される。
`PermissionService.js`の`getCurrentUserContext_()`は、Admin・Userを問わず**ログインの
たびに**権限シートの「最終ログイン日時」列へ書き込みを行う（`sheet.getRange(...).setValue(...)`）。
もし権限シートの編集可能ユーザーをオーナーのみに制限した場合、オーナー以外の全ユーザーが
ログインするたびに、この最終ログイン日時の書き込みが「保護されたセルを編集する権限が
ありません」という例外で失敗し、**オーナー以外の全員がアプリにログインできなくなる**。
同様に、オーナー以外のAdminによるユーザー追加・削除・権限変更（`createUser_`/
`updateUserRole_`/`deleteUser_`）もすべて同じ理由で失敗する。

これは「既存機能を壊さないこと」「破壊的な影響の警告が出た場合は中断して報告すること」
という制約に明確に抵触するため、**シート保護（`.protect()`系API）は一切呼び出していない**
（実装せず、コード内コメントで理由を明記）。

代わりに`setupProtectPermissionSheet()`は、以下の安全な処理のみを行う：
- 「権限」シートを`hideSheet()`で非表示にする
- 「権限_旧」シートが存在すれば同様に非表示にする（削除はしない）

非表示（hideSheet）はシートの表示/非表示を切り替えるだけの機能で、Apps Scriptからの
読み書き可否には一切影響しないため、上記のブロッキング問題は発生しない
（ただし、非表示は「シートを編集できるユーザーが手動で再表示すればいつでも見える」
UI上の措置であり、真のアクセス制御ではない点は[前回のタスクD調査ログ](2026-07-13_permission-sheet-isolation-investigation.md)
で報告した通り）。

### `eslint.config.js`
`backfillMissingHasReply_`・`PERMISSION_SHEET_NAME`をgasProjectGlobalsに追加
（Triggers.jsから別ファイル定義のシンボルを参照するため）。

## 実施した検証

1. `npm run lint` → エラー0件
2. `npm test` → 40ファイル/806テスト 全てPASS
3. ロジックシミュレーション（実ソースをvmで実行）
   - `runBackfillMissingHasReply`が`backfillMissingHasReply_`の結果件数をLoggerへ出力する
   - `setupProtectPermissionSheet`が「権限」シートを非表示にする
   - 「権限_旧」が存在する場合も非表示にする（削除はしない）
   - 「権限_旧」が存在しなくてもエラーにならない
   - ソースコード上、`.protect(`という呼び出しが一切存在しないことを確認
     （編集制限を実装していないことの裏付け）

## 結果・現状

コミット・デプロイ予定（本ログ作成時点でこの後実施）。

## 未解決の課題・次のアクション

- 権限シートを真にオーナーのみのアクセスに制限したい場合は、前回の調査ログで挙げた
  代替案3（実行モードの見直し・送信方式の変更を伴う大規模な変更）を検討する必要がある。
  今回の「非表示のみ」の対応はあくまで暫定的な運用上の緩和策であり、真のアクセス制御では
  ない点をご理解いただきたい
- ユーザー側で実行が必要な関数: `runBackfillMissingHasReply`・`setupProtectPermissionSheet`
  （完了報告に実行順序を明記）

Skill化候補: なし（本プロジェクト固有のGAS実行モード制約対応）
