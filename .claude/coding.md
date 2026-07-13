# Sales Pilot AI（GAS版）— コーディング規約

`gas/`配下のコードを書く際の、既存コードから読み取れる規約。新しいコードはこれに合わせる。

---

## JavaScript（`gas/src/**/*.js`）

- `var`を使う（`ecmaVersion: 2019`・`sourceType: 'script'`でlintされており、GAS実行時にトップレベル宣言が全ファイル間で共有スコープになる。`const`/`let`は関数内のブロックスコープでは使ってよいが、トップレベル宣言は`var`で統一する）
- 内部実装関数（他ファイルから呼ばれる想定だが「公開API」ではないもの）は末尾に`_`を付ける（例: `getCompanySheet_`, `updateCompanyStatus_`）。Router.jsが公開する関数（`google.script.run`から呼ばれるもの）には`_`を付けない
- 新しいService関数を追加し、他ファイル（主にRouter.js）から参照する場合は、`eslint.config.js`の`gasProjectGlobals`にアルファベット順で追加する
- コメントは「なぜ」を書く。既存コードは各関数の先頭に「これは何のためのSprint/Stepで追加され、何をするか」を1〜3行で書くスタイルを踏襲している（例: `// 一括ステータス変更（Sprint6 Step12）。Step7で選択された企業のみを対象に...`）。実装が自明な処理には書かない
- Sheetsへの新規マスタデータ追加は、既存の「シート取得→なければ作成→ヘッダーがなければ追記→（新規シートなら）初期データをシード→返す」パターン（`getXxxSheet_()`関数）に倣う。`.claude/architecture.md`参照
- 行単位の読み取り→加工→書き込みを行う関数は`LockService.getScriptLock()`で保護する（`lock.waitLock(30000)` → `try { ... } finally { lock.releaseLock(); }`のパターン）

## HTML/CSS（`gas/src/Views/*.html`）

- 各画面ファイルは `<section class="xxx">`（マークアップ）+ `<script>(function () { ... })();</script>`（IIFE）の構成
- ボタンは`.button`（primary）または`.button button--secondary`（secondary）のいずれか。新しい見た目のボタンクラスを増やさない
- モーダルは`.modal-overlay`（`hidden`属性で表示制御）> `.modal` > `.modal__close`（×ボタン）+ `<h2>`見出し、の構造で統一する
- 処理中のボタンは`button.disabled = true`と`button.classList.add('button--loading')`を対で使う（完了時はどちらも解除する）
- 非同期処理の通知は`window.alert()`ではなく`showToast(message, type, options)`を使う。`type`は`success`/`error`/`info`/`loading`。破壊的操作の確認（送信実行など、Yes/Noの判断が必要なもの）は`window.confirm()`のまま維持してよい（トーストに置き換えない）
- KPIカードは`.card`（+ `.card--clickable`でクリック可能、`.card--metric`で非クリッカブルな割合表示用）+ `.card__icon` + `.card__value` + `.card__label`の構造。同じ概念（返信・送信・商談・成約等）には画面をまたいで同じ絵文字アイコンを使う（現在の対応表は`gas/SPEC.md`5節参照）
- 色は`:root`のCSS変数（`--color-accent`/`--color-error`/`--color-success`/`--color-info`/`--color-surface-muted`/`--color-text`/`--color-text-muted`/`--color-border`/`--color-disabled`）を使う。新しい色を追加する場合もリテラルの16進数を複数箇所に直書きせず、変数を追加してから参照する
- レスポンシブ対応は`Style.html`末尾の`@media (max-width: 768px)`ブロックにまとめる。新しいセクションを追加した場合、モバイル幅で崩れないか確認しこのブロックに追記する

## Router.js

- 1関数=1〜2行の薄いラッパー（引数をそのまま対応するService関数へ渡すだけ）に徹する。バリデーション・分岐ロジックが必要な場合もServices側に書く
- `debug*`関数（Apps Scriptエディタから手動実行して動作確認するための関数）は先頭に`// DEBUG (...確認後に削除する)`を付ける。ただし実際には確認後も削除されずに残っているものがあるため、新規追加時は本当に不要になったら削除まで行う

## テンプレート文字列・プレースホルダー

営業メールテンプレート（`Config/SalesEmailTemplate.js`）は`{{key}}`形式のプレースホルダーを`String.prototype.split('{{key}}').join(value)`で置換する（正規表現を使わない単純な文字列置換。テンプレート文字列に正規表現の特殊文字が含まれても壊れないようにするため）。新しいプレースホルダーを追加する場合はこの方式に合わせる。
