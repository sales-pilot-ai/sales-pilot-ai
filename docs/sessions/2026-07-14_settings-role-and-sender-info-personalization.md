# 設定画面のセクション別権限化＋Gmail送信者情報の個人化

## 背景・依頼内容

設定画面はこれまでAdmin専用として画面全体がブロックされ、Userはサイドバーから「設定」自体が
消えていた。Gmail設定（送信者情報：担当者名・電話番号・メールアドレス）はアプリ全体で共通の
1セットのみで、全ユーザーの送信・返信メール署名に同じ値が使われていた。これをユーザーごとに
個別管理し、User権限を含む全員が自分の情報を設定・編集でき、それが自分の送信・返信メールの
署名に使われるようにする依頼。ただし「ユーザー管理」「Gemini API設定」「システム設定」
「デフォルト値設定」の4セクションは引き続きAdmin専用のまま維持することが条件。

## データモデルの変更

「権限」シートに列を2つ追加する方式を採用した（新規シートは作らず、既存の
`ensureHeaders_`によるヘッダー自動追記の仕組みをそのまま使えるため）。

- `PERMISSION_HEADERS`に「電話番号」「送信者メール」を追加（`gas/src/Services/PermissionService.js`）
- 「担当者名」は新しい列を追加せず、既存の「名前」列（ログイン時のサイドバー表示・
  ユーザー管理一覧・前回追加した名前編集機能と共通）をそのまま使う。担当者名と
  ログイン表示名を別々に持つ理由が無く、二重管理・不整合を避けるため
- 既存のシートには次回アクセス時に`ensureHeaders_`が自動で2列を末尾に追加する
  （追加のマイグレーションスクリプトは不要）

**移行（既存の共通設定値の扱い）**: 個別の「電話番号」「送信者メール」が未設定（空欄）の
ユーザーについては、`getSenderInfoForUser_(email)`が読み取り時に以下の順でフォールバックする。

1. 電話番号・送信者メールとも、まず本人の権限シート上の個別値
2. 個別値が無ければ、移行前の共通設定値（Script Properties `SALES_PERSON_TEL`/
   `SALES_PERSON_MAIL`。Config/Settings.jsに読み取り専用の参照としてキーのみ残した）
3. 送信者メールは、共通設定値も無ければログイン中の本人のGoogleアカウントのメールアドレス
4. 担当者名は常に本人の「名前」列（空欄になることはない。ブートストラップ登録時に
   メールアドレスの@より前を初期値として自動設定される既存の仕組みによる）

このフォールバックにより、**一括移行処理を別途実行しなくても**「初回は共通設定と同じ値から
スタートし、以降は個別に編集できる」という要件を満たす。ユーザーが一度でも「Gmail設定
（送信者情報）」から保存すると、以後はその個別値が使われ、他のユーザーには一切影響しない。

## 実施したこと

- `gas/src/Services/PermissionService.js`: `PERMISSION_HEADERS`に列追加、`rowToUser_`に
  `tel`/`senderMail`を追加、`getSenderInfoForUser_(email)`・`updateSenderInfoForUser_(email, data)`
  を新設（担当者名・電話番号・メールアドレスはすべて必須、空欄は拒否）
- `gas/src/Config/Settings.js`: `SALES_PERSON_NAME`キー・`getRequiredScriptProperty_`・
  `getSalesPerson_`を削除（担当者名は権限シートの「名前」列に一本化したため不要になった）。
  `getSettingsForAdmin_`/`updateSettings_`から`salesPersonName`/`salesPersonTel`/
  `salesPersonMail`のフィールドを削除（Admin向け共通設定フォームの対象から除外）
- `gas/src/Config/SalesEmailTemplate.js`: `buildSalesEmailBody_`にemail引数を追加し、
  `getSalesPerson_()`ではなく`getSenderInfoForUser_(email)`を使うよう変更。差し込みタグ
  （`{{salesPersonName}}`等）自体の仕組みは変更していない
- `gas/src/Services/AiAnalysisService.js`: `generateSalesDraft_`にemail引数を追加し、
  `buildSalesEmailBody_`へそのまま伝搬
- `gas/src/Router.js`: `generateSalesDraft`を、`requireUser_()`が返す本人のメールアドレスを
  `generateSalesDraft_`へ渡すよう変更。`getMySenderInfo()`/`updateMySenderInfo(data)`を新設
  （いずれも`requireUser_()`が返す本人のメールアドレスのみを対象にし、クライアントから
  任意のemailを受け取らない＝他人の情報は編集できない設計）。DEBUG専用の
  `debugGenerateDraft`もemail引数（`Session.getActiveUser().getEmail()`）を渡すよう修正
- `gas/src/Code.js`: `ADMIN_ONLY_PAGES`から`'settings'`を除外（`'templates'`のみ残す）。
  設定画面自体はUser/Admin共通でアクセス可能になったが、画面内の各Admin専用操作
  （`getSettings`/`updateSettings`/`listUsers`/`createUser`/`updateUserRole`/`deleteUser`）は
  Router層の`requireAdmin_()`で引き続き保護されている（画面表示の可否とは独立した保護）
- `gas/src/Views/Index.html`: サイドバーの「設定」リンクをAdmin限定表示から全員表示に変更
  （「テンプレート」リンクは従来どおりAdmin限定のまま）
- `gas/src/Views/Settings.html`: 全面的に再構成した
  - 「Gmail設定（送信者情報）」を独立したフォームにし、User/Admin問わず常に表示。
    `getMySenderInfo`/`updateMySenderInfo`で自分の情報のみ読み書きする
  - 「Gemini API設定」「システム設定」「デフォルト値設定」「ユーザー管理」の4セクションを
    `#admin-settings-root`にまとめ、`getCurrentUser()`のroleがAdminの場合のみ表示・
    データ読み込みする（Userの場合はコンテナごと非表示のまま、`getSettings`/`listUsers`も
    呼び出さない）
  - ユーザー管理一覧の名前編集機能（前回追加分）はそのまま維持

## 実施した検証

1. `npm run lint` → エラー0件
2. `npm test` → 40ファイル/806テスト 全てPASS
3. `node --check`相当（`new Function`）でSettings.html・Index.html内のスクリプトを検証 → OK
4. Node vmによるシミュレーション（実際のソースを直接実行、8項目）
   - `getSenderInfoForUser_`: 個別未設定時は移行前の共通設定（Script Properties）へ
     フォールバックすること、共通設定も無い場合は送信者メールが本人のログインメールに
     フォールバックすることを確認
   - `updateSenderInfoForUser_`: 自分の情報を更新すると個別値が使われ、他のユーザーには
     一切影響しないこと、担当者名・電話番号・メールアドレスいずれかが空欄だと拒否される
     ことを確認
   - `buildSalesEmailBody_`: **実際に送信者（ユーザー）ごとに異なる署名（名前・電話番号・
     メールアドレス）が生成され、互いに混入しないこと**を確認（依頼の検証項目4に対応）
   - `generateSalesDraft_`: email引数が`buildSalesEmailBody_`へ正しく伝搬されること
     （テンプレートID引数の伝搬が壊れていないことも合わせて確認）
   - Router層（`generateSalesDraft`/`getMySenderInfo`/`updateMySenderInfo`）: いずれも
     `requireUser_()`が返す本人のメールアドレスのみを使い、クライアントから任意のemailを
     受け取らないこと（他人の情報を編集できないこと）を、各関数のソースを直接抽出して実行し確認
   - Code.js: User権限で`page=settings`にアクセスしても`accessDenied`にならないこと、
     `page=templates`は引き続き`accessDenied`になること（Admin専用維持）、Adminは両方とも
     問題なくアクセスできることを、実際の`doGet()`を実行して確認（依頼の検証項目1・2に対応）
5. Playwrightによる実際のSettings.html内スクリプトの統合テスト
   - User権限: Gmail設定（送信者情報）のみ表示され、Admin専用の4セクションは非表示のまま、
     `getSettings`/`listUsers`が呼ばれないことを確認
   - Admin権限: 従来どおり全セクションが表示・読み込みされることを確認
   - Gmail設定フォームが自分の情報で初期化され、保存すると`updateMySenderInfo`が正しい
     内容で呼ばれることを確認
   - 前回追加したユーザー管理一覧の名前編集機能（7シナリオ）を、再構成後のSettings.htmlに
     対して再実行し、引き続き正しく動作することを確認（既存機能への影響がないことの確認）

### 調査の結果、変更しなかった点

- **返信送信（`replyInboxMessage_`）**: 現在の実装は`thread.reply(body)`で、そもそも署名の
  自動挿入・{{salesPersonName}}等のプレースホルダー置換を一切行っていないことをコードから
  確認した。返信テンプレート（Templates.html「返信テンプレート」）も同様に差し込みタグを
  持たない。そのため「返信送信」については変更対象となるロジックが存在せず、変更していない
- Gmail下書き作成（`createGmailDraftForCompany_`）・営業メール送信
  （`createSendMailForCompany_`）自体は、既に生成済みの下書き（`analysis.draftBody`/
  `draftSubject`）をそのまま使うだけの実装であり、変更していない。署名の解決は
  「営業メール生成」（`generateSalesDraft`）の実行時点で行われる設計のため、そこを
  ユーザー個人化すれば実質的に下書き作成・送信にも反映される
  （既存の「AI分析→営業メール生成→送信」という一連の操作は同一ユーザーが同一セッション内で
  行う設計のため、生成時点のユーザー＝送信時点のユーザーとなる）

## 結果・現状

コミット・デプロイ予定。

## 重要な移行時の注意点（利用者への周知が必要）

これまで「担当者名」はGmail設定の共通値（Script Properties）を使っていたが、今後は
各ユーザー自身の「名前」（ログイン時の表示名。ユーザー管理・サイドバー表示と共通）が
使われる。ブートストラップ登録時の初期名（メールアドレスの@より前の部分）のまま
名前を一度も変更していないユーザーがいる場合、その人が送信する営業メールの署名には
その初期名がそのまま使われてしまう。**運用開始前に、全利用者が一度「設定」画面の
「Gmail設定（送信者情報）」で自分の担当者名・電話番号・メールアドレスを確認・
必要であれば修正することを推奨する。**

## 未解決の課題・次のアクション

- 実際のブラウザで、User/Admin両方のアカウントでログインし、設定画面の表示切り替え・
  Gmail設定の保存・営業メール生成後の署名が正しく個人の情報になっていることの確認が必要
- 上記「移行時の注意点」を利用者に周知する必要がある

Skill化候補: なし（本プロジェクト固有の機能追加）
