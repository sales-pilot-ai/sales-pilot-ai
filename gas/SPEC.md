# Sales Pilot AI（GAS版）— 機能仕様書

実装済み機能の正（現状の実装に基づく仕様）。設計時点の構想は`../docs/webapp-migration-design.md`・`../docs/sprint3-ai-sales-assist-design.md`を参照するが、実装と齟齬がある場合は本ドキュメントを優先する。

---

## 1. 画面一覧

| ページキー | ファイル | 説明 |
| --- | --- | --- |
| `dashboard` | `Views/Dashboard.html` | ホーム画面。KPIカード・本日フォローすべき企業一覧 |
| `search` | `Views/Search.html` | 企業検索・営業リスト保存 |
| `companyList` | `Views/CompanyList.html` | 営業リスト一覧・一括操作 |
| `inbox` | `Views/Inbox.html` | 受信トレイ（営業メールへの返信のみ） |
| `templates` | `Views/Templates.html` | 営業メールテンプレート・返信テンプレート管理 |
| `settings` | `Views/Settings.html` | Gmail送信者情報・Gemini API・システム設定・デフォルト値 |
| `report` | `Views/Report.html` | 営業件数・各種KPI・月別送信件数推移グラフ |

`?page=<ページキー>`で遷移する。未知のページキーは`dashboard`にフォールバックする（`Code.js`）。

---

## 2. Sheetsデータモデル

### 2.1 `営業リスト`（`Config/Constants.js`）

企業1件につき1行。列（ヘッダー）は以下19列。

| ヘッダー | フィールド名 | 保護 | 備考 |
| --- | --- | --- | --- |
| 企業ID | `companyId` | ✅ | 主キー |
| 会社名 | `companyName` | | |
| 業種 | `industry` | | |
| エリア | `area` | | |
| ホームページ | `websiteUrl` | | |
| メールアドレス | `email` | | |
| お問い合わせフォーム | `contactFormUrl` | | |
| 電話番号 | `phone` | | |
| 住所 | `address` | | |
| メモ | `memo` | ✅ | |
| 送信日 | `sentDate` | ✅ | `markCompanySent_`が送信成功時に設定 |
| 送信可否 | `sendApproval` | ✅ | `○` / `×`（`SEND_APPROVAL`） |
| 送信状況 | `sendStatus` | ✅ | `未送信`/`送信済`/`送信失敗`/`返信あり`/`配信停止`（`SEND_STATUS`）。**`送信失敗`は現状どこからも書き込まれない**（3.6節参照） |
| 担当者名 | `ownerName` | ✅ | |
| 最終更新 | `updatedAt` | | |
| 返信有無 | `hasReply` | ✅ | `返信あり` / 空。`ReplySyncService`が自動更新 |
| 商談日 | `meetingDate` | ✅ | シートへの直接入力のみ（専用UIは未実装） |
| 成約 | `dealResult` | ✅ | `成約`/`失注`/空（`DEAL_RESULT`）。シートへの直接入力のみ |
| Place ID | `placeId` | ✅ | Google Place ID（dedup用） |
| AI要約 | `aiSummary` | | 企業分析結果の要約（一覧表示用） |

「保護」列は`COMPANY_PROTECTED_HEADERS`に含まれ、企業検索での候補保存時に上書きされない列。

### 2.2 `企業分析`（`Services/AiAnalysisService.js`）

企業IDごとに1行。AI解析結果・営業メール下書き（直近1件のみ、履歴なし）を保持する。列: 企業ID/会社名/要約/事業内容/特徴/ターゲット/営業ポイント/おすすめサービス/解析元URL/解析日時/モデル名/解析ステータス/解析エラー内容/下書き件名/下書き本文/下書きトーン/下書き生成日時/下書きステータス/下書きエラー内容/Gmail下書き作成済/Gmail下書き作成日時/メール送信済み/メール送信日時。

### 2.3 `営業メールテンプレート`（`Services/SalesTemplateService.js`、Sprint7⑤で新設）

列: テンプレートID（`T000001`形式）/表示名/件名/本文テンプレート/デフォルト（`Y`/`N`）/作成日時/更新日時。

初回アクセス時、Sprint3 Step5の固定テンプレート内容を1件目（`T000001`・デフォルト）としてシードする。本文テンプレートは以下のプレースホルダーを含み、送信・下書き生成時に実際の値へ置換される（`Config/SalesEmailTemplate.js`の`applySalesEmailPlaceholders_`）。

- `{{personalizedNote}}` — Gemini生成の個別紹介文
- `{{salesPersonName}}` / `{{salesPersonTel}}` / `{{salesPersonMail}}` — 設定画面の営業担当者情報
- `{{timeRexUrl}}` — 設定画面のTimeRex URL

デフォルトテンプレート・最後の1件は削除不可（`deleteSalesTemplate_`のガード）。

### 2.4 `返信テンプレート`（`Services/ReplyTemplateService.js`、Sprint7⑤でSheetsバックエンド化）

列: テンプレートID（`R000001`形式）/表示名/本文/作成日時/更新日時。初回アクセス時、Sprint5 Step2の固定4種（資料送付・日程調整・お礼・お断り）をシードする。プレースホルダー置換は行わない（そのまま返信本文欄へ挿入）。

---

## 3. KPI・集計ロジック

### 3.1 Dashboard（`Services/DashboardStatsService.js` `getDashboardStats_()`）

| 項目 | 定義 |
| --- | --- |
| 返信あり件数 | `hasReply === '返信あり'` の件数 |
| 送信待ち件数 | `sendApproval === '○' && sendStatus !== '送信済'` の件数 |
| 商談中件数 | `meetingDate`が設定済みかつ`dealResult`が未設定 |
| 本日のアクション件数 | `meetingDate`が本日の日付 |
| 成約件数 | `dealResult === '成約'` |
| 返信率 | 返信あり件数 ÷ 送信済+返信ありの件数 × 100 |
| 送信成功率 | 送信済+返信ありの件数 ÷ 送信可否○の件数 × 100 |
| 成約率 | 成約件数 ÷ (成約+失注)件数 × 100 |

割合はいずれも分母が0の場合`null`（画面側で「—」表示）。算出関数`calculateRate_`はDashboardStatsService.js内で定義し、ReportService.jsからも共用する。

### 3.2 レポート画面（`Services/ReportService.js` `getReportStats_()`）

| 項目 | 定義 |
| --- | --- |
| 営業件数 | 営業リストの全行数 |
| 送信率 | 送信済+返信ありの件数 ÷ 送信可否○の件数 × 100（Dashboardの「送信成功率」と同一定義） |
| 返信率 | Dashboardと同一定義 |
| 商談率 | `meetingDate`が設定されている件数 ÷ 送信済+返信ありの件数 × 100 |
| 成約率 | Dashboardと同一定義 |
| 月別送信件数推移 | `sentDate`の年月（YYYY-MM）で集計し、直近6か月分を古い順に返す。送信のない月は0件 |

### 3.3 フォローアップ抽出（`Services/FollowUpService.js`）

優先順位: ①本日商談予定 → ②返信あり・未対応（返信ありかつ商談日・成約とも未設定） → ③送信待ち。

### 3.4 statusQuickFilter（Dashboardカード → 営業リストの絞り込み）

DashboardのKPIカードをクリックすると、`?page=companyList&statusQuickFilter=<key>`で遷移する。`companyList`側は初期表示時にこのパラメータを読み取り、対応するステータスフィルタボタンを選択状態にする（`CompanyList.html`の`applyStatusQuickFilterSelection`）。`keyword`パラメータ（フォローアップからの遷移用）と併用可能。

| key | 対応するフィルタ |
| --- | --- |
| `replied` | 返信あり |
| `pendingSend` | 送信待ち |
| `inNegotiation` | 商談中 |
| `todayMeeting` | 本日商談 |
| `won` | 成約 |

### 3.5 一括操作（営業リスト画面）

- 一括AI分析・一括送信・一括ステータス変更は、選択された企業を1件ずつ`runBulkStep()`で順に処理する共通ランナーを使う
- 処理中は画面全体をロック（`setPageBusy(true)`）し、プログレスバー（`showBulkProgress`）で進捗を表示する
- 一括ステータス変更は、実行前の状態をメモリ上に保持し、完了後5秒間「元に戻す」（Undo）操作が可能

### 3.6 送信失敗が記録されない制約

`createSendMailForCompany_`（`Services/SendMailService.js`）は送信失敗時に例外をthrowするのみで、`SEND_STATUS.FAILED`をシートへ書き込む処理を持たない。そのため「送信成功率」「送信率」は「送信試行に対する成功率」ではなく「送信可否○の対象企業のうち実際に送信できた割合」として定義している（3.1・3.2節参照）。厳密な送信試行成功率が必要な場合は、`SendMailService.js`への機能追加が必要（`PROJECT.md`の次期構想参照）。

---

## 4. Router API一覧（`Router.js`）

画面から`google.script.run.<関数名>(...)`で呼び出す公開関数。

| 関数 | 引数 | 概要 |
| --- | --- | --- |
| `getCurrentUser()` | - | ログイン中のメールアドレスを返す |
| `searchCompanies(params)` | `{industry, area, limit}` | Google Maps検索（未保存） |
| `saveCompanyCandidate(candidate)` | 企業候補1件 | 営業リストへ保存 |
| `saveAllCompanyCandidates(candidates)` | 企業候補配列 | 残りを一括保存 |
| `listCompanies(filter)` | `{keyword, industry, sendStatus, sendApproval}` | 営業リスト一覧取得 |
| `analyzeCompanyInfo(companyId)` | 企業ID | Geminiで企業サイトを解析 |
| `generateSalesDraft(companyId, tone, templateId)` | 企業ID・トーン(任意)・テンプレートID(任意) | 営業メール下書き生成。templateId省略時はデフォルトテンプレート |
| `createGmailDraft(companyId)` | 企業ID | Gmail下書き作成（送信しない） |
| `sendSalesMail(companyId)` | 企業ID | 営業メール単体送信 |
| `sendSalesMailBatch()` | - | 送信可否○・未送信済の企業へ一括送信 |
| `listInboxMessages()` | - | 営業メールへの返信一覧 |
| `getInboxMessageDetail(threadId)` | スレッドID | 受信メール本文取得 |
| `replyInboxMessage(threadId, body)` | スレッドID・本文 | 返信送信 |
| `syncReplyStatus()` | - | 全企業のGmail受信を確認し「返信あり」を自動更新 |
| `generateReplyDraft(threadId)` | スレッドID | AI返信文生成 |
| `getReplyTemplates()` | - | 返信テンプレート一覧（配列。Inbox画面・テンプレート管理画面で共用） |
| `createReplyTemplate(data)` / `updateReplyTemplate(templateId, data)` / `deleteReplyTemplate(templateId)` | | 返信テンプレートCRUD |
| `listSalesTemplates()` | - | 営業メールテンプレート一覧 |
| `createSalesTemplate(data)` / `updateSalesTemplate(templateId, data)` / `deleteSalesTemplate(templateId)` / `setDefaultSalesTemplate(templateId)` | | 営業メールテンプレートCRUD・デフォルト切り替え |
| `getSettings()` / `updateSettings(data)` | | スクリプトプロパティの参照・更新（APIキーは設定済み/未設定のみ返す） |
| `getReportStats()` | - | レポート画面の集計値 |
| `listCompanyMailHistory(companyId)` | 企業ID | 企業とのメール履歴（スレッド単位） |
| `getDashboardStats()` | - | Dashboard集計値 |
| `listTodayFollowUps()` | - | 本日フォローすべき企業一覧 |
| `updateCompanyStatus(companyId, status)` | 企業ID・送信状況 | 送信状況を任意の値に更新（一括ステータス変更・Undoで使用） |

`debug*`で始まる関数はApps Scriptエディタからの手動確認用で、画面からは呼ばれない（削除予定として残置されているものを含む）。

---

## 5. 共通UIコンポーネント（`Views/Index.html` / `Views/Style.html`）

| コンポーネント | 実装 | 用途 |
| --- | --- | --- |
| トースト通知 | `showToast(message, type, options)`（`window`に公開） | `type`: `success`/`error`/`info`/`loading`。`options.persist: true`で自動消滅しない処理中トーストを表示し、完了時に`.update()`で差し替える |
| ボタンスピナー | `.button--loading`クラス（`::before`疑似要素） | 処理中のボタンにスピナー表示。`disabled`切り替えと対で使う |
| プログレスバー | `.progress-bar` / `.progress-bar__fill` | 一括処理（AI分析・送信・ステータス変更）の進捗表示 |
| モーダル | `.modal-overlay` / `.modal` / `.modal__close` | 全モーダル共通の構造（見出し`h2`＋閉じるボタン） |
| KPIカード | `.card` / `.card--clickable` / `.card--metric` / `.card__icon` / `.card__value` / `.card__label` | Dashboard・レポート画面で共用 |

配色は`:root`のCSS変数（`--color-accent`・`--color-error`・`--color-success`・`--color-info`・`--color-surface-muted`等）に集約している。
