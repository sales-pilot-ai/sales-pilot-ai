// 取扱説明書スプレッドシート生成（Apps Scriptエディタから手動実行する一回限りのユーティリティ）。
// docs/manual-source.md の内容を、社内配布用の新規Googleスプレッドシートとして出力する。
// 既存の営業データのスプレッドシート・アプリ本体のRouter/Service/Viewには一切触れない。
// docs/manual-source.md はApps Script実行環境から読めないため、内容はこのファイル内に
// データとして書き写している（要約・省略はしていない。原文は docs/manual-source.md 参照）。

// 既存アプリのステータス色分け（Views/Style.html の --color-error / --color-accent）と
// 合わせた色。ヘッダー背景は薄い青系。
var MANUAL_COLOR_DANGER = '#d93025';
var MANUAL_COLOR_INFO = '#1a73e8';
var MANUAL_HEADER_BG = '#e8f0fe';

// 「未送信」「未返信」は赤系、「送信済み」「返信あり」は青系にする（追加依頼の指定）。
var MANUAL_KEYWORD_COLORS = [
  ['未送信', MANUAL_COLOR_DANGER],
  ['未返信', MANUAL_COLOR_DANGER],
  ['送信済み', MANUAL_COLOR_INFO],
  ['返信あり', MANUAL_COLOR_INFO],
];

// docs/manual-source.md の "**太字**" 記法を、Sheetsのリッチテキストの太字表示に変換しつつ、
// 上記キーワードに既存アプリと同じ文字色を付けたRichTextValueを構築する。
function buildManualRichText_(rawText) {
  var text = String(rawText == null ? '' : rawText);
  var clean = '';
  var boldRanges = [];
  var i = 0;
  while (i < text.length) {
    var start = text.indexOf('**', i);
    if (start === -1) {
      clean += text.slice(i);
      break;
    }
    clean += text.slice(i, start);
    var end = text.indexOf('**', start + 2);
    if (end === -1) {
      clean += text.slice(start + 2);
      break;
    }
    var boldStart = clean.length;
    clean += text.slice(start + 2, end);
    boldRanges.push([boldStart, clean.length]);
    i = end + 2;
  }

  var builder = SpreadsheetApp.newRichTextValue().setText(clean || '');
  boldRanges.forEach(function (range) {
    if (range[1] > range[0]) {
      builder.setTextStyle(range[0], range[1], SpreadsheetApp.newTextStyle().setBold(true).build());
    }
  });

  MANUAL_KEYWORD_COLORS.forEach(function (pair) {
    var keyword = pair[0];
    var color = pair[1];
    var idx = clean.indexOf(keyword);
    while (idx !== -1) {
      builder.setTextStyle(idx, idx + keyword.length, SpreadsheetApp.newTextStyle().setForegroundColor(color).build());
      idx = clean.indexOf(keyword, idx + keyword.length);
    }
  });

  return builder.build();
}

// ヘッダー行+本文行からなる表を指定シートの先頭（startRow）へ書き込み、
// ヘッダー太字+背景色+固定表示、罫線、列幅自動調整を適用する。
function writeManualTable_(sheet, startRow, headers, rows) {
  var numCols = headers.length;
  var matrix = [headers].concat(rows);
  var richTextMatrix = matrix.map(function (row) {
    return row.map(function (cell) {
      return buildManualRichText_(cell);
    });
  });

  var range = sheet.getRange(startRow, 1, matrix.length, numCols);
  range.setRichTextValues(richTextMatrix);
  range.setBorder(true, true, true, true, true, true);

  var headerRange = sheet.getRange(startRow, 1, 1, numCols);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(MANUAL_HEADER_BG);
  sheet.setFrozenRows(startRow);

  sheet.autoResizeColumns(1, numCols);

  return startRow + matrix.length;
}

// 見出し1行+本文複数行（罫線なしの単純なリスト）をシートの先頭（startRow）へ書き込み、
// 見出し太字+背景色+固定表示、列幅自動調整を適用する。
function writeManualList_(sheet, startRow, headerText, lines) {
  var headerRange = sheet.getRange(startRow, 1);
  headerRange.setRichTextValue(buildManualRichText_(headerText));
  headerRange.setFontWeight('bold');
  headerRange.setBackground(MANUAL_HEADER_BG);
  sheet.setFrozenRows(startRow);

  var richTextRows = lines.map(function (line) {
    return [buildManualRichText_(line)];
  });
  if (richTextRows.length > 0) {
    sheet.getRange(startRow + 1, 1, richTextRows.length, 1).setRichTextValues(richTextRows);
  }

  sheet.autoResizeColumns(1, 1);
  return startRow + 1 + richTextRows.length;
}

// 罫線・固定表示を伴わない補足段落（見出し+本文行）を、既存の表の下に追記する。
function appendManualNote_(sheet, startRow, headerText, lines) {
  var headerRange = sheet.getRange(startRow, 1);
  headerRange.setRichTextValue(buildManualRichText_(headerText));
  headerRange.setFontWeight('bold');

  var richTextRows = lines.map(function (line) {
    return [buildManualRichText_(line)];
  });
  if (richTextRows.length > 0) {
    sheet.getRange(startRow + 1, 1, richTextRows.length, 1).setRichTextValues(richTextRows);
  }

  sheet.autoResizeColumns(1, 1);
}

// ===== 1. 画面一覧タブ（docs/manual-source.md 「1. 画面一覧とできること」） =====

var MANUAL_SCREENS_HEADERS = ['サイドバー項目', '画面', 'できること'];
var MANUAL_SCREENS_ROWS = [
  [
    '📊 Dashboard',
    'Dashboard',
    '営業活動の主要な件数・割合（返信あり件数、送信待ち件数、商談中件数、本日のアクション件数、成約件数、返信率、送信成功率、成約率）の確認。「本日フォローすべき企業」の一覧確認。企業検索画面への入口',
  ],
  [
    '📇 営業管理',
    '営業管理（営業リスト／一括送信／返信確認の3タブ構成）',
    '保存済み企業の一覧確認・絞り込み、AI企業分析、営業メール下書き生成・Gmail下書き作成・送信、ステータス変更、未送信企業への一括送信、受信した返信の確認・返信対応',
  ],
  [
    '（営業管理画面右上の「＋ 企業を追加」から遷移。サイドバーに直接の項目はありません）',
    '企業検索',
    'Google Mapsを使った新規企業候補の検索、内容確認、選択した企業の営業リストへの保存',
  ],
  [
    '📄 テンプレート（Admin専用）',
    'テンプレート',
    '営業メールテンプレート・返信テンプレートの一覧確認・新規作成・編集・削除・プレビュー',
  ],
  [
    '📅 フォローアップ',
    'Dashboard（フォローアップ欄にフォーカスするため、実体はDashboard画面と同じ）',
    '本日フォローすべき企業の確認（Dashboard画面の該当欄と同一内容）',
  ],
  [
    '📈 レポート',
    'レポート',
    '営業件数・送信率・返信率・商談率・成約率・直近6か月の月別送信件数推移グラフの確認',
  ],
  [
    '⚙️ 設定（Admin専用）',
    '設定',
    'Gmail送信者情報・Gemini API設定・システム設定・デフォルト値設定の確認・変更、利用ユーザーの管理（追加・権限変更・削除）',
  ],
  ['（下部）ユーザー名表示', '-', 'ログイン中のGoogleアカウント名の表示のみ'],
  [
    '（下部）🚪 ログアウト',
    '-',
    'Googleアカウント全体からのログアウト（このアプリだけのログアウトではない点に注意。「5. 利用者が知っておくべき注意点」参照）',
  ],
];
var MANUAL_SCREENS_NOTE = [
  '※「受信トレイ」という画面（Inbox）もアプリ内部には存在しますが、現在のメニュー・画面のどこからもリンクされておらず、通常の操作では開けません。同等の機能（受信メールの確認・返信）は「営業管理」画面の「返信確認」タブに統合されています。そのため、以降の説明では「受信トレイ」単体は扱いません。',
];

function writeScreensSheet_(sheet) {
  var nextRow = writeManualTable_(sheet, 1, MANUAL_SCREENS_HEADERS, MANUAL_SCREENS_ROWS);
  appendManualNote_(sheet, nextRow + 1, '補足', MANUAL_SCREENS_NOTE);
}

// ===== 2. 操作フロータブ（docs/manual-source.md 「2. 各画面の操作フロー」） =====

var MANUAL_FLOW_SECTIONS = [
  {
    screen: 'アプリへのアクセスとログイン',
    steps: [
      '管理者から共有されたURL（このアプリのWebアプリURL）にブラウザでアクセスする',
      'Googleアカウントのログイン画面が表示された場合は、会社で使用しているGoogleアカウントを選択してログインする',
      '初回アクセス時、まだ利用者として登録されていない場合は「権限が設定されていません」という画面が表示されることがある。その場合は管理者（Admin権限を持つ利用者）に連絡し、利用者登録を依頼する（「6. よくあるエラーと対処」の該当項目も参照）',
      'ログインに成功すると、左サイドバーとDashboard画面が表示される',
      '毎回ログインし直す必要はなく、通常はブラウザにログイン状態が保持されたまま次回からもそのまま開ける',
      'URLはブラウザにブックマークしておくと、次回から素早く開ける',
    ],
  },
  {
    screen: 'Dashboard',
    steps: [
      '画面を開くと、5つの集計カード（返信あり／送信待ち／商談中／本日のアクション／成約の件数）と、3つの割合カード（返信率／送信成功率／成約率）が自動的に表示される',
      '集計カードをクリックすると、営業管理画面（営業リストタブ）へ該当する条件で絞り込んだ状態で遷移する',
      '画面下部の「本日フォローすべき企業」一覧で、会社名をクリックすると営業管理画面へその会社名で絞り込んだ状態で遷移する',
      '「企業を検索する」ボタンから企業検索画面へ遷移できる',
    ],
  },
  {
    screen: '企業検索 → 営業リストへの保存',
    steps: [
      'Dashboardの「企業を検索する」ボタン、または営業管理画面右上の「＋ 企業を追加」から企業検索画面を開く',
      '「業種」「エリア」（任意入力、空欄でも検索可）と「取得件数」（1〜50件、デフォルト20件）を入力する',
      '必要であれば「Webサイト解析をスキップする」にチェックを入れる（チェックすると、保存時にホームページのメールアドレス・お問い合わせフォームの自動取得を行わない）',
      '「検索実行」を押すと、Google Maps上の候補が一覧（カード形式）で表示される。デフォルトで全件チェックが入った状態になる',
      '内容を確認し、保存したくない候補のチェックを外す（「全選択」「全解除」ボタンで一括切り替えも可能）',
      '「選択した企業を保存」を押すと、チェックが入っている候補だけを1件ずつ保存する（「Webサイト解析をスキップする」を指定していない場合、保存直前に候補ごとにホームページ解析を行いメールアドレス等を取得する）',
      '保存中は「保存中… n/m件」の進捗が表示され、完了すると各カードに結果（追加しました／既存企業を更新しました／変更なし／保存に失敗しました）が表示され、完了後にサマリー（追加◯件／重複更新◯件／変更なし◯件／失敗◯件／未保存◯件）が表示される',
      '保存済みのカードはチェックボックスが操作不可になり、未選択のまま残った候補と見た目で区別できる',
    ],
  },
  {
    screen: '営業管理 - 営業リストタブ',
    steps: [
      '画面を開くと、保存済みの全企業が一覧表示される（送信状況・返信有無を問わない）',
      '「絞り込み」欄でキーワード（会社名・住所）・業種・送信状況・送信可否を指定し「絞り込む」を押すと条件で絞り込める',
      'その下のステータスチップ（すべて／送信待ち／返信あり／商談中／本日商談／成約）をクリックすると、絞り込み結果に対してさらに簡易フィルタを重ねられる',
      '一覧の左端チェックボックスで1件以上の企業を選択すると、「選択中の企業に：」欄のAI分析・送信・ステータス変更ボタンが操作可能になる',
      '各行の「AI分析」ボタンで個社ごとにAI企業分析を実行し、AI要約列に結果が反映される（AI要約セルはクリックすると全文をポップアップ表示できる）',
      '「営業メール生成」で分析結果をもとに営業メール下書き（件名・本文）を生成、「Gmail下書き作成」でGmailの下書きフォルダへ保存、「送信」で実際に送信する（送信前に確認ダイアログが出る）',
      '「履歴」ボタンで、その企業とのメールのやり取り履歴（送受信スレッド）を確認できる',
      '選択した企業に対して、一括でAI分析・一括送信・一括ステータス変更を実行できる（1件ずつ順番に処理され、進捗バーが表示される）',
      '一括ステータス変更を行うと、完了後5秒間「元に戻す」ボタン付きの通知バーが表示され、押すと変更前のステータスに一括で戻せる',
    ],
  },
  {
    screen: '営業管理 - 一括送信タブ',
    steps: [
      'タブを開くと、まだ一度も送信していない企業（送信可否が「○」かつ送信状況が「未送信」の企業）が自動的に一覧表示される',
      '送信したい企業にチェックを入れる（デフォルトは未選択。全選択チェックボックスで一括選択も可能）',
      '「送信テンプレート」を選択する（デフォルトテンプレートが自動選択される）',
      '「選択した企業へ一括送信」を押すと確認ダイアログが出て、承認すると選択企業へ1件ずつ「AI分析→営業メール生成→送信」を自動実行する',
      '進捗バーが表示され、完了すると成功・失敗件数がトースト通知される',
    ],
  },
  {
    screen: '営業管理 - 返信確認タブ',
    steps: [
      'タブを開くと「返信を同期」ボタンと最終同期日時が表示される（返信の取り込みは1時間ごとに自動でも行われるため、通常は手動で押す必要はない。至急確認したい場合のみ使用）',
      '「新着返信」サブタブには、返信があり・まだ対応中にしていない企業がカード表示される。各カードで「AI要約を見る」「AIがおすすめする返信内容」を確認し、「対応済みにする」を押すと「継続返信」サブタブへ移動する',
      '「継続返信」サブタブでは、左側の企業一覧から1社を選ぶと、右側にその企業とのメールのやり取りがチャット形式で時系列表示される。「AI返信案を作成」でAIによる返信文案を生成し、内容を確認・編集して「送信」で返信する（送信前に確認ダイアログが出る）',
    ],
  },
  {
    screen: 'テンプレート（Admin専用）',
    steps: [
      '「営業メールテンプレート」「返信テンプレート」それぞれで「新規作成」を押し、表示名・件名（営業メールのみ）・本文を入力して保存する',
      '営業メールテンプレートの本文には {{personalizedNote}} {{salesPersonName}} {{salesPersonTel}} {{salesPersonMail}} {{timeRexUrl}} の差し込みタグを使用できる',
      '一覧の「編集」「プレビュー」「削除」で既存テンプレートを管理する。営業メールテンプレートのみ「デフォルトに設定」があり、一括送信タブ・営業リストタブの営業メール生成で使われる既定テンプレートを切り替えられる',
    ],
  },
  {
    screen: 'レポート',
    steps: ['画面を開くと自動的に、営業件数・送信率・返信率・商談率・成約率と、直近6か月の月別送信件数の推移グラフが表示される（操作は閲覧のみ）'],
  },
  {
    screen: '設定（Admin専用）',
    steps: [
      '「Gmail設定」「Gemini API設定」「システム設定」「デフォルト値設定」の各項目を入力・変更し、「保存」を押す（APIキー欄は現在の値を表示せず「設定済み／未設定」のみ表示。変更したい場合のみ入力する。空欄のまま保存すると既存のキーは変更されない）',
      '「ユーザー管理」欄で、「新規ユーザー追加」から名前・メールアドレス・権限（User／Admin）を指定して利用者を追加できる',
      '一覧の権限プルダウンから直接、既存ユーザーの権限（User⇔Admin）を変更できる',
      '「削除」ボタンで利用者を削除できる（自分自身、および最後の1人のAdminは削除・権限変更できないよう保護されている）',
    ],
  },
];

function writeFlowSheet_(sheet) {
  var headers = ['画面', 'No', '手順'];
  var rows = [];
  MANUAL_FLOW_SECTIONS.forEach(function (section) {
    section.steps.forEach(function (step, index) {
      rows.push([section.screen, index + 1, step]);
    });
  });
  writeManualTable_(sheet, 1, headers, rows);
}

// ===== 3. ボタン説明タブ（docs/manual-source.md 「3. ボタン・入力欄ごとの機能説明」） =====

var MANUAL_BUTTONS_SECTIONS = [
  {
    screen: 'Dashboard',
    rows: [
      ['返信あり／送信待ち／商談中／本日のアクション／成約カード', 'クリック可能なカード', 'クリックすると営業管理画面（営業リストタブ）へ対応する条件で絞り込んだ状態で遷移'],
      ['返信率／送信成功率／成約率カード', '表示のみ', '割合の表示のみ（返信率＝送信済のうち返信あり、送信成功率＝送信可否○のうち送信済、成約率＝成約+失注のうち成約）'],
      ['企業を検索する', 'ボタン（リンク）', '企業検索画面へ遷移'],
      ['メールを送信する', 'ボタン（無効化済み）', '未実装のため常に押せない'],
      ['本日フォローすべき企業一覧の会社名リンク', 'リンク', '営業管理画面へその会社名で絞り込んだ状態で遷移'],
    ],
  },
  {
    screen: '企業検索',
    rows: [
      ['業種', '入力欄（任意）', '検索条件（部分一致ではなくMaps検索キーワードの一部として使用）'],
      ['エリア', '入力欄（任意）', '検索条件'],
      ['取得件数', '数値入力（1〜50、既定20）', '取得する候補の最大件数'],
      ['Webサイト解析をスキップする', 'チェックボックス', 'チェック時は保存時も含めホームページ解析を一切行わない'],
      ['検索実行', 'ボタン', 'Google Mapsで検索を実行し、候補一覧を表示'],
      ['全選択／全解除', 'ボタン', '一覧全体の保存対象チェックを一括切り替え（既に保存済みの候補は対象外）'],
      ['選択した企業を保存', 'ボタン', 'チェックが入っている候補のみ、営業リストへ1件ずつ保存'],
      ['各候補カードのチェックボックス', 'チェックボックス', 'その候補を保存対象にするかどうか（デフォルトON）'],
    ],
  },
  {
    screen: '営業管理 - 営業リストタブ',
    rows: [
      ['＋ 企業を追加', 'ボタン（リンク）', '企業検索画面へ遷移'],
      ['会社名・住所で検索', '入力欄', 'キーワード絞り込み（会社名・住所を対象）'],
      ['業種（すべて）', 'プルダウン', '業種で絞り込み'],
      ['送信状況（すべて）', 'プルダウン', '送信状況（未送信／送信済／送信失敗／返信あり／配信停止）で絞り込み'],
      ['送信可否（すべて）', 'プルダウン', '送信可否（○／×）で絞り込み'],
      ['絞り込む', 'ボタン', '上記条件で一覧を再取得'],
      ['すべて／送信待ち／返信あり／商談中／本日商談／成約', 'ステータスチップ', '絞り込み結果に対する簡易フィルタ（クライアント側処理）'],
      ['選択中の企業に：AI分析／送信／ステータス変更', 'ボタン（1件以上選択時のみ有効）', '選択した企業への一括AI分析／一括送信／一括ステータス変更'],
      ['各行チェックボックス・全選択チェックボックス', 'チェックボックス', '一括操作の対象選択'],
      ['AI分析', 'ボタン', 'その企業のホームページをAIが解析し、AI要約列を更新'],
      ['履歴', 'ボタン', 'その企業とのメールやり取り履歴をモーダル表示'],
      ['営業メール生成', 'ボタン', 'AI分析結果をもとに営業メール下書き（件名・本文）を生成'],
      ['Gmail下書き作成', 'ボタン', '生成済みの下書きをGmailの下書きフォルダに作成（メールアドレス未登録の場合はエラー）'],
      ['送信', 'ボタン', '生成済みの下書きで実際に営業メールを送信（確認ダイアログあり。メールアドレス未登録の場合はエラー）'],
      ['AI要約セル', 'クリック可能なセル', 'クリックで全文をモーダル表示（「未解析」は反応しない）'],
      ['ステータス変更モーダルの変更先ステータス', 'プルダウン（送信待ち／送信済／返信あり／配信停止）', '選択企業の送信状況を一括変更'],
      ['元に戻す', 'ボタン（一括ステータス変更後5秒間のみ表示）', '直前の一括ステータス変更を取り消し'],
      ['ページ番号', 'ボタン', '1ページ20件でのページ送り'],
    ],
  },
  {
    screen: '営業管理 - 一括送信タブ',
    rows: [
      ['送信テンプレート', 'プルダウン', '一括送信に使用する営業メールテンプレートを選択'],
      ['選択した企業へ一括送信', 'ボタン', '選択企業へ1件ずつ「AI分析→営業メール生成→送信」を自動実行（確認ダイアログあり）'],
      ['各行チェックボックス・全選択チェックボックス', 'チェックボックス', '送信対象の選択'],
    ],
  },
  {
    screen: '営業管理 - 返信確認タブ',
    rows: [
      ['返信を同期', 'ボタン', 'Gmail受信状況を確認し、返信があった企業を「返信あり」に手動更新（自動でも1時間ごとに実行される）'],
      ['新着返信／継続返信', 'サブタブ切り替え', '表示対象の切り替え'],
      ['AI要約を見る', 'ボタン（新着返信カード内）', '受信メール本文のAI要約を表示'],
      ['AIがおすすめする返信内容', 'ボタン（新着返信カード内）', 'AIによる返信文案を表示'],
      ['対応済みにする', 'ボタン（新着返信カード内）', 'その企業を「対応中」にし、継続返信タブへ移動'],
      ['企業一覧（左側）', 'クリック可能な一覧', '継続返信タブでチャット表示する企業を選択'],
      ['AI返信案を作成', 'ボタン（チャット内）', 'AIによる返信文案を入力欄へ挿入'],
      ['送信（チャット内）', 'ボタン', '入力した返信をその企業へ送信（確認ダイアログあり）'],
    ],
  },
  {
    screen: 'テンプレート（Admin専用）',
    rows: [
      ['新規作成（営業メール／返信）', 'ボタン', '新規テンプレート作成モーダルを開く'],
      ['表示名・件名・本文テンプレート／本文', '入力欄', 'テンプレート内容'],
      ['編集', 'ボタン', '既存テンプレートの内容を編集'],
      ['プレビュー', 'ボタン', '差し込みタグを置き換えずそのまま表示'],
      ['デフォルトに設定（営業メールのみ）', 'ボタン', '一括送信・営業リストタブの営業メール生成で使う既定テンプレートに設定'],
      ['削除', 'ボタン', 'テンプレートを削除'],
    ],
  },
  {
    screen: 'レポート',
    rows: [['(なし)', '-', '閲覧専用画面のため、操作可能なボタン・入力欄はありません。']],
  },
  {
    screen: '設定（Admin専用）',
    rows: [
      ['担当者名・電話番号・メールアドレス', '入力欄', '営業メール・返信メールの署名に使用する送信者情報'],
      ['APIキー（Gemini）', 'パスワード入力欄', 'Gemini APIキー（現在値は表示されず「設定済み／未設定」のみ表示。空欄で保存すると変更されない）'],
      ['使用モデル', '入力欄', '使用するGeminiモデル名'],
      ['スプレッドシートID', '入力欄', '営業リスト等のデータ保存先スプレッドシートのID'],
      ['Google Maps APIキー', 'パスワード入力欄', '企業検索（Google Maps）に使用するAPIキー（Geminiキーと同様、空欄保存で変更なし）'],
      ['TimeRex（日程調整）URL', '入力欄', '営業メールテンプレートの差し込みタグで使用する日程調整URL'],
      ['保存', 'ボタン', '上記設定の保存'],
      ['新規ユーザー追加', 'ボタン', '名前・メールアドレス・権限を指定して利用者を追加するモーダルを開く'],
      ['権限プルダウン（ユーザー一覧）', 'プルダウン', 'User⇔Adminの切り替え（自分自身・最後の1人のAdminは変更不可）'],
      ['削除（ユーザー一覧）', 'ボタン', '利用者を削除（自分自身・最後の1人のAdminは削除不可）'],
    ],
  },
];

function writeButtonsSheet_(sheet) {
  var headers = ['画面', '項目', '種別', '機能'];
  var rows = [];
  MANUAL_BUTTONS_SECTIONS.forEach(function (section) {
    section.rows.forEach(function (row) {
      rows.push([section.screen].concat(row));
    });
  });
  writeManualTable_(sheet, 1, headers, rows);
}

// ===== 4. 権限の違いタブ（docs/manual-source.md 「4. User権限とAdmin権限の違い」） =====

var MANUAL_PERMISSIONS_HEADERS = ['項目', 'User', 'Admin'];
var MANUAL_PERMISSIONS_ROWS = [
  ['Dashboard／企業検索／営業管理（営業リスト・一括送信・返信確認）／レポート', '利用可能', '利用可能'],
  ['テンプレート画面（営業メール・返信テンプレートの一覧閲覧）', '利用可能（一括送信タブのテンプレート選択・返信確認タブの定型文選択で使用）', '利用可能'],
  ['テンプレートの新規作成・編集・削除・デフォルト切り替え', '**不可**（テンプレート画面自体を開けない）', '可能'],
  ['設定画面（Gmail・Gemini・システム・デフォルト値設定）', '**不可**（サイドバーに表示されず、URLを直接指定してもアクセス拒否される）', '可能'],
  ['ユーザー管理（利用者の追加・権限変更・削除）', '**不可**', '可能'],
  ['営業メール・返信メールの送信、AI分析・下書き生成、ステータス変更、企業の保存・一括送信、返信の同期・返信対応', 'すべて可能', 'すべて可能'],
];
var MANUAL_PERMISSIONS_NOTE = [
  '権限は「設定」画面の「ユーザー管理」でAdminが個別に設定する（Userが自分で昇格することはできない）',
  'Admin専用の画面はサイドバーに表示されないだけでなく、URLを直接指定してアクセスしようとしても「アクセス権限がありません」という画面が表示され、実際の操作はできない',
  'Admin権限を持つ利用者が0人にならないよう、最後の1人のAdminは自分自身も含め、権限変更・削除ができない仕組みになっている',
];

function writePermissionsSheet_(sheet) {
  var nextRow = writeManualTable_(sheet, 1, MANUAL_PERMISSIONS_HEADERS, MANUAL_PERMISSIONS_ROWS);
  appendManualNote_(sheet, nextRow + 1, '補足', MANUAL_PERMISSIONS_NOTE);
}

// ===== 5. 注意点タブ（docs/manual-source.md 「5. 利用者が知っておくべき注意点」） =====

var MANUAL_NOTES_LINES = [
  '**返信の同期は1時間ごとに自動実行される**。「返信確認」タブの「返信を同期」ボタンは、今すぐ最新の返信状況を反映したい場合にのみ使う手動トリガーであり、通常は自分で押さなくても最新の状態に近づく',
  '**返信の同期・企業検索・一括送信・一括AI分析などの処理は、対象企業数が多いと時間がかかる**。特に「返信を同期」は登録されている全企業のメールアドレスを順にチェックする処理のため、企業数が非常に多い場合は完了までに時間がかかることがある。実行中は画面を閉じずに待つこと',
  '一括送信・一括AI分析・一括ステータス変更・企業検索での複数保存は、いずれも1件ずつ順番に処理される仕組みになっており、対象件数が多いほど完了までの時間が伸びる。処理中は進捗バー（「◯ / ◯件」）が表示されるので、それを目安に待つこと',
  '「送信」ボタンでの営業メール送信、返信画面での返信送信は、いずれも**送信後に取り消すことはできない**。送信前に必ず内容を確認すること（確認ダイアログが表示される）',
  '営業メールの送信・Gmail下書き作成には、対象企業に**メールアドレスが登録されている必要がある**。メールアドレスが未登録の企業に対して実行するとエラーになる',
  '営業メールの送信・Gmail下書き作成の前には、その企業に対して「AI分析」→「営業メール生成」の順で下書きを作成しておく必要がある（下書きが無い状態で送信・Gmail下書き作成を行うとエラーになる）',
  'サイドバーの「ログアウト」は、このアプリだけでなく**Googleアカウント全体からログアウトする**（確認ダイアログが表示される）',
  '設定画面のAPIキー入力欄は、現在の値を表示しない仕様になっている（セキュリティのため）。「設定済み」と表示されていれば既に値が保存されており、空欄のまま保存しても変更されない。変更したい場合のみ新しい値を入力すること',
];

function writeNotesSheet_(sheet) {
  writeManualList_(sheet, 1, '利用者が知っておくべき注意点', MANUAL_NOTES_LINES);
}

// ===== 6. よくあるエラータブ（docs/manual-source.md 「6. よくあるエラーと対処」） =====

var MANUAL_ERRORS_HEADERS = ['症状', '原因', '対処'];
var MANUAL_ERRORS_ROWS = [
  [
    'アプリを開くと「権限が設定されていません」と表示される',
    'ログイン中のGoogleアカウントが、このアプリの利用者として登録されていない',
    '管理者（Admin権限を持つ利用者）に連絡し、「設定」画面の「ユーザー管理」から自分のメールアドレスを追加してもらう',
  ],
  [
    '特定の画面（テンプレート・設定）を開くと「アクセス権限がありません」と表示される',
    'User権限のアカウントで、Admin専用の画面を開こうとした',
    'Admin権限が必要な操作のため、Admin権限を持つ利用者に依頼するか、必要であれば管理者に権限変更を依頼する',
  ],
  [
    '「メールアドレスが未登録のため、Gmail下書きを作成できません／営業メールを送信できません」と表示される',
    '対象企業に営業リスト上のメールアドレスが登録されていない',
    '営業リストでその企業のメールアドレスを確認・登録する（企業検索の保存時にWebサイト解析でメールアドレスが自動取得されなかった場合など）',
  ],
  [
    '「営業メールの下書きが見つかりません。先に営業メール生成を実行してください。」と表示される',
    'Gmail下書き作成・送信の前に、営業メールの下書き（AI分析→営業メール生成）が作られていない',
    '先にその企業の「AI分析」→「営業メール生成」を実行してから、改めてGmail下書き作成・送信を行う',
  ],
  [
    '「返信の同期処理は既に実行中です。しばらくしてから再度お試しください。」と表示される',
    '自動実行（1時間ごと）や他の利用者の操作と、手動の「返信を同期」がほぼ同時に重なった',
    '少し時間を置いてから再度「返信を同期」を押す',
  ],
  [
    '一括操作（AI分析・送信・ステータス変更・一括送信・企業の複数保存）で一部だけ失敗する',
    '個々の企業でエラーが発生した場合でも、他の企業への処理は続けて実行される仕様のため、完了後の件数表示に失敗件数が含まれることがある',
    '完了後に表示される「成功◯件／失敗◯件」やサマリーを確認し、失敗した企業については営業リストの該当行から個別に再実行する',
  ],
  [
    'データの入力・保存後、一覧に反映されない／古い内容のまま',
    '一覧はボタン操作のタイミングで都度取得している。裏側でデータが更新されても自動では再取得されない画面がある',
    '該当のタブ・画面を開き直す、または絞り込み・検索を再実行して最新の一覧を取得する',
  ],
];

function writeErrorsSheet_(sheet) {
  writeManualTable_(sheet, 1, MANUAL_ERRORS_HEADERS, MANUAL_ERRORS_ROWS);
}

// ===== 表紙タブ =====

var MANUAL_TARGET_VERSION = 'version 96';

function writeCoverSheet_(sheet, spreadsheet, tabSheets) {
  var titleRange = sheet.getRange(1, 1);
  titleRange.setValue('Sales Pilot AI 取扱説明書');
  titleRange.setFontWeight('bold');
  titleRange.setFontSize(16);
  titleRange.setBackground(MANUAL_HEADER_BG);
  sheet.setFrozenRows(1);

  sheet.getRange(2, 1).setValue('対象バージョン: ' + MANUAL_TARGET_VERSION);
  sheet.getRange(3, 1).setValue('作成日: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));

  var tocHeaderRow = 5;
  var tocHeaderRange = sheet.getRange(tocHeaderRow, 1);
  tocHeaderRange.setValue('目次');
  tocHeaderRange.setFontWeight('bold');

  var baseUrl = spreadsheet.getUrl();
  tabSheets.forEach(function (tabSheet, index) {
    var row = tocHeaderRow + 1 + index;
    var label = tabSheet.getName();
    var link = baseUrl + '#gid=' + tabSheet.getSheetId();
    sheet.getRange(row, 1).setFormula('=HYPERLINK("' + link + '", "' + label + '")');
  });

  sheet.autoResizeColumns(1, 1);
}

var MANUAL_SPREADSHEET_TITLE = 'Sales Pilot AI 取扱説明書';

// 前回までの実行で作成された同名のスプレッドシート（共有設定前に落ちた中途半端なものや、
// 再実行による重複）をゴミ箱へ移動する。見つからない場合は何もしない。完全削除ではなく
// setTrashed(true)によるゴミ箱移動のため、誤って必要なファイルを消してもDrive側から復元できる。
function trashExistingManualSpreadsheets_() {
  var files = DriveApp.getFilesByName(MANUAL_SPREADSHEET_TITLE);
  var trashedCount = 0;
  while (files.hasNext()) {
    var file = files.next();
    file.setTrashed(true);
    trashedCount += 1;
  }
  if (trashedCount > 0) {
    Logger.log('前回実行分の同名スプレッドシートを' + trashedCount + '件ゴミ箱へ移動しました。');
  }
}

// スプレッドシートの共有設定を行う。DriveApp.Access.DOMAIN_WITH_LINK（同一ドメイン内で
// リンクを知っている人は閲覧可）はGoogle Workspaceのドメイン付きアカウントでのみ有効で、
// 個人のGoogleアカウント（例: @gmail.com）がスクリプトの実行者の場合、ファイルに紐づく
// ドメインが存在しないため「Invalid argument: permission.value」で失敗する。
// そのため、まずDOMAIN_WITH_LINKを試み、失敗した場合のみANYONE_WITH_LINK（リンクを知っている
// 人は誰でも閲覧可）にフォールバックする。フォールバックした場合はその旨をLogger.logに残す
// （ドメイン限定より共有範囲が広がるため、必要であれば手動で共有設定を絞ってもらう想定）。
function shareManualSpreadsheet_(ss) {
  var file = DriveApp.getFileById(ss.getId());
  try {
    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('共有設定: 同一ドメイン内でリンクを知っている人が閲覧可能です。');
    return;
  } catch (domainError) {
    Logger.log(
      '共有設定: ドメイン限定（DOMAIN_WITH_LINK）の設定に失敗したため、' +
        'リンクを知っている人は誰でも閲覧可（ANYONE_WITH_LINK）にフォールバックします。' +
        '（実行アカウントがGoogle Workspaceのドメイン付きアカウントでない場合に起こります） エラー: ' +
        domainError.message
    );
  }

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('共有設定: リンクを知っている人は誰でも閲覧可能です（ドメイン限定は使用できませんでした）。');
  } catch (anyoneError) {
    Logger.log(
      '共有設定に失敗しました。スプレッドシート自体は作成済みのため、Drive上で手動で共有設定を行ってください。エラー: ' +
        anyoneError.message
    );
  }
}

// docs/manual-source.md の内容を、社内配布用の新規Googleスプレッドシートとして出力する。
// Apps Scriptエディタの実行対象一覧に表示されるよう、アンダースコアなしの関数名にしている。
function generateManualSpreadsheet() {
  trashExistingManualSpreadsheets_();

  var ss = SpreadsheetApp.create(MANUAL_SPREADSHEET_TITLE);

  var coverSheet = ss.getSheets()[0];
  coverSheet.setName('表紙');

  var screensSheet = ss.insertSheet('画面一覧', 1);
  var flowSheet = ss.insertSheet('操作フロー', 2);
  var buttonsSheet = ss.insertSheet('ボタン説明', 3);
  var permissionsSheet = ss.insertSheet('権限の違い', 4);
  var notesSheet = ss.insertSheet('注意点', 5);
  var errorsSheet = ss.insertSheet('よくあるエラー', 6);

  writeScreensSheet_(screensSheet);
  writeFlowSheet_(flowSheet);
  writeButtonsSheet_(buttonsSheet);
  writePermissionsSheet_(permissionsSheet);
  writeNotesSheet_(notesSheet);
  writeErrorsSheet_(errorsSheet);
  writeCoverSheet_(coverSheet, ss, [screensSheet, flowSheet, buttonsSheet, permissionsSheet, notesSheet, errorsSheet]);

  shareManualSpreadsheet_(ss);

  var url = ss.getUrl();
  Logger.log('取扱説明書スプレッドシートを作成しました: ' + url);
  return url;
}
