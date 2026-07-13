# Sales Pilot AI（GAS版）— Claude Code運用ルール

`gas/`配下（Google Apps Script webアプリ）を対象に作業する際の運用ルール。CLI版（リポジトリルート`src/`）とは別のデプロイ・検証フローを持つため、作業前に必ず確認すること。

セッションログ・Skill化の全般ルールはリポジトリルートの`CLAUDE.md`を参照（本ファイルはGAS版固有の内容のみ扱う）。

---

## 1. 変更→検証→デプロイの手順（毎回このサイクルを守る）

1. `gas/src/`配下のファイルを変更する
2. `<script>`ブロックの構文チェック（HTML内埋め込みJSはESLintの対象外なので、`node --check`で個別に確認する。詳しくは4節参照）
3. `npm run lint`（リポジトリルートで実行）
4. `npm test`（リポジトリルートで実行。806件のテストがすべて通ることを確認する）
5. 新しいビジネスロジック（KPI算出・CRUD・ID採番等）を追加した場合は、`vm`モジュールで実ソースを読み込みモックの`SpreadsheetApp`/`PropertiesService`等に対して検証するシミュレーションスクリプトを書き、`/private/tmp/.../scratchpad/`配下で実行する（既存の`docs/sessions/`内の実装ログに実例があるので、書き方はそれを参照する）
6. `cd gas && npx clasp push`
7. 既存のデプロイに変更を反映する場合は `npx clasp deploy -i <デプロイID> -d "<説明>"`（新しいデプロイを作らず、既存のデプロイIDを指定して同一URLを維持する）
8. 壊れたまま次の作業に進まない。lintエラー・テスト失敗・シミュレーション失敗はその場で修正する

現在の本番デプロイID（Web App URL）: `AKfycbzNzInmMEWRy32RKIKn_fy8zD1VAM2Xqb9cSxGmxJCsvHIlfZeIs052sGopSX648A4P`（`npx clasp deployments`で確認・変更可能）

## 2. 秘密情報の扱い

- APIキー・パスワード等の秘密情報は、コード・Google Sheetsのいずれにも直書きしない
- すべて`PropertiesService`（スクリプトプロパティ）経由で管理し、`Config/Settings.js`のラッパー関数（`getGeminiApiKey_`等）を通してのみ参照する
- 画面（`Views/Settings.html`）からAPIキーを扱う場合、値そのものをブラウザへ返さない。「設定済み/未設定」の真偽値のみを返し、入力欄は常に空欄表示、空欄のまま保存された場合は既存の値を変更しない設計を踏襲する（`getSettingsForAdmin_`/`updateSettings_`参照）

## 3. 設計制約（`docs/webapp-migration-design.md`より、GAS版全体に適用）

- **Apps Script 1実行あたり最大6分**。大量データを扱う機能を追加する場合、この制限に抵触しないか検討すること。抵触する可能性がある場合は、黙って回避策（例: サイレントに時間制限を無視する実装）を作らず、その場で立ち止まってユーザーに報告する
- **複数人同時編集**: Sheetsの行単位の読み取り→加工→書き込みを行う処理（ステータス更新等）は`LockService.getScriptLock()`で排他制御する。単純な`PropertiesService`の参照・更新は排他制御不要（1呼び出しごとにアトミックなため）
- 上記2点に反する実装が必要になった場合は、その場で立ち止まって報告する（既存のパターンを参考にできない新しい種類の処理を追加する際は特に注意する）

## 4. HTML内埋め込みJSの構文チェック

`gas/src/Views/*.html`内の`<script>...</script>`はESLintの対象外（`eslint.config.js`の`ignores`にはならないが、HTMLファイル自体がESLintの対象外）。変更のたびに、以下のようなワンライナーで構文チェックする。

```bash
cd gas/src/Views
python3 -c "
import re
for fn in ['Dashboard.html', 'CompanyList.html', 'Inbox.html', 'Index.html', 'Templates.html', 'Settings.html', 'Report.html', 'Search.html']:
    content = open(fn).read()
    for i, s in enumerate(re.findall(r'<script>(.*?)</script>', content, re.S)):
        open(f'/tmp/_check_{fn.replace(\".html\",\"\")}_{i}.js', 'w').write(s)
"
for f in /tmp/_check_*.js; do node --check "$f" && echo "OK: $f" || echo "FAIL: $f"; done
rm -f /tmp/_check_*.js
```

## 5. クロスファイル参照するグローバル関数の登録を忘れない

`gas/src/**/*.js`は、Apps Scriptの実行時にはすべて同一スコープに結合されるが、ESLintは各ファイルを個別にlintする。そのため、あるファイルで定義した関数（末尾`_`の内部関数等）を別ファイルから呼ぶ場合、`eslint.config.js`の`gasProjectGlobals`にその関数名を追加しないと`no-undef`エラーになる。新しいService関数を追加してRouter.js等から呼ぶ場合は、必ずこのリストへの追加を忘れないこと。

## 6. ドキュメントの保守

以下のドキュメントは実装を変更した際、その都度合わせて更新する（最後にまとめて書くと抜け漏れが出るため、次回以降は都度更新を徹底する）。

- `gas/README.md` — セットアップ手順・実装済み画面一覧
- `gas/PROJECT.md` — アーキテクチャ・設計思想・Sprint履歴
- `gas/SPEC.md` — 画面仕様・Sheetsデータモデル・Router API一覧・KPI定義
- `gas/CHANGELOG.md` — Sprint単位の変更履歴
- `.claude/architecture.md` / `.claude/coding.md` / 本ファイル — Claude Code向けの技術リファレンス
