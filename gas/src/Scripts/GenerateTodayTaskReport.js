// 本日の作業内容の社内提出用作業報告書を生成する（Apps Scriptエディタから手動実行する
// 一回限りのユーティリティ）。既存の営業データのスプレッドシート・アプリ本体の
// Router/Service/Viewには一切触れない。
//
// 本日分の作業内容は、git log（コミット一覧・日時）とdocs/sessions/配下の本日分
// セッションログを実際に確認して書き起こしたものをこのファイル内にデータとして
// 埋め込んでいる（Apps Script実行環境からgitやdocs/を読むことはできないため）。
// 各行のデプロイバージョンは、実際にclasp deployでバージョンが作成されたことを
// 確認できたもののみを記載し、確認できないものは「デプロイなし」としている。

var TASK_REPORT_TITLE = 'Sales Pilot AI 作業報告書_2026-07-14';
var TASK_REPORT_DATE = '2026-07-14';
var TASK_REPORT_PERIOD = '2026年7月14日（1日分）';
var TASK_REPORT_SYSTEM_NAME = 'Sales Pilot AI（Google Apps Script版）';

var TASK_REPORT_HEADER_BG = '#e8f0fe';

// 種別列の色分け（既存アプリのステータス色分け・Views/Style.htmlの色トークンと合わせた）。
// 機能追加=success相当の緑、バグ修正=error相当の赤、UI改善=accent相当の青、
// ドキュメント整備=text-muted相当のグレー。
var TASK_REPORT_TYPE_COLORS = [
  ['機能追加', '#1e8e3e'],
  ['バグ修正', '#d93025'],
  ['UI改善', '#1a73e8'],
  ['ドキュメント整備', '#5f6368'],
];

// 本日（2026-07-14）実施した作業。git log（コミットハッシュ・日時）と
// docs/sessions/配下の本日分セッションログを突き合わせて書き起こした。
// 1コミットの中に性質の異なる複数の対応が含まれる場合（97411ba）は、
// 実際に作成されたセッションログの単位（1トピック1ファイル）に合わせて行を分けている。
var TASK_REPORT_ITEMS = [
  {
    summary: '営業リストの一覧表で、列見出し（ヘッダー）の文字が縦に折り返されて読みにくかったのを、横スクロール可能な表示に変更し読みやすくした。',
    type: 'UI改善',
    target: '営業管理（営業リストタブ）',
    version: 'version 90',
    note: '',
    commit: '044f7bd',
  },
  {
    summary: '過去に実施した「返信有無」等の初期値バグの一括補完処理を、Apps Scriptエディタから手動実行できるラッパー関数を追加した。あわせて、権限管理用シートを一覧上で見えないよう非表示にした。',
    type: '機能追加',
    target: '設定画面（権限管理）／バックエンド保守用ユーティリティ',
    version: 'version 91',
    note: '権限シートの「編集を制限する」対応は、実行アカウントの権限設定によりログイン処理自体が壊れるリスクがあったため実装を見送り、非表示化のみを実施した（データの編集制限はかかっていない）。',
    commit: 'ffda981',
  },
  {
    summary: '営業リストのAI要約が長い場合に一覧では省略表示されていたが、クリックすると全文をポップアップ表示できるようにした。また、企業検索から保存した企業の「送信状況」が空欄のまま保存される不具合を修正し、既存データの空欄も補完した。',
    type: '機能追加／バグ修正',
    target: '営業管理（営業リストタブ）、企業検索',
    version: 'version 92',
    note: '',
    commit: '43f2af6',
  },
  {
    summary: '企業検索画面の入力欄・ボタンがクリックしづらいという報告を受け、ラベルと入力欄の関連付けを見直した。同様の問題が他の画面（設定・テンプレート・営業リストの一部モーダル）にもあったため、あわせて修正した。',
    type: 'バグ修正',
    target: '企業検索（設定・テンプレート画面にも同種の対応あり）',
    version: 'version 93',
    note: 'クリック領域の不具合自体は、コード上・検証環境では再現できなかったため、確実な改善（ラベルの明示的な関連付け）のみを実施した。実機での改善状況の確認が必要。',
    commit: '97411ba',
  },
  {
    summary: '企業検索結果を1社ずつ確認する方式から、チェックボックスで複数選択して一括保存できる一覧表示に変更した。保存件数が多くてもGoogle Apps Scriptの実行時間制限に抵触しないよう、Webサイト解析は保存直前に1件ずつ行う設計にした。',
    type: '機能追加',
    target: '企業検索',
    version: 'version 93',
    note: '',
    commit: '97411ba',
  },
  {
    summary: '営業リストタブに、保存されている企業のうち1社しか表示されない不具合を修正した。送信済み・未送信を問わず、保存済みの全企業が表示されるようにした。',
    type: 'バグ修正',
    target: '営業管理（営業リストタブ）',
    version: 'version 94',
    note: '',
    commit: 'cd8899e',
  },
  {
    summary: '返信確認タブの表示条件（返信が来た企業のみ表示）が仕様どおりであることを確認した（変更不要と判断）。あわせて、営業リスト一覧の「送信状況」「返信有無」列を、未送信・未返信は赤系、送信済み・返信ありは青系の文字色で色分けし、視認性を高めた。',
    type: 'UI改善',
    target: '営業管理（営業リストタブ・返信確認タブ）',
    version: 'version 95',
    note: '',
    commit: 'bad0c74',
  },
  {
    summary: '画面をスクロールすると左側のメニュー（サイドバー）も一緒に流れて見えなくなる不具合を修正し、常に画面内に固定表示されるようにした。',
    type: 'バグ修正',
    target: '全画面共通（サイドバー）',
    version: 'version 96',
    note: '',
    commit: 'b6407be',
  },
  {
    summary: '社内配布用の取扱説明書を作成するための元情報（画面一覧・操作フロー・ボタン説明・権限差分・注意点・エラー対処）をドキュメントとしてまとめた。',
    type: 'ドキュメント整備',
    target: '全画面共通（取扱説明書ドキュメント）',
    version: 'デプロイなし',
    note: 'アプリ本体のコード変更を伴わないドキュメント作業のため、デプロイは実施していない。',
    commit: '895bf16',
  },
  {
    summary: '上記の取扱説明書を、社内配布用のGoogleスプレッドシートとして自動生成する管理者向けユーティリティ関数を追加した。',
    type: '機能追加',
    target: 'バックエンド保守用ユーティリティ（取扱説明書生成）',
    version: 'デプロイなし',
    note: 'Webアプリ自体の動作には影響しない管理者向けユーティリティのため、clasp pushのみでclasp deployは実施していない。',
    commit: 'f09cda1',
  },
  {
    summary: '取扱説明書スプレッドシート生成機能が、共有設定の処理でエラーになり途中で止まる不具合を修正した。あわせて、再実行時に前回作成分の重複ファイルを自動整理する処理を追加した。',
    type: 'バグ修正',
    target: 'バックエンド保守用ユーティリティ（取扱説明書生成）',
    version: 'デプロイなし',
    note: 'Webアプリ自体の動作には影響しない管理者向けユーティリティのため、clasp deployは実施していない。',
    commit: '1847205',
  },
  {
    summary: '取扱説明書に、アプリへのアクセス方法・ログイン手順の説明が抜けていたため追加した。',
    type: 'ドキュメント整備',
    target: 'バックエンド保守用ユーティリティ（取扱説明書生成）',
    version: 'デプロイなし',
    note: 'Webアプリ自体の動作には影響しない管理者向けユーティリティのため、clasp deployは実施していない。',
    commit: 'adaf87b',
  },
  {
    summary: '設定画面のユーザー管理一覧で、これまで表示のみだった利用者の名前を、その場で編集・保存できるようにした。',
    type: '機能追加',
    target: '設定画面（ユーザー管理）',
    version: 'version 97',
    note: '',
    commit: '1b1c724',
  },
  {
    summary: '設定画面自体を一般ユーザーも開けるようにしたうえで、「Gmail設定（送信者情報）」は全員が自分の名前・電話番号・メールアドレスを編集できるようにした。それ以外の管理者専用設定（Gemini API設定・システム設定・デフォルト値設定・ユーザー管理）は引き続き管理者のみに限定した。営業メールの署名も、送信した本人の情報が使われるように変更した。',
    type: '機能追加',
    target: '設定画面、営業メール送信',
    version: 'version 98',
    note: '従来共通だった「担当者名」は、今後は各利用者自身のログイン名が使われる。名前を一度も変更していない利用者は、運用開始前に設定画面で自分の担当者名・電話番号・メールアドレスを確認・設定することを推奨する。',
    commit: '018828a',
  },
];

// docs/manual-source.md用に作成したbuildManualRichText_と同様の考え方で、種別列の
// キーワード（機能追加/バグ修正/UI改善/ドキュメント整備）に既存アプリと同系統の色を付ける。
// このファイルは他のScripts/配下ファイルに依存しない単独のユーティリティとして完結させるため、
// GenerateManual.jsの関数は再利用せず、同じ考え方で独立に実装している。
function buildTaskReportRichText_(rawValue) {
  var text = String(rawValue == null ? '' : rawValue);
  var builder = SpreadsheetApp.newRichTextValue().setText(text);

  TASK_REPORT_TYPE_COLORS.forEach(function (pair) {
    var keyword = pair[0];
    var color = pair[1];
    var idx = text.indexOf(keyword);
    while (idx !== -1) {
      builder.setTextStyle(idx, idx + keyword.length, SpreadsheetApp.newTextStyle().setForegroundColor(color).build());
      idx = text.indexOf(keyword, idx + keyword.length);
    }
  });

  return builder.build();
}

// 本日の作業内容を、社内提出用の作業報告書として新規Googleスプレッドシートに出力する。
// Apps Scriptエディタの実行対象一覧に表示されるよう、アンダースコアなしの関数名にしている。
function generateTodayTaskReport() {
  var ss = SpreadsheetApp.create(TASK_REPORT_TITLE);
  var sheet = ss.getSheets()[0];
  sheet.setName('作業報告書');

  var titleRange = sheet.getRange(1, 1);
  titleRange.setValue('Sales Pilot AI 作業報告書');
  titleRange.setFontWeight('bold');
  titleRange.setFontSize(16);
  titleRange.setBackground(TASK_REPORT_HEADER_BG);

  sheet.getRange(2, 1).setValue('作成日: ' + TASK_REPORT_DATE);
  sheet.getRange(3, 1).setValue('対象期間: ' + TASK_REPORT_PERIOD);
  sheet.getRange(4, 1).setValue('対象システム: ' + TASK_REPORT_SYSTEM_NAME);

  var tableStartRow = 6;
  var headers = ['No.', '対応内容', '種別', '対象画面・機能', 'デプロイバージョン', '備考'];
  var rows = TASK_REPORT_ITEMS.map(function (item, index) {
    return [index + 1, item.summary, item.type, item.target, item.version, item.note || ''];
  });

  var matrix = [headers].concat(rows);
  var richTextMatrix = matrix.map(function (row) {
    return row.map(function (cell) {
      return buildTaskReportRichText_(cell);
    });
  });

  var tableRange = sheet.getRange(tableStartRow, 1, matrix.length, headers.length);
  tableRange.setRichTextValues(richTextMatrix);
  tableRange.setBorder(true, true, true, true, true, true);

  var headerRange = sheet.getRange(tableStartRow, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(TASK_REPORT_HEADER_BG);
  sheet.setFrozenRows(tableStartRow);

  sheet.autoResizeColumns(1, headers.length);

  var url = ss.getUrl();
  Logger.log('本日の作業報告書スプレッドシートを作成しました: ' + url);
  return url;
}
