# Sales Pilot AI（GAS版）— アーキテクチャリファレンス

Claude Codeが`gas/`配下のコードを変更する際に参照する技術リファレンス。機能仕様は`gas/SPEC.md`、設計思想は`gas/PROJECT.md`を参照。本ファイルは「どこに何があるか」「どう繋がっているか」に特化する。

---

## レイヤー構成

```
Views/*.html (画面) → google.script.run → Router.js (薄い公開関数) → Services/*.js (業務ロジック) → Sheets / Gmail / Maps / Gemini / PropertiesService
```

- **Views/**: 画面ごとのHTML。各ファイルは`<section>`（マークアップ）と`<script>`（IIFE）を持つ。`Views/Index.html`が共通シェル（ヘッダー・ナビ・トースト基盤）で、`<?!= include(pageTemplate); ?>`で各画面を埋め込む
- **Router.js**: 画面から呼ばれる公開関数のみを持つ。ロジックは書かず、`Services/*.js`の`_`サフィックス関数へ委譲する1〜2行の薄いラッパーに徹する
- **Services/**: 業務ロジック本体。ファイル名は概ね機能単位（`SheetsService.js`=営業リストCRUD、`AiAnalysisService.js`=Gemini解析・下書き生成、等）
- **Config/**: `Constants.js`（Sheets列・値の定数）、`Settings.js`（PropertiesServiceラッパー）、`SalesEmailTemplate.js`（営業メール件名・本文組み立て）
- **Models/**: `Company.js`（企業データのバリデーション）

## エントリポイント

- `Code.js`の`doGet(e)`が唯一のHTTPエントリポイント。`e.parameter.page`で`PAGE_TEMPLATES`から対応するHTMLを選び、`Views/Index.html`のテンプレートへ埋め込む
- 新しい画面を追加する場合: (1) `Views/<Name>.html`を作成 (2) `Code.js`の`PAGE_TEMPLATES`に追記 (3) `Views/Index.html`のnavに実リンクを追加

## 画面遷移の仕組み（IFRAMEサンドボックス対応）

Apps Script Web AppはIFRAMEサンドボックスで配信されるため、初回表示後にトップレベルURLが`googleusercontent.com`のサンドボックスURLに変わり、相対リンク（`href="?page=xxx"`）が正しく解決されない。そのため画面遷移は必ずJavaScriptから`window.open(APP_BASE_URL + '?page=xxx', '_top')`で絶対URL（`ScriptApp.getService().getUrl()`）へ行う（`Views/Index.html`の`navigateToPage()`、および各画面の個別遷移ロジックを参照）。**新しい画面遷移を実装する際、`<a href="?page=xxx">`のような相対リンクだけに頼らないこと**（`data-page`属性＋共通クリックハンドラー、または個別の`window.open`呼び出しのいずれかを使う）。

## データストア

Google Sheets（1つのスプレッドシート内の複数タブ）のみ。追加のデータベースは持たない。

| タブ名 | 定義元 | 主キー |
| --- | --- | --- |
| `営業リスト` | `Config/Constants.js` | 企業ID（`C000001`形式） |
| `企業分析` | `Services/AiAnalysisService.js` | 企業ID |
| `営業メールテンプレート` | `Services/SalesTemplateService.js` | テンプレートID（`T000001`形式） |
| `返信テンプレート` | `Services/ReplyTemplateService.js` | テンプレートID（`R000001`形式） |

いずれも「シートが存在しなければ`insertSheet`で作成し、ヘッダー行がなければ`appendRow`する」パターンを共通で使う（`getCompanySheet_`/`getCompanyAnalysisSheet_`/`getSalesTemplateSheet_`/`getReplyTemplateSheet_`）。新しいマスタデータを追加する場合はこのパターンに倣う。

シート行⇄オブジェクトの変換は「ヘッダー文字列で列を特定する」方式（`buildHeaderIndex_`、`Services/MapperService.js`）。列の並び替え・追加に強い。

## 秘密情報・設定値

`PropertiesService`（スクリプトプロパティ）に保存し、`Config/Settings.js`のラッパー関数経由でのみアクセスする。一覧は`gas/SPEC.md`または`Config/Settings.js`の`SETTINGS_KEYS`を参照。`Views/Settings.html`（Sprint7⑥）から参照・更新できる。

## 排他制御

Sheetsの行単位の読み取り→加工→書き込みを行う処理は`LockService.getScriptLock()`で保護する（例: `updateCompanyStatus_`, `createSalesTemplate_`, `setDefaultSalesTemplate_`）。単純な`PropertiesService`の読み書きは排他制御しない（各呼び出しが独立してアトミックなため）。

## 共通UIインフラ（`Views/Index.html` / `Views/Style.html`）

- **トースト**: `window.showToast(message, type, options)`。`Views/Index.html`のトップレベルスクリプトで定義され、他の全画面の`<script>`から呼べる（DOM解析順序上、各画面のスクリプトはこの定義より先に実行されるが、実際に`showToast`が呼ばれるのは非同期のイベントハンドラー内なので問題ない）
- **ボタンスピナー**: `.button--loading`クラスをトグルするだけで、CSSの`::before`疑似要素がスピナーを描画する。ボタンの`textContent`書き換えロジックには一切影響しない
- **プログレスバー**: `.progress-bar` / `.progress-bar__fill`。幅（%）をJSから`style.width`で設定する

## テスト・シミュレーション基盤

`gas/src/**/*.js`はGAS専用ランタイムAPI（`SpreadsheetApp`等）に依存するため、リポジトリのVitestスイート（`src/**/*.test.js`、CLI版対象）には含まれない。GAS側のロジック検証は、Node.jsの`vm`モジュールで実ソースファイルを読み込み、`SpreadsheetApp`/`PropertiesService`/`LockService`等をモックしたコンテキストで実行する方式を使う（`docs/sessions/`内の実装ログにシミュレーションスクリプトの実例がある）。恒久的なテストスイートとしては保存されておらず、実装時に都度スクラッチスクリプトとして書いて実行する運用。

## ESLint設定（`eslint.config.js`）

`gas/src/**/*.js`は`sourceType: 'script'`・`ecmaVersion: 2019`でlintされ、`no-unused-vars`/`no-redeclare`はoffになっている（GASの実行時グローバル結合の性質上、これらのルールは誤検知するため）。`no-undef`は有効なので、クロスファイル参照する関数・定数は`gasProjectGlobals`に登録する必要がある（詳細は`.claude/rules.md`5節）。
