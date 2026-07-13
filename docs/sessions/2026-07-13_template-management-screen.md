# テンプレート管理画面の実装（Sprint7 ⑤）

## 背景・依頼内容

Sprint6〜7・最終UI統一・ドキュメント整備・バックアップの一気通貫対応のうち、⑤「テンプレート管理画面：一覧／新規作成／編集／削除／プレビュー」に着手した。

## 実施したこと（実装前の設計確認）

着手前に調査した結果、GAS版の「テンプレート」はいずれも完全にコード直書きで、CRUD可能なデータストアが存在しないことが判明した。

1. **営業メールテンプレート**（`Config/SalesEmailTemplate.js`）: 件名・本文とも固定1種類のみ。Sprint3 Step5で「Gemini生成を個別文言のみに限定し、テンプレート自体は固定化する」という設計判断がされていた
2. **返信定型文**（`Services/ReplyTemplateService.js`）: 4種類の定型文がハードコードされたオブジェクト

CRUD画面を作るには新しいSheetsタブへの移行という設計変更が必要になり、特に①はSprint3の意図的な決定を覆すことになるため、ユーザーに対象範囲を確認した。**回答: 両方（営業メールテンプレートも含めて複数管理可能にする）。**

## 実施したこと（実装）

- **新規**: `gas/src/Services/SalesTemplateService.js` — 新規Sheetsタブ「営業メールテンプレート」（テンプレートID／表示名／件名／本文テンプレート／デフォルト／作成日時／更新日時）を新設。初回アクセス時にSprint3 Step5の固定内容をそのまま1件目（デフォルト）としてシードし、既存の送信内容を変えないようにした。CRUD関数（`listSalesTemplates_`/`createSalesTemplate_`/`updateSalesTemplate_`/`deleteSalesTemplate_`/`setDefaultSalesTemplate_`）を実装。デフォルトテンプレート・最後の1件は削除できないガードを追加
- **書き換え**: `gas/src/Config/SalesEmailTemplate.js` — 固定定数の組み立てロジックから、`{{personalizedNote}}`/`{{salesPersonName}}`/`{{salesPersonTel}}`/`{{salesPersonMail}}`/`{{timeRexUrl}}`のプレースホルダー置換方式に変更。`buildSalesEmailSubject_`/`buildSalesEmailBody_`に`templateId`引数を追加（省略時はデフォルトテンプレートを使用、既存呼び出し元は変更不要）
- **書き換え**: `gas/src/Services/ReplyTemplateService.js` — ハードコードされたオブジェクトから、新規Sheetsタブ「返信テンプレート」を使うCRUD方式に変更。初回アクセス時にSprint5 Step2の4種類（資料送付／日程調整／お礼／お断り）をそのままシード。`getReplyTemplates_()`の戻り値を「キー→本文のオブジェクト」から「配列」に変更し、テンプレート管理画面とInbox画面のクイック返信の両方から共用する単一の一覧取得関数にした
- `gas/src/Services/AiAnalysisService.js`: `generateSalesDraft_`に`templateId`引数を追加（省略時はデフォルトテンプレート）
- `gas/src/Router.js`: `generateSalesDraft`に`templateId`引数を追加。新規Router関数を追加（`listSalesTemplates`/`createSalesTemplate`/`updateSalesTemplate`/`deleteSalesTemplate`/`setDefaultSalesTemplate`/`createReplyTemplate`/`updateReplyTemplate`/`deleteReplyTemplate`）
- **新規**: `gas/src/Views/Templates.html` — 営業メールテンプレート・返信テンプレートそれぞれの一覧テーブル・新規作成／編集モーダル・プレビューモーダルを実装。既存のCompanyList.htmlのモーダル・トースト・スピナーの仕組みをそのまま再利用（新しいUIパターンは追加していない）
- `gas/src/Code.js`: `PAGE_TEMPLATES`に`templates: 'Views/Templates'`を追加
- `gas/src/Views/Index.html`: ナビゲーションの「テンプレート」リンクを無効表示から実際のリンクへ変更
- `gas/src/Views/Inbox.html`: クイック返信ボタンを、固定4ボタン（`data-template-key`）から`replyTemplates`配列を元に動的生成する方式（`data-template-id`）へ変更。テンプレート管理画面での追加・削除がInbox画面にもそのまま反映されるようにした
- `eslint.config.js`: 新規に追加したクロスファイル参照される関数名を`gasProjectGlobals`へ追加

### 判断の理由

- 営業メール生成（CompanyList.htmlの「営業メール生成」ボタン）は、今回は引き続きデフォルトテンプレートのみを使う形にとどめた。生成時に非デフォルトテンプレートを選べるようにする機能は、テンプレート管理画面（CRUD）とは別の作業（送信フロー側のUI追加）であり、依頼の「テンプレート管理画面」の範囲を超えるため、次のアクションとして明記するにとどめた
- プレビューは実際の担当者情報・TimeRex URLには置換せず、プレースホルダーをそのまま表示する簡易プレビューとした。実際の差し込み結果を見せるには新しいAPIが必要になり、スコープが広がるため見送った

## 実施した検証

1. 変更対象の`<script>`ブロックをすべて抽出し`node --check`で構文エラーがないことを確認
2. `npm run lint` → エラーなし（新規関数の`eslint.config.js`登録漏れも含めて確認）
3. `npm test` → 40ファイル / 806テスト すべて成功
4. ロジックシミュレーション（vmで実ソースを実行し、モックSheetに対して検証）:
   - 初回アクセス時のシード内容がSprint3 Step5・Sprint5 Step2の内容と一致すること
   - プレースホルダー置換が正しく行われ、`{{...}}`が残らないこと。personalizedNoteが空でも余分な空行が出ないこと
   - ID採番（T000002, R000005等）、フィールド単位の更新、デフォルト切り替え（他の行が自動でNに戻る）、削除ガード（デフォルト不可・最後の1件不可）がすべて期待通り動作すること
5. `npx clasp push` → 成功（33ファイル、新規2ファイル）
6. `npx clasp deploy -i <既存デプロイID>` → version 83として同一URLに反映済み

## 結果・現状

- 「テンプレート」ナビゲーションから、営業メールテンプレート・返信テンプレートの両方を一覧・作成・編集・削除・プレビュー・（営業メールのみ）デフォルト切り替えできる画面が追加された（version 83でデプロイ済み）
- 既存の送信内容・Inbox画面のクイック返信は、初回アクセス時のシードにより従来と同じ内容のまま動作する

## 未解決の課題・次のアクション

- 営業メール生成時に非デフォルトテンプレートを選択する機能は未実装（現状は常にデフォルトテンプレートを使用）。必要であれば別セクションとして着手を検討
- ユーザーによる実際のブラウザでの見た目・実際のテンプレートCRUD操作の確認が未実施
- 続けて⑥「設定画面（Gmail/Gemini/システム/デフォルト値）」に着手する

---
Skill化候補: 「Sheetsバックエンドのマスタデータに対するCRUD（一覧取得→シート自動作成・ヘッダー保証・初回シード→ID採番→作成/更新/削除、LockServiceで排他制御）」は、⑥の設定画面でも同種のパターンが必要になる可能性が高い。次回も同じ構造が登場したら`.claude/skills/`への切り出しを検討する。
