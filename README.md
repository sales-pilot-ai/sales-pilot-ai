# Sales Pilot AI

営業リストの作成からメール送信までを半自動化するCLIツール。

## 営業フロー

1. **業種を入力** → 企業リストを検索
2. **企業情報を取得** → 企業名・メール・所在地をスクレイピング
3. **Google Sheetsへ保存** → 一覧を自動書き込み
4. **人が内容を確認** → スプレッドシートで「送信可否」を ○/× で入力
5. **メール送信** → ○ の企業にのみ一括送信
6. **進行を自動更新** → 送付日・ステータスをシートへ反映

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# Playwright ブラウザ（E2Eテスト用）のインストール
npx playwright install chromium

# 環境変数の設定
cp .env.example .env
# .env を編集して SPREADSHEET_ID・GMAIL_FROM などを入力
```

Google認証情報は `credentials/` 配下に配置する（`.gitignore` 対象）。

## GitHubへのPush

```bash
# GitHubでリポジトリを新規作成後、以下を実行
git remote add origin https://github.com/<your-username>/sales-pilot-ai.git
git branch -M main
git push -u origin main
```

## 使い方

```bash
# 企業リストを取得してシートへ保存
node src/cli/index.js find "IT企業 東京" --limit 20

# 送信可否が○の企業へメール送信
node src/cli/index.js send

# 内容確認のみ（実際には送信しない）
node src/cli/index.js send --dry-run

# 送付日・ステータスを更新
node src/cli/index.js status
```

## 開発コマンド

```bash
npm test                # ユニットテスト（1回実行）
npm run test:watch      # ウォッチモード
npm run test:ui         # Vitest UI（ブラウザで結果確認）
npm run test:coverage   # カバレッジレポート生成
npm run test:e2e        # E2Eテスト（Playwright）
npm run test:e2e:ui     # Playwright UI モード

npm run lint            # ESLint チェック
npm run lint:fix        # ESLint 自動修正
npm run format          # Prettier フォーマット
npm run format:check    # Prettier チェックのみ
```

## ディレクトリ構成

```
src/
  config/     設定ファイルの読み込み（.env + settings.json）
  crawler/    企業情報取得・スクレイピング（Phase 2）
  sheets/     Google Sheets 読み書き（Phase 1）
  gmail/      Gmail 送信（Phase 3）
  cli/        CLIエントリーポイント・コマンド定義
  utils/      共通ユーティリティ
config/       アプリ設定（settings.json）
credentials/  Google認証情報（gitignore対象）
templates/    メールテンプレート（Jinja2風プレースホルダ）
tests/e2e/    Playwright E2Eテスト
```
