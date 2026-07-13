// 画面(HTML)から google.script.run で呼ばれる公開関数を集約するRouter層。
// 実処理はService層に委譲し、ここでは薄く公開するのみとする（設計書⑤⑫参照）。

function getCurrentUser() {
  // 権限シート未導入のSprint1〜2では、メールアドレスのみを返す。
  // displayName/roleは権限シートが揃うSprintで拡張する（設計書⑪⑫参照）。
  const email = Session.getActiveUser().getEmail();
  return {
    email: email || null,
  };
}

// ②企業検索: 業種・エリア・取得件数を指定してMaps検索を実行し、候補一覧を返す（この時点では未保存）
function searchCompanies(params) {
  return searchCompaniesViaMaps_(params);
}

// ②企業検索: レビューで「保存」した1件を営業リストに追記・更新する
function saveCompanyCandidate(candidate) {
  const validationError = validateCompanyCandidate_(candidate);
  if (validationError) {
    throw new Error(validationError);
  }
  return upsertCompanyCandidate_(candidate);
}

// ②企業検索: 残りの候補を一括保存する
function saveAllCompanyCandidates(candidates) {
  return (candidates || []).map(function (candidate) {
    try {
      return saveCompanyCandidate(candidate);
    } catch (err) {
      return { status: 'error', message: err.message, companyId: null };
    }
  });
}

// ③営業リスト一覧: キーワード・業種・送信状況・送信可否を指定して一覧を取得する
function listCompanies(filter) {
  return listCompaniesFromSheet_(filter);
}

// ⑥AI分析: 対象企業のホームページをGeminiで解析し、企業分析シート・AI要約列を更新する
function analyzeCompanyInfo(companyId) {
  var company = findCompanyById_(companyId);
  if (!company) {
    throw new Error('企業が見つかりません（企業ID: ' + companyId + '）');
  }
  return analyzeCompanyWebsite_(companyId, company.companyName, company.websiteUrl);
}

// ⑥AI分析: 保存済みの企業分析結果を元に営業メール・DM下書き（件名・本文）を生成する。
// templateIdを省略した場合はデフォルトの営業メールテンプレートを使用する（Sprint7⑤）。
function generateSalesDraft(companyId, tone, templateId) {
  return generateSalesDraft_(companyId, tone, templateId);
}

// ⑦Gmail下書き作成: Step5で生成済みの営業メール下書き（件名・本文）を使ってGmailの下書きを作成する
// （送信は行わない）
function createGmailDraft(companyId) {
  return createGmailDraftForCompany_(companyId);
}

// ⑧営業メール送信: Step5で生成済みの営業メール下書き（件名・本文）を使って実際に送信する
// （Gmail下書き（Step6）は送信対象にしない）
function sendSalesMail(companyId) {
  return createSendMailForCompany_(companyId);
}

// ⑨営業メール一括送信: 送信可否=○・送信状況≠送信済の企業へ、Step7のcreateSendMailForCompany_を
// 1件ずつ実行する（Sprint4 Step8）。
function sendSalesMailBatch() {
  return sendSalesMailBatch_();
}

// ⑩受信トレイ一覧: 営業リストに登録されたメールアドレスからの返信のみを一覧表示する
// （Gmail受信トレイ全体ではなく営業メールへの返信に絞り込む。Sprint5 Step3）
function listInboxMessages() {
  return listSalesInboxMessages_();
}

// ⑪受信メール詳細取得: 受信トレイ一覧の行クリック時に本文を表示する（返信機能はStep11で実装する）
function getInboxMessageDetail(threadId) {
  return getInboxMessageDetail_(threadId);
}

// ⑫受信メール返信: 受信トレイの本文表示画面から、thread.reply()で返信を送信する（Sprint4 Step11）
function replyInboxMessage(threadId, body) {
  return replyInboxMessage_(threadId, body);
}

// ⑬返信有無の自動更新: 営業リストの各企業についてGmail受信を確認し、受信があれば
// 「返信あり」に更新する（Sprint4 Step12）
function syncReplyStatus() {
  return syncReplyStatus_();
}

// ⑭AI返信文生成: 受信トレイの本文表示画面から、Geminiで返信文の下書きのみを生成する（Sprint5 Step1）
function generateReplyDraft(threadId) {
  return generateReplyDraft_(threadId);
}

// ⑮返信テンプレート: 受信メール詳細画面で、AI返信とは別に定型文をワンクリックで挿入するための
// テンプレート一覧を返す（Sprint5 Step2で新設。Sprint7⑤でSheetsバックエンドへ移行し、
// テンプレート管理画面からも同じ一覧を参照する）
function getReplyTemplates() {
  return getReplyTemplates_();
}

// ⑳返信テンプレート管理（Sprint7⑤）: 作成・編集・削除。一覧はgetReplyTemplates()と共用する。
function createReplyTemplate(data) {
  return createReplyTemplate_(data);
}

function updateReplyTemplate(templateId, data) {
  return updateReplyTemplate_(templateId, data);
}

function deleteReplyTemplate(templateId) {
  return deleteReplyTemplate_(templateId);
}

// ㉑営業メールテンプレート管理（Sprint7⑤）: Sprint3 Step5の固定1種類テンプレートから、
// テンプレート管理画面での複数管理・デフォルト切り替えに対応する。
function listSalesTemplates() {
  return listSalesTemplates_();
}

function createSalesTemplate(data) {
  return createSalesTemplate_(data);
}

function updateSalesTemplate(templateId, data) {
  return updateSalesTemplate_(templateId, data);
}

function deleteSalesTemplate(templateId) {
  return deleteSalesTemplate_(templateId);
}

function setDefaultSalesTemplate(templateId) {
  return setDefaultSalesTemplate_(templateId);
}

// ㉒設定画面（Sprint7⑥）: スクリプトプロパティ（Gmail送信者情報・Gemini API・
// システム設定・デフォルト値）の参照・更新
function getSettings() {
  return getSettingsForAdmin_();
}

function updateSettings(data) {
  return updateSettings_(data);
}

// ㉓営業レポート（Sprint7⑦）: 総企業数・送信率・返信率・商談率・成約率・月別送信件数の推移を返す
// （読み取り専用）
function getReportStats() {
  return getReportStats_();
}

// ⑯メール履歴: 営業リストの企業とやり取りしたGmailスレッドをスレッド単位で取得し、
// 各スレッドの件名とメッセージ一覧（送受信・日時・本文全文）を返す
// （返信機能は追加しない。Sprint6 Step1で新設、Step2でスレッド単位表示へ変更）
function listCompanyMailHistory(companyId) {
  return listCompanyMailHistory_(companyId);
}

// ⑰ダッシュボード集計: 営業リストを集計し、返信あり・送信待ち・商談中・本日のアクション
// （本日商談予定）の件数を返す（読み取り専用。Sprint6 Step3）
function getDashboardStats() {
  return getDashboardStats_();
}

// ⑱本日のフォローアップ: 優先順位（本日商談予定→返信あり・未対応→送信待ち）に沿って
// フォロー対象企業を抽出し、会社名・担当者名・ステータス・対象理由を返す
// （読み取り専用。Sprint6 Step4）
function listTodayFollowUps() {
  return listTodayFollowUps_();
}

// ⑲ステータス一括変更: 営業リストの「送信状況」列を任意の値に更新する
// （一括操作バーのステータス変更から使用。Sprint6 Step12）
function updateCompanyStatus(companyId, status) {
  return updateCompanyStatus_(companyId, status);
}

// DEBUG (Sprint3 Step1動作確認用。確認後に削除する): 利用可能なGeminiモデル一覧を確認する。
function debugListGeminiModels() {
  var models = listAvailableGeminiModels_();
  Logger.log('debugListGeminiModels: ' + JSON.stringify(models));
  return models;
}

// DEBUG (Sprint3 Step1動作確認用。確認後に削除する): Gemini APIとの疎通確認。
// Apps Scriptエディタの関数選択から直接実行し、実行ログでレスポンスを確認する。
function debugTestGemini() {
  var model = getGeminiModel_();
  Logger.log('debugTestGemini: model=' + model);
  var result = callGemini_('こんにちは、と一言だけ日本語で返答してください。');
  Logger.log('debugTestGemini: result=' + result);
  return result;
}

// DEBUG (Sprint3 Step2動作確認用。確認後に削除する): 指定した企業ID 1件の企業情報解析を実行する。
// Apps Scriptエディタから直接実行し、実行ログで結果を確認する（UIへの組み込みはStep4で行う）。
function debugAnalyzeCompany(companyId) {
  var company = findCompanyById_(companyId);
  if (!company) {
    Logger.log('debugAnalyzeCompany: company not found for companyId=' + companyId);
    return null;
  }
  Logger.log('debugAnalyzeCompany: companyName=' + company.companyName + ', websiteUrl=' + company.websiteUrl);
  var result = analyzeCompanyWebsite_(companyId, company.companyName, company.websiteUrl);
  Logger.log('debugAnalyzeCompany: result=' + JSON.stringify(result));
  return result;
}

// DEBUG (Sprint3 Step2動作確認用。確認後に削除する): Apps Scriptエディタの「実行」は引数を
// 渡せないため、企業IDを固定した引数なしのラッパーを用意する。
function debugAnalyzeCompanyC000001() {
  return debugAnalyzeCompany('C000001');
}

// DEBUG (Sprint3 Step3動作確認用。確認後に削除する): 指定した企業IDの営業メール・DM下書きを生成する。
// 事前にdebugAnalyzeCompany等で企業情報解析が完了している必要がある。
function debugGenerateDraft(companyId, tone) {
  var result = generateSalesDraft_(companyId, tone);
  Logger.log('debugGenerateDraft: result=' + JSON.stringify(result));
  return result;
}

// DEBUG (Sprint3 Step3動作確認用。確認後に削除する): Apps Scriptエディタの「実行」は引数を
// 渡せないため、企業IDを固定した引数なしのラッパーを用意する。
function debugGenerateDraftC000001() {
  return debugGenerateDraft('C000001');
}
