# Sales Pilot AI

営業リストの作成からメール送信までを半自動化する CLI ツール。  
企業検索 → スプレッドシート管理 → 営業メール一括送信を、最小限の手作業で回します。

---

## 営業フロー

```
1. sales-pilot find  →  業種・地域で企業を検索し Google Sheets へ保存
2. スプレッドシートで確認  →  送信可否を ○/× で入力
3. sales-pilot send  →  ○ の企業へパーソナライズメールを一括送信
4. 進捗管理  →  送付日・ステータスが自動更新される
```

---

## 前提条件

| 必要なもの                | バージョン         |
| ------------------------- | ------------------ |
| Node.js                   | 20 以上            |
| Google アカウント         | Gmail が使えるもの |
| Google Cloud プロジェクト | 無料枠で OK        |

---

## インストール

このプロジェクトを任意のディレクトリへ配置し、プロジェクトルートで `npm install` を実行してください。

```bash
cd /path/to/sales-pilot-ai

# 依存パッケージをインストール
npm install

# CLI コマンドとして登録（プロジェクトルートから直接呼べるようになる）
npm link
```

> `npm link` が実行できない場合は `node src/cli/index.js <コマンド>` で代替できます。

---

## セットアップ

### 1. .env ファイルを作成

```bash
cp .env.example .env
```

`.env` を開き、以下の項目を設定します。

#### 必須項目

| キー             | 説明                         | 取得方法                                                          |
| ---------------- | ---------------------------- | ----------------------------------------------------------------- |
| `SPREADSHEET_ID` | Google スプレッドシートの ID | シートの URL `https://docs.google.com/spreadsheets/d/<ここ>/edit` |
| `GMAIL_FROM`     | 送信元 Gmail アドレス        | Gmail アドレスをそのまま記入                                      |
| `GMAIL_NAME`     | メールの差出人名             | 例: `山田太郎`                                                    |

#### 任意項目

| キー                  | 説明                                         |
| --------------------- | -------------------------------------------- |
| `MEETING_URL`         | 日程調整ツールの URL（TimeRex・Calendly 等） |
| `GOOGLE_MAPS_API_KEY` | `find` コマンドで企業検索する場合に必要      |
| `SEND_INTERVAL_MS`    | メール送信間隔（ミリ秒、デフォルト: 3000）   |

```env
# .env の記入例
SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
GMAIL_FROM=yourname@gmail.com
GMAIL_NAME=山田太郎
MEETING_URL=https://timerex.net/s/yourname/meeting
GOOGLE_MAPS_API_KEY=AIzaSy...
GOOGLE_AUTH_TYPE=oauth
```

---

### 2. Google API の設定

#### 2-1. API を有効化する

[Google Cloud Console](https://console.cloud.google.com/) にアクセスし、プロジェクトを選択または新規作成します。

「API とサービス」→「ライブラリ」から以下の API を有効化してください。

| API               | 用途                         |
| ----------------- | ---------------------------- |
| Google Sheets API | スプレッドシートへの読み書き |
| Gmail API         | メール送信                   |
| Places API (New)  | 企業検索（`find` コマンド）  |

#### 2-2. OAuth2 認証情報を作成する（推奨）

Gmail 送信には OAuth2 認証が必要です。

1. 「API とサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
2. アプリケーションの種類: **デスクトップアプリ**
3. 作成後、JSON をダウンロード
4. ダウンロードしたファイルを `credentials/oauth-client.json` に配置

```bash
mkdir -p credentials
mv ~/Downloads/client_secret_*.json credentials/oauth-client.json
```

5. `.env` に認証タイプを設定

```env
GOOGLE_AUTH_TYPE=oauth
GOOGLE_CLIENT_ID=（JSON の client_id）
GOOGLE_CLIENT_SECRET=（JSON の client_secret）
```

> `credentials/` ディレクトリは `.gitignore` に含まれており、Git にコミットされません。

#### OAuth 再認証手順（スコープ追加時）

Gmail の読み取り権限（`gmail.readonly`）が追加されたため、初めて `check-replies` を使う場合は再認証が必要です。

```bash
# 既存トークンを削除
rm credentials/oauth-token.json

# 再認証を実行
sales-pilot auth

# ブラウザで Google アカウントにログインし
# 「Gmail のメールの読み取り」権限を許可する
```

> 追加されたスコープ: `gmail.readonly`（返信メールの読み取り専用。送信・削除は行いません）

---

#### 2-3. Google Sheets をサービスアカウントと共有（サービスアカウント認証の場合）

`GOOGLE_AUTH_TYPE=service_account` を使う場合は、以下も行います。

1. 「API とサービス」→「認証情報」→「サービスアカウントを作成」
2. キー（JSON）を作成してダウンロード
3. `credentials/service-account.json` に配置
4. スプレッドシートの「共有」でサービスアカウントのメールアドレスに編集権限を付与

#### 2-4. Google Maps API キーを作成する

> **注意**: `find` コマンドは **Places API (New)** (`places.googleapis.com/v1/...`) を使用します。  
> 旧 Places API (`maps.googleapis.com/maps/api/place/...`) は 2024 年以降に作成した新規 API キーでは利用不可です。

1. 「API とサービス」→「ライブラリ」→ **「Places API (New)」** を有効化
2. 「API とサービス」→「認証情報」→「API キーを作成」
3. キーに `Places API (New)` の API 制限を設定（任意だが推奨）
4. `.env` の `GOOGLE_MAPS_API_KEY` に設定

設定後、`sales-pilot doctor` で API キーの有効性を確認できます。

---

### 3. スプレッドシートを準備する

新規スプレッドシートを作成し、**1 行目にヘッダー行を追加しない**状態にします。  
`find` コマンド実行時にデータが自動的に追記されます。

シートの列はデフォルトで以下の順に設定されています（`config/settings.json` で変更可）。

```
A: 会社名  B: 担当者名  C: 業種  D: メールアドレス  E: 電話番号
F: 企業URL  G: お問い合わせURL  H: Instagram  I: TikTok  J: 所在地
K: 送信可否（○/×）  L: 送付日  M: 進行  N: 返信  O: 備考  ...
```

---

### 4. セットアップを確認する

```bash
sales-pilot setup
```

設定が正しくできているか一括確認します。不足があれば具体的な対処方法が表示されます。

```
[1/4] .env 必須項目チェック
  ✅ SPREADSHEET_ID           設定済
  ✅ GMAIL_FROM               設定済
  ✅ GMAIL_NAME               設定済
  ⚠️  MEETING_URL              未設定（省略可）

[2/4] メールテンプレート確認
  ✅ テンプレートファイル      3/3 存在確認

[3/4] Google 認証確認
  ✅ Google 認証              認証成功

[4/4] API 接続確認
  ✅ Google Sheets            接続成功
  ✅ Gmail                    接続成功
  ✅ Google Maps API キー     API キー有効
```

---

## コマンドリファレンス

### `sales-pilot find` — 企業リストを検索

業種と地域を指定して企業情報を収集し、Google Sheets へ自動保存します。

```bash
# 対話形式で実行（業種・地域・件数を入力）
sales-pilot find

# オプション指定で即実行
sales-pilot find -i "美容院" -a "東京都渋谷区" -l 30

# シートへ保存せずに結果だけ確認
sales-pilot find --dry-run

# Web サイト解析をスキップして高速化
sales-pilot find --skip-analyzer
```

| オプション        | 説明                                     |
| ----------------- | ---------------------------------------- |
| `-i, --industry`  | 検索する業種（例: 飲食店、税理士事務所） |
| `-a, --area`      | 検索する地域（例: 大阪市北区）           |
| `-l, --limit`     | 最大取得件数（デフォルト: 20）           |
| `--dry-run`       | スプレッドシートへの保存をスキップ       |
| `--skip-analyzer` | Web サイト解析をスキップ                 |

---

### `sales-pilot send` — メールを一括送信

スプレッドシートの「送信可否」が **○** で、ステータスが **未送信** または **送信失敗** の企業へ営業メールを送信します。

```bash
# 通常送信
sales-pilot send

# 送信内容を確認するだけ（実際には送信しない）
sales-pilot send --dry-run

# 送信済み企業にも強制送信（再送）
sales-pilot send --force
```

| オプション  | 説明                                         |
| ----------- | -------------------------------------------- |
| `--dry-run` | 実際には送信せず、送信内容をターミナルに表示 |
| `--force`   | ステータスが「送信済」の企業にも送信         |

**送信ステータスの扱い**

| ステータス         | `send` の動作  | `send --force` の動作 |
| ------------------ | -------------- | --------------------- |
| 未送信（空白含む） | 送信           | 送信                  |
| 送信失敗           | 送信（再試行） | 送信                  |
| 送信済             | スキップ       | **送信**              |
| 返信あり           | スキップ       | スキップ              |
| 配信停止           | スキップ       | スキップ              |

実行後に集計結果が表示されます。

```
完了 — 送信: 5件  スキップ: 3件  失敗: 1件
```

---

### `sales-pilot check-replies` — 返信を検知して状態を更新

Gmail のスレッドを確認し、営業メールへの返信を自動検知します。

- 返信が見つかった企業の営業リストのステータスを「返信あり」に更新
- 「返信履歴」タブ（初回実行時に自動作成）に返信内容を記録

```bash
# 返信を検知して営業リストを更新
sales-pilot check-replies

# 確認のみ（実際には更新しない）
sales-pilot check-replies --dry-run
```

| オプション  | 説明                                         |
| ----------- | -------------------------------------------- |
| `--dry-run` | Gmail API を呼ばず、確認対象企業の一覧を表示 |

> **前提**: `gmail.readonly` スコープを含む OAuth トークンが必要です。  
> 初回利用時は「OAuth 再認証手順」を実施してください。

---

### `sales-pilot doctor` — 環境診断

設定と接続状態を素早く確認します。

```bash
sales-pilot doctor
```

```
✅ SPREADSHEET_ID           設定済
✅ GMAIL_FROM               設定済
⚠️  MEETING_URL              未設定（省略可）
✅ テンプレートファイル      3/3 存在確認
✅ Google 認証              認証成功
✅ Google Sheets            接続成功
✅ Gmail                    接続成功
```

---

### `sales-pilot setup` — セットアップ確認

`doctor` より詳細なセットアップガイド付き診断。不足がある場合に設定方法のヒントを表示します。

```bash
sales-pilot setup
```

---

### `sales-pilot config` — 設定を変更

`.env` の設定値を対話形式で変更します。

```bash
sales-pilot config
```

---

## メールテンプレートのカスタマイズ

`templates/emails/` 以下のファイルを編集してテンプレートを変更できます。

| ファイル                      | 用途         |
| ----------------------------- | ------------ |
| `initial_contact.subject.txt` | メール件名   |
| `initial_contact.txt`         | テキスト本文 |
| `initial_contact.html`        | HTML 本文    |

使用できるテンプレート変数：

| 変数              | 内容                                   |
| ----------------- | -------------------------------------- |
| `{{companyName}}` | 会社名                                 |
| `{{contactName}}` | 担当者名（未設定時は「ご担当者」）     |
| `{{meetingUrl}}`  | `.env` の `MEETING_URL`                |
| `{{introText}}`   | 業種から自動生成されるパーソナライズ文 |

署名は `GMAIL_NAME` と `GMAIL_FROM` から自動生成されます（テンプレートへの記載不要）。

---

## 開発コマンド

```bash
npm test                # ユニットテスト（1回実行）
npm run test:watch      # ウォッチモード
npm run test:coverage   # カバレッジレポート生成
npm run test:e2e        # E2Eテスト（Playwright）

npm run lint            # ESLint チェック
npm run lint:fix        # ESLint 自動修正
npm run format          # Prettier フォーマット
npm run format:check    # Prettier チェックのみ
```

---

## ディレクトリ構成

```
sales-pilot-ai/
├── src/
│   ├── cli/            # CLI エントリーポイント・コマンド定義
│   │   └── commands/   # find / send / setup / doctor / config / status
│   ├── config/         # 設定読み込み（.env + settings.json）
│   ├── constants/      # ステータス定数
│   ├── crawler/        # 企業情報取得（Google Maps + Web スクレイピング）
│   ├── gmail/          # Gmail 送信（MIME ビルダー・テンプレート・DI）
│   ├── models/         # Company モデル
│   ├── personalizer/   # メールパーソナライズ（ルールベース、AI 差し替え対応）
│   ├── providers/      # Google Maps / Places API クライアント
│   ├── sheets/         # Google Sheets 読み書き（DI）
│   └── utils/          # ロガー等の共通ユーティリティ
├── config/
│   └── settings.json   # シート列定義・送信設定等
├── credentials/        # Google 認証情報（.gitignore 対象）
├── templates/
│   └── emails/         # メールテンプレート（txt / html / subject）
└── tests/
    └── e2e/            # Playwright E2E テスト
```

---

## セキュリティに関して

- `credentials/` ディレクトリは `.gitignore` に含まれており、Git にコミットされません。
- `.env` ファイルも `.gitignore` 対象です。
- OAuth トークンは `credentials/oauth-token.json` に保存されます（同じく gitignore 対象）。
- API キーは環境変数経由でのみ使用し、ソースコードにハードコードしないでください。
