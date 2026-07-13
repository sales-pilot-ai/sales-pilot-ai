# タスクC: 企業検索保存時の「返信有無」空欄バグ修正

## 背景・依頼内容

企業検索（Search.html）から保存した企業は「返信有無」列が空欄のまま保存される。
既存の空欄行にも初期値を一括補完するマイグレーション関数を用意・実行してほしいという依頼。

## 調査結果

- `gas/src/Services/MapsService.js`の`searchCompaniesViaMaps_`が返す候補オブジェクトには
  そもそも`hasReply`フィールドが存在しない
- `gas/src/Services/SheetsService.js`の`upsertCompanyCandidate_`（新規保存時）は
  `companyToRow_(Object.assign({}, candidate, {...}))`という実装で、`candidate`に
  `hasReply`が無ければ`companyToRow_`が未定義値を`''`（空欄）に変換するため、
  新規保存企業は必ず「返信有無」が空欄になる
- 既存ロジック（Dashboard/Report/FollowUp/CompanyList等）は全て`hasReply === '返信あり'`
  という等価比較のみで判定しており、空欄はこれまで「未返信」と同じに扱われてきた
  （ロジック的には壊れていないが、シートの表示上は空欄セルとなり分かりにくい）
- Node CLI版（`src/sheets/`）でも同様に空欄がデフォルトだが、`hasReply`は
  PROTECTED_FIELDS（保護列）に指定されており、一度値が入った行は再保存で上書きされない
  設計だった。この「保護列」という位置づけ自体はGAS版の`COMPANY_PROTECTED_HEADERS`にも
  既に反映されている

## 実施したこと

- `gas/src/Config/Constants.js`: `HAS_REPLY = { YES: '返信あり', NO: '未返信' }`を追加
- `gas/src/Services/SheetsService.js`
  - `upsertCompanyCandidate_`の新規保存時、`candidate`に`hasReply`が無い場合のみ
    `HAS_REPLY.NO`（未返信）を初期値として設定するよう変更
    （`candidate`が将来`hasReply`を持つ場合はそちらを優先）
  - `backfillMissingHasReply_()`を新規追加。既存の営業リストシートを走査し、
    「返信有無」が空欄の行**のみ**`HAS_REPLY.NO`を補完する。既に何らかの値
    （'返信あり'等）が入っている行は一切上書きしない。Router経由では公開せず、
    Apps Scriptエディタの実行欄から手動で一度だけ実行する想定（他のdebugXxx関数と同じ扱い）
- `eslint.config.js`: `HAS_REPLY`をgasProjectGlobalsに追加

## 実施した検証

1. `npm run lint` → エラー0件
2. `npm test` → 40ファイル/806テスト 全てPASS
3. ロジックシミュレーション（実ソースをvmで実行）
   - 新規保存時、返信有無が空欄ではなく「未返信」になる
   - `backfillMissingHasReply_()`は空欄行のみ補完し、既存の値（'返信あり'・任意の値）が
     入っている行は一切上書きしない
   - 再実行しても更新対象は0件（冪等）

## 結果・現状

コミット済み（コード変更）。ただし**`backfillMissingHasReply_()`は、この場では
実際の本番スプレッドシートに対してまだ実行していない**（clasp runの認証設定が
このマシンに無く、Apps Scriptを直接遠隔実行する手段がないため）。デプロイ後、
Apps Scriptエディタの実行欄から`backfillMissingHasReply_`を選択して一度だけ
手動実行する必要がある（完了報告で案内）。

## 未解決の課題・次のアクション

- `backfillMissingHasReply_()`の本番実行（ユーザー側の作業）
- 調査の過程で、企業検索保存の候補オブジェクトには`hasReply`だけでなく
  `送信状況`・`送信可否`も設定されておらず、同様に空欄で保存されることが分かった。
  現状の判定ロジック（`sendStatus === '未送信'`等の厳密一致）では、空欄の場合に
  一括送信タブ・営業リストタブの振り分けが意図通りにならない可能性がある。
  今回のタスクCの依頼範囲外（返信有無のみ）のため修正はしていないが、関連する
  データ品質の課題として次回以降の検討候補に挙げる

Skill化候補: なし（本プロジェクト固有のデータ品質バグ対応であり、汎用パターンとしては
切り出さない）
