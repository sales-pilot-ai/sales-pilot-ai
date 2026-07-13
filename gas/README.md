# Sales Pilot AI — GAS版セットアップ手順

設計の詳細は `../docs/webapp-migration-design.md`（初期設計）を参照。ただし実際の実装はSprint単位で進んでおり、実装済みの機能・画面構成の正はこのREADMEおよび `PROJECT.md` / `SPEC.md` を参照すること（設計書は初期のPhase0〜1時点のドラフトのまま更新されていない）。

Googleアカウントでの認可・Apps Scriptプロジェクトの作成・デプロイは、この社内Workspaceアカウントを持つ担当者自身が行う必要がある（clasp loginはブラウザでのOAuth認可が必須のため）。

## 1. clasp（Apps Script公式CLI）を用意する

リポジトリルートで一度だけ実行する。

```bash
npm install
```

以降は `npx clasp <コマンド>` で実行できる（`package.json` の devDependencies に `@google/clasp` を追加済み）。

## 2. Googleにログインする

```bash
npx clasp login
```

ブラウザが開くので、社内Google Workspaceアカウントで認可する。

## 3. Apps Scriptプロジェクトを作成する

`gas/` ディレクトリで実行する。

```bash
cd gas
npx clasp create --type webapp --title "Sales Pilot AI" --rootDir ./src
```

- 実行すると `gas/.clasp.json` が生成され、発行された `scriptId` が記録される（`.clasp.json` はGitに含めない。`.clasp.json.example` を参考にすること）
- 既に他の担当者が作成済みのプロジェクトに合わせる場合は、代わりに以下を実行する

```bash
npx clasp clone <既存のscriptId> --rootDir ./src
```

## 4. コードをプッシュする

```bash
npx clasp push
```

`src/` 配下のファイル（`Code.js` / `Router.js` / `Config/*.js` / `Services/*.js` / `Models/*.js` / `appsscript.json` / `Views/*.html`）がApps Scriptプロジェクトにアップロードされる。

## 5. Web Appとしてデプロイする

初回のみ、Apps Scriptエディタからデプロイを作成する。

```bash
npx clasp open
```

Apps Scriptエディタが開く。画面右上の「デプロイ」→「新しいデプロイ」から以下を設定する。

- 種類: ウェブアプリ
- 次のユーザーとして実行: **ウェブアプリにアクセスしているユーザー**
- アクセスできるユーザー: **（組織名）内のユーザー**

デプロイ後に発行されるWeb App URLを控える。

2回目以降、コード変更を既存のデプロイ（同一URL）に反映する場合は、デプロイIDを指定して再デプロイする。

```bash
npx clasp push
npx clasp deploy -i <既存のデプロイID> -d "変更内容の説明"
```

デプロイ済みのデプロイID一覧は `npx clasp deployments` で確認できる。

## 6. 事前設定（スクリプトプロパティ）

初回セットアップ時、以下のスクリプトプロパティをApps Scriptエディタの「プロジェクトの設定」→「スクリプト プロパティ」から設定する（Sprint7⑥の設定画面からアプリ内で設定・変更することも可能。詳細は下記「設定画面」参照）。

| プロパティ | 内容 | 必須 |
| --- | --- | --- |
| `SPREADSHEET_ID` | 営業リスト用スプレッドシートのID | 必須 |
| `MAPS_API_KEY` | Google Maps Places API (New) のAPIキー（企業検索で使用） | 企業検索を使う場合は必須 |
| `GEMINI_API_KEY` | Gemini APIキー（企業分析・下書き生成で使用） | AI機能を使う場合は必須 |
| `GEMINI_MODEL` | 使用するGeminiモデル名 | 任意（未設定時は`gemini-2.5-flash`） |
| `TIMEREX_URL` | 営業メールに挿入する日程調整リンク | 任意（未設定時はデフォルト値） |
| `SALES_PERSON_NAME` / `SALES_PERSON_TEL` / `SALES_PERSON_MAIL` | 営業メール・返信メールの署名に使う担当者情報 | 必須 |

APIキー等の秘密情報はコード・Google Sheetsには一切含めない設計（詳細は`../docs/webapp-migration-design.md`⑧セキュリティ設計、`.claude/architecture.md`参照）。

### 営業リスト用スプレッドシートについて

スプレッドシートIDはスクリプトプロパティ`SPREADSHEET_ID`で管理する。「アクセスしているユーザーとして実行」の権限では新規ファイル作成ができないため、事前に管理者がスプレッドシートを作成し、IDを`SPREADSHEET_ID`に登録しておく運用とする（自動作成は行わない）。

営業リストシート（`営業リスト`タブ）以外に、以下のシートタブがアプリから自動作成される（初回アクセス時に存在しなければ作成される）。

- `企業分析` — AI分析結果・営業メール下書きの保存（Sprint3）
- `営業メールテンプレート` — 営業メールテンプレートの管理（Sprint7⑤）
- `返信テンプレート` — 受信メール返信用の定型文管理（Sprint7⑤）

## 7. 動作確認

1. 発行されたURLをブラウザで開く（例: `https://script.google.com/macros/s/<デプロイID>/exec`）
2. 社内Googleアカウントでログインする（ドメイン外のアカウントではアクセスできない設定になっている）
3. ヘッダーに自分のメールアドレスが表示され、Dashboard（ホーム画面）にKPIカード・本日フォローすべき企業一覧が表示されることを確認する

## 実装済み画面（2026-07時点）

| 画面 | URLパラメータ | 概要 |
| --- | --- | --- |
| Dashboard（ホーム） | `?page=dashboard` | KPIカード（返信あり・送信待ち・商談中・本日のアクション・成約、および返信率・送信成功率・成約率）、本日フォローすべき企業一覧。カードクリックで営業リストへ絞り込み遷移 |
| 企業検索 | `?page=search` | 業種・エリアを指定してGoogle Maps検索、候補を1件ずつ確認して営業リストへ保存 |
| 営業リスト | `?page=companyList` | 一覧・検索・ステータスフィルタ・複数選択・一括AI分析／一括送信／一括ステータス変更（Undo対応）・AI分析／営業メール生成／Gmail下書き作成／送信／メール履歴（企業ごと） |
| 受信トレイ | `?page=inbox` | 営業メールへの返信のみを一覧表示、本文閲覧、AI返信生成・定型文挿入・返信送信 |
| テンプレート | `?page=templates` | 営業メールテンプレート・返信テンプレートの一覧・作成・編集・削除・プレビュー（営業メールテンプレートのみデフォルト切り替え可） |
| レポート | `?page=report` | 営業件数・送信率・返信率・商談率・成約率、月別送信件数の推移グラフ |
| 設定 | `?page=settings` | Gmail送信者情報・Gemini API・システム設定（スプレッドシートID・Maps APIキー）・デフォルト値（TimeRex URL）の参照・変更 |

詳細な機能仕様・API一覧・データモデルは `SPEC.md`、アーキテクチャ全体像は `PROJECT.md` を参照。

## ディレクトリ構成

```
gas/src/
  Code.js              … doGet エントリポイント、画面(page)⇄HTMLテンプレートのマッピング
  Router.js            … 画面から google.script.run で呼ばれる公開関数を集約
  Config/
    Constants.js        … 営業リストシートの列・値定義
    Settings.js         … PropertiesServiceラッパー（APIキー・担当者情報等の参照・更新）
    SalesEmailTemplate.js … 営業メール件名・本文の組み立て（テンプレートのプレースホルダー置換）
  Models/
    Company.js           … 企業データのバリデーション
  Services/
    MapperService.js      … シート行⇄企業オブジェクトの変換
    MapsService.js         … Places API (New) 呼び出し
    SheetsService.js       … 営業リストのCRUD
    AiAnalysisService.js   … Gemini企業分析・営業メール下書き生成
    GeminiService.js       … Gemini API呼び出し（リトライ付き）
    SendMailService.js / SendMailBatchService.js … 営業メール送信（単体・一括）
    GmailInboxService.js / GmailInboxDetailService.js / GmailReplyService.js / SalesInboxService.js … 受信トレイ・返信
    ReplyDraftService.js   … AI返信文生成
    ReplyTemplateService.js … 返信テンプレートCRUD（Sheetsバックエンド）
    SalesTemplateService.js … 営業メールテンプレートCRUD（Sheetsバックエンド）
    MailHistoryService.js  … 企業別メール履歴（スレッド単位）
    ReplySyncService.js    … 返信有無の自動更新
    DashboardStatsService.js … Dashboard集計値・KPI算出
    FollowUpService.js     … 本日フォローすべき企業の抽出
    ReportService.js       … レポート画面の集計値・月別送信件数推移
  Views/
    Index.html            … 共通レイアウト（ヘッダー・ナビ・トースト基盤）
    Style.html             … 共通CSS
    Dashboard.html / Search.html / CompanyList.html / Inbox.html / Templates.html / Settings.html / Report.html
```
