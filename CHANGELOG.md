# CHANGELOG

すべての変更は Issue 単位で記録する。形式は [Keep a Changelog](https://keepachangelog.com/ja/) に準拠。

---

## [v0.9.0] — 2026-07-01

データ保護基盤が完成し、営業担当者が毎日 Google Sheets を手動編集しながら並行利用できるベータ版。
正式な v1.0.0 は一定期間の実運用で安定稼働を確認した時点でリリース予定。

### Issue #022 — シート耐性強化・企業ID を C000001 形式へ変更

**データ保護**

- 企業ID 形式を `C000001`（プレフィックス付き連番）へ変更
- `ID_PREFIXES` + `formatId(prefix, n)` を導入（将来の案件ID `D`・担当者ID `P` へ拡張しやすい設計）
- `parseCompanyId(id)` 追加（`C000001 → 1`, それ以外 → `null`）
- 既存の `000001` 形式は `C000001` へ自動リフォーマット（番号を維持）
- `place:xxx` 形式は新連番に変換し Place ID を抽出（Issue #021 からの継続）

**PROTECTED_FIELDS 強化（8 → 10 フィールド）**

- `companyId`・`placeId` を追加。採番・設定後はマージ処理で絶対に上書きしない

**シート耐性（T-01〜T-09）**

- `appendCompanies` / `getApprovedRows` の先頭でヘッダーキャッシュを強制クリア（列移動・追加対応）
- 空行スキップ: 会社名・Place ID・URL がすべて空の行を処理対象から除外
- 重複行警告: 同一 dedup キーが複数行ある場合に `logger.warn` で通知
- `updateStatus` に `expectedCompanyId` オプション追加: ソート後の行番号ずれを自動補正（T-03）
- `_findRowByCompanyId`: 全行再スキャンで正しい行を特定する内部ヘルパー
- `_resolveCompanyIdConflicts`: append 後に重複 companyId を検出・再採番（T-09 並列採番衝突対応）
- `send.js` の silent catch を `logger.warn` に変更

**テスト**: 500 → 517 件（+17）

---

## [v0.1.x] — 2026-06-xx（開発フェーズ）

### Issue #021 — 企業ID を Place ID から人が管理しやすい連番へ変更

- 企業ID 列を `place:ChIJ...` 形式から `000001` 形式の連番へ変更
- 新規追加時は `max(既存ID)+1` を採番（欠番は再利用しない）
- Place ID は別フィールド（`placeId`・`Place ID` 列）として保持
- 重複判定は引き続き Place ID → WebサイトURL → 企業名+電話の優先順位
- 既存の `place:xxx` 形式データを自動マイグレーション

### ヘッダー駆動型 Google Sheets への移行

- シートの日本語ヘッダーに基づいてフィールドをマッピングする方式に変更
- `HEADER_TO_FIELD` / `FIELD_TO_HEADER` / `PROTECTED_FIELDS` の導入
- `valueInputOption: 'RAW'` で `+` 始まり電話番号の `#ERROR!` を修正
- `PROTECTED_FIELDS`（8フィールド）で担当者が手入力した値を AI が上書きしないよう保護

### Issue #016 — Places API (New) への移行

- Google Maps Places API を旧 Text Search から Places API (New) へ移行
- `X-Goog-Api-Key` ヘッダー方式に対応
- `doctor` コマンドに Maps API キーの疎通確認を追加
- フィールドマスクを明示指定して不要なデータ転送を排除

### Issue #015 — setup / doctor コマンド追加

- `setup`: `.env`・認証・接続・テンプレートをステップ形式で案内するセットアップガイド
- `doctor`: 現在の環境を診断して ✅ / ⚠️ / ❌ で一覧表示

### Issue #014 — 送信ステータスによる重複送信防止

- 送信済・返信あり・配信停止の企業への再送を自動防止
- `--force` オプションで強制送信可能
- `SEND_STATUS` 定数でステータス値を一元管理

### Issue #013 — ルールベースパーソナライザー実装

- 業種を 4 カテゴリ（美容・飲食・士業・IT）に分類して紹介文を生成
- 将来の Claude API 差し替えを想定した DI 設計
- `memo` フィールドにも業種キーワードが含まれる場合に対応

### Issue #012 — Gmail API 本実装

- Gmail API (`users.messages.send`) による実メール送信
- OAuth トークンの自動リフレッシュ
- テキスト + HTML マルチパート MIME 対応
- テンプレート変数置換（`{{companyName}}`・`{{introText}}` 等）

### Issue #011 — Google Sheets API 本実装

- サービスアカウントから OAuth2 へ認証方式を変更
- `SheetsService` クラスに DI コンストラクタを導入
- `getApprovedRows` / `updateStatus` / `appendCompanies` の基本実装

### Issue #010 — お問い合わせページ巡回でメール補完

- `WebsiteAnalyzer` がトップページでメールアドレスを取得できなかった場合のみ、お問い合わせページを追加巡回
- 最大 2 ページの巡回でメール取得率を向上

### Issue #009 — WebsiteAnalyzer 本実装

- `fetch` ベースで企業 Web サイトを取得し、メールアドレス・お問い合わせフォーム URL・会社概要を抽出
- DI 設計（`fetchFn` を注入可能）でテスト時に HTTP 通信なしで動作検証
- `extractors.js` に正規表現ベースの抽出ロジックを分離

### Issue #008 — Google Maps Provider 実装

- Places API Text Search による業種・地域からの企業検索
- `SearchOptions` モデルの導入（`industry`・`area`・`limit`）
- レート制限ハンドリング（429 時は処理継続）

### Issue #007 — config コマンド + find 確認画面

- `config` コマンドで `.env` の各設定値を対話的に変更
- `find` コマンドに実行前確認プロンプトを追加

### Issue #006 — 対話形式 CLI

- `inquirer` を導入して対話形式の入力フローを実装
- `--yes` フラグで確認プロンプトをスキップ可能

### Issue #005 — 営業リスト取得フロー

- `find` → `WebsiteAnalyzer` → Sheets 保存の基本フロー実装

### Issue #004 — Google Sheets 連携（初期）

- Google Sheets API の初期接続（サービスアカウント認証）

### Issue #003 — WebsiteAnalyzer 初期実装

- Playwright ベースの初期スタブから fetch ベースへ変更

### Issue #002 — Provider インターフェースとスタブ

- `BaseProvider` / `GoogleMapsProvider` / `GoogleSearchProvider` / `WebsiteProvider` のスタブを追加
- `GoogleSearchProvider` と `WebsiteProvider` は未実装（Phase 2 で実装予定）

### Issue #001 — Company ドメインモデル

- `Company` モデルの定義（19 フィールド）
- `createCompany` ファクトリー関数
