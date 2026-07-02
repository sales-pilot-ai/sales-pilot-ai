# Sales Pilot AI — プロジェクト概要

営業担当者が毎日使える、企業リスト作成からメール送信までの半自動化ツール。  
Google Maps で企業を検索し、Web サイトから情報を補完し、Google Sheets で管理し、Gmail で送信する。

---

## 設計思想

### 1. 「Google Sheets が正」の原則

Sales Pilot AI は「Google Sheets を管理するシステム」ではなく、**「担当者が管理する Sheets と共存するツール」**。

- ツールは常にシートの現在の状態を正とし、人の手による編集（途中行の追加・削除・ソート・フィルタ）で壊れてはならない
- 担当者が手入力した値（送信可否・担当者名・メモ・返信有無等）は `PROTECTED_FIELDS` で保護し、AI が自動上書きしない
- 行番号は揮発的な情報（ソートで変わる）。企業 ID（`C000001`）を安定識別子として使う

### 2. DI（Dependency Injection）による高いテスタビリティ

すべてのサービスクラスはコンストラクタで依存を注入する設計。テスト時は HTTP 通信・Google API なしで動作を検証できる。

```
SheetsService({ sheetsApi, spreadsheetId, sheetName })
WebsiteAnalyzer({ fetchFn })
GmailMailer({ gmailApi, userId })
```

### 3. ヘッダー駆動型 Sheets 連携

シートのカラム順に依存せず、1 行目のヘッダー文字列でフィールドを特定する。担当者が列を追加・移動しても自動追従する。

```
HEADER_TO_FIELD = { '会社名' → 'companyName', '企業ID' → 'companyId', ... }
```

### 4. 段階的 dedup（重複排除）

同一企業の重複登録を防ぐ優先順位:

```
1. Google Place ID（最も信頼性が高い）
2. WebサイトURL のホスト名（www. を除去）
3. 企業名 + 電話番号のハッシュ（フォールバック）
```

### 5. 企業 ID の不変性と拡張性

```
C000001 = 企業ID（Company）
D000001 = 案件ID（Deal）— 将来予定
P000001 = 担当者ID（Person）— 将来予定
```

`formatId(prefix, n)` を共通関数として持ち、エンティティが増えても `ID_PREFIXES` に 1 行追加するだけで対応できる。

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  CLI  (commander)                                        │
│  find / send / report / auth / config / setup / doctor   │
└────────┬───────────────────┬────────────────────────────┘
         │                   │
┌────────▼──────┐   ┌────────▼───────────────────────────┐
│  Crawler      │   │  Gmail                              │
│  - find.js    │   │  - mailer.js  (Gmail API)           │
│  - WebsiteAna │   │  - template.js (変数置換)            │
│    lyzer      │   │  - mime.js  (MIME 組み立て)          │
└────────┬──────┘   └─────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────┐
│  Providers                                             │
│  ✅ GoogleMapsProvider   (Places API New)              │
│  🚧 GoogleSearchProvider (スタブ — Phase 2)            │
│  🚧 WebsiteProvider      (スタブ — Phase 2)            │
└────────┬──────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────┐
│  Sheets                                                │
│  SheetsService  appendCompanies / getApprovedRows /    │
│                 updateStatus / _resolveConflicts        │
│  mapper.js      HEADER_TO_FIELD / PROTECTED_FIELDS /   │
│                 formatCompanyId / parseCompanyId        │
└────────────────────────────────────────────────────────┘
```

---

## 現在の機能一覧（v0.9.0）

### CLIコマンド

| コマンド                             | 説明                             | 状態    |
| ------------------------------------ | -------------------------------- | ------- |
| `find -i <業種> -a <地域> -l <件数>` | 企業を検索して Sheets へ保存     | ✅ 動作 |
| `send`                               | 送信可否○の企業に一括メール送信  | ✅ 動作 |
| `send --dry-run`                     | 送信内容を確認のみ（実送信なし） | ✅ 動作 |
| `send --force`                       | 送信済企業にも強制送信           | ✅ 動作 |
| `auth`                               | Gmail OAuth 認証を実行           | ✅ 動作 |
| `config`                             | `.env` の設定を対話的に変更      | ✅ 動作 |
| `setup`                              | 初期セットアップガイド           | ✅ 動作 |
| `doctor`                             | 環境診断（✅/⚠️/❌）             | ✅ 動作 |
| `status`                             | ステータスを Sheets に反映       | ✅ 動作 |
| `check-replies`                      | 返信を検知して状態を更新         | ✅ 動作 |
| `report`                             | 営業活動の集計レポートを表示     | ✅ 動作 |
| `update <companyId>`                 | 商談日・成約・失注・メモを更新   | ✅ 動作 |
| `follow-up`                          | 今日のアクションリストを表示     | ✅ 動作 |

### Google Sheets 管理

| 機能                                              | 状態 |
| ------------------------------------------------- | ---- |
| ヘッダー駆動型の読み書き（列順不問）              | ✅   |
| 重複企業のスキップ（dedup）                       | ✅   |
| 既存企業の空欄のみ補完（merge）                   | ✅   |
| PROTECTED_FIELDS による人の入力値保護             | ✅   |
| 企業ID の自動採番（C000001 形式）                 | ✅   |
| Place ID の自動保存                               | ✅   |
| 更新対象列が未作成の場合の自動追加（`update` 等） | ✅   |
| 旧形式データの自動マイグレーション                | ✅   |
| ソート・フィルタ後の行番号ずれ耐性                | ✅   |
| 並列書き込み時の ID 衝突解消                      | ✅   |
| 空行スキップ                                      | ✅   |
| 重複行の警告                                      | ✅   |

### メール送信

| 機能                                          | 状態    |
| --------------------------------------------- | ------- |
| Gmail API 経由の実送信                        | ✅      |
| テキスト + HTML マルチパート                  | ✅      |
| 送信後のステータス自動更新                    | ✅      |
| 重複送信防止（送信済・返信あり・配信停止）    | ✅      |
| ルールベースのパーソナライゼーション（4業種） | ✅      |
| 送信前プレビュー（`--preview`）               | 🚧 #023 |

### 企業情報収集

| 機能                                    | 状態       |
| --------------------------------------- | ---------- |
| Google Maps による企業検索              | ✅         |
| WebsiteAnalyzer による情報補完（fetch） | ✅         |
| Google Custom Search による企業検索     | 🚧 Phase 2 |
| Playwright によるスクレイピング         | 🚧 Phase 2 |

---

## データモデル

### Company フィールド（19フィールド）

| フィールド名     | シートヘッダー       | 説明                        | 保護 |
| ---------------- | -------------------- | --------------------------- | ---- |
| `companyName`    | 会社名               | 企業名                      | —    |
| `industry`       | 業種                 | 業種カテゴリ                | —    |
| `area`           | エリア               | 所在地域                    | —    |
| `websiteUrl`     | ホームページ         | 企業サイト URL              | —    |
| `email`          | メールアドレス       | 連絡先メール                | —    |
| `contactFormUrl` | お問い合わせフォーム | フォーム URL                | —    |
| `phone`          | 電話番号             | 電話番号                    | —    |
| `location`       | 住所                 | 住所                        | —    |
| `memo`           | メモ                 | 担当者メモ                  | ✅   |
| `sentDate`       | 送信日               | 最終送信日                  | ✅   |
| `sendApproval`   | 送信可否             | ○ のみ送信対象              | ✅   |
| `status`         | 送信状況             | 送信済・返信あり等          | ✅   |
| `contactName`    | 担当者名             | 担当者                      | ✅   |
| `updatedAt`      | 最終更新             | 最終更新日時                | —    |
| `companyId`      | 企業ID               | C000001 形式・不変          | ✅   |
| `hasReply`       | 返信有無             | 返信を受信したか            | ✅   |
| `meetingDate`    | 商談日               | 商談予定日                  | ✅   |
| `closed`         | 成約                 | 商談結果（成約 / 失注）     | ✅   |
| `placeId`        | Place ID             | Google Place ID（dedup 用） | ✅   |

### ステータス値

```
送信状況: 未送信 / 送信済 / 送信失敗 / 返信あり / 配信停止
送信可否: ○（送信対象）/ それ以外（送信スキップ）
成約:     成約 / 失注 / 空欄（未確定）— sales-pilot update で記録
```

---

## 認証・設定

### .env 必須項目

```env
SPREADSHEET_ID=      # Google Sheets の ID
SHEET_NAME=営業リスト  # シート名（省略可）
GOOGLE_MAPS_API_KEY= # Places API のキー
GMAIL_FROM=          # 送信元メールアドレス
```

### .env 省略可

```env
GMAIL_NAME=          # 送信者名（署名に使用）
MEETING_URL=         # 日程調整 URL（テンプレート変数 {{meetingUrl}}）
DRY_RUN=false        # true にすると実送信しない
SEND_INTERVAL_MS=    # 送信間隔（ミリ秒、デフォルト 1000）
```

### 認証ファイル（credentials/ — gitignore 済み）

```
credentials/oauth-client.json  # OAuth クライアント ID・SECRET
credentials/oauth-token.json   # OAuth アクセス・リフレッシュトークン
```

---

## テスト

```
テストファイル: 24ファイル
テスト件数: 517件（v0.9.0 時点）
テストランナー: Vitest v4
方針: googleapis は一切モックしない。SheetsService に mock sheetsApi を DI して検証。
```

---

## 設計判断の記録（ADR）

重要な技術的・設計的判断は `docs/adr/` に Architecture Decision Record (ADR) として記録する。

```
docs/adr/
├── README.md                                       # ADR の書き方ガイド
├── ADR-001-google-sheets-as-source-of-truth.md    # Sheets を正とする設計
├── ADR-002-company-id-format.md                   # C000001 形式の採用
└── ...
```

ADR は「なぜその判断をしたか」を残すためのもの。実装詳細はコードに、判断の経緯はここに。
