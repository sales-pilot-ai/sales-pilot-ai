# 取扱説明書作成のための機能情報まとめ

## 背景・依頼内容

社内配布用の取扱説明書（利用者向け）を別途作成するため、その正確な元情報として、
現在デプロイされている最新版（version 96）の機能を網羅した資料が欲しいという依頼。
画面一覧・操作フロー・ボタン/入力欄の機能説明（表形式）・User/Admin権限の違い・
利用者が知っておくべき注意点・よくあるエラーと対処の6項目を`docs/manual-source.md`に
Markdownで出力することが求められた。Apps Scriptエディタでの操作・開発手順・
スプレッドシートの内部構造・権限シートの存在は除外対象。コードの変更・デプロイは
一切行わないことが明示されていた。

## 実施したこと

以下のファイルを読み込み、実装済みの機能を正確に把握したうえで`docs/manual-source.md`を作成した。

- `gas/src/Code.js`（`PAGE_TEMPLATES`・`ADMIN_ONLY_PAGES`からAdmin専用画面を確認）
- `gas/src/Router.js`（全公開関数と`requireUser_`/`requireAdmin_`のガードからUser/Admin差分を確認）
- `gas/src/Views/Index.html`（サイドバー構成・画面共通レイアウト）
- `gas/src/Views/Dashboard.html`・`Search.html`・`CompanyList.html`・`Templates.html`・
  `Report.html`・`Settings.html`・`Inbox.html`（各画面のUI・操作フロー・ボタン/入力欄）
- `gas/src/Services/ReplySyncService.js`（返信同期が全企業を1回の実行でチェックする処理で
  あることを確認し、「6分実行制限に関わる操作」の注意点に反映）
- `gas/src/Services/FollowUpService.js`（本日フォローすべき企業の優先順位・対象理由のロジック）
- `gas/src/Services/PermissionService.js`（`requireUser_`/`requireAdmin_`のエラーメッセージ、
  「よくあるエラー」の文言の正確性を担保するため）

調査の過程で、`Inbox.html`（`page=inbox`）はサーバー側では引き続き有効なページとして
残っているが、現在のUIのどこからもリンクされていない（返信確認タブに機能が統合済み）
ことを`Index.html`のサイドバー・全Viewファイルへの`grep`で確認し、取扱説明書の対象からは
除外する形にした（本文中に注記のみ記載）。

## 結果・現状

`docs/manual-source.md`を新規作成した。コードの変更・デプロイは行っていない。

## 未解決の課題・次のアクション

- 本ドキュメントはversion 96時点の実装に基づく。今後の機能追加・変更時は、本ドキュメントも
  あわせて更新する必要がある
- 実際の取扱説明書（利用者配布版）は、本ドキュメントを元情報として別途作成する想定

Skill化候補: なし（一回限りのドキュメント作成作業）
