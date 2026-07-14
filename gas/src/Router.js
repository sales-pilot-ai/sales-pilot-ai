// 画面(HTML)から google.script.run で呼ばれる公開関数を集約するRouter層。
// 実処理はService層に委譲し、ここでは薄く公開するのみとする（設計書⑤⑫参照）。

// ログイン中のGoogleアカウントを権限シートと照合し、email/name/roleを返す（Sprint8）。
// 他の全Router関数と異なり、未登録ユーザーでもエラーをthrowしない
// （Views/Index.htmlが最初に呼ぶ関数であり、ここでthrowすると画面の骨組みすら表示できない
// ため、registered:falseを返して「権限が設定されていません」専用画面を表示させる）。
function getCurrentUser() {
  const user = getCurrentUserContext_();
  if (!user) {
    return { email: Session.getActiveUser().getEmail() || null, registered: false };
  }
  return { email: user.email, name: user.name, role: user.role, registered: true };
}

// ②企業検索: 業種・エリア・取得件数を指定してMaps検索を実行し、候補一覧を返す（この時点では未保存）
function searchCompanies(params) {
  requireUser_();
  return searchCompaniesViaMaps_(params);
}

// ②企業検索: レビューで「保存」した1件を営業リストに追記・更新する
function saveCompanyCandidate(candidate) {
  requireUser_();
  const validationError = validateCompanyCandidate_(candidate);
  if (validationError) {
    throw new Error(validationError);
  }
  return upsertCompanyCandidate_(candidate);
}

// ②企業検索: 残りの候補を一括保存する
function saveAllCompanyCandidates(candidates) {
  requireUser_();
  return (candidates || []).map(function (candidate) {
    try {
      return saveCompanyCandidate(candidate);
    } catch (err) {
      return { status: 'error', message: err.message, companyId: null };
    }
  });
}

// ②企業検索（タスク2、追加依頼）: 検索結果の一覧表示化に伴い、Webサイト解析は
// 検索実行時ではなく保存直前に候補1件ずつ実行するよう変更した（GASの6分実行制限対策）。
// 解析ロジック自体（analyzeWebsite_）は新規追加せず既存のものをそのまま呼び出す。
function analyzeCandidateWebsite(websiteUrl) {
  requireUser_();
  return analyzeWebsite_(websiteUrl);
}

// ③営業リスト一覧: キーワード・業種・送信状況・送信可否を指定して一覧を取得する
function listCompanies(filter) {
  requireUser_();
  return listCompaniesFromSheet_(filter);
}

// ⑥AI分析: 対象企業のホームページをGeminiで解析し、企業分析シート・AI要約列を更新する
function analyzeCompanyInfo(companyId) {
  requireUser_();
  var company = findCompanyById_(companyId);
  if (!company) {
    throw new Error('企業が見つかりません（企業ID: ' + companyId + '）');
  }
  return analyzeCompanyWebsite_(companyId, company.companyName, company.websiteUrl);
}

// ⑥AI分析: 保存済みの企業分析結果を元に営業メール・DM下書き（件名・本文）を生成する。
// templateIdを省略した場合はデフォルトの営業メールテンプレートを使用する（Sprint7⑤）。
// 署名（{{salesPersonName}}等）は、この操作を実行した本人（ログイン中ユーザー）自身の
// Gmail設定（送信者情報）から解決される（追加依頼: Gmail設定の個人化）。
function generateSalesDraft(companyId, tone, templateId) {
  var user = requireUser_();
  return generateSalesDraft_(companyId, tone, templateId, user.email);
}

// ⑦Gmail下書き作成: Step5で生成済みの営業メール下書き（件名・本文）を使ってGmailの下書きを作成する
// （送信は行わない）
function createGmailDraft(companyId) {
  requireUser_();
  return createGmailDraftForCompany_(companyId);
}

// ⑧営業メール送信: Step5で生成済みの営業メール下書き（件名・本文）を使って実際に送信する
// （Gmail下書き（Step6）は送信対象にしない）
function sendSalesMail(companyId) {
  requireUser_();
  return createSendMailForCompany_(companyId);
}

// ⑨営業メール一括送信: 送信可否=○・送信状況≠送信済の企業へ、Step7のcreateSendMailForCompany_を
// 1件ずつ実行する（Sprint4 Step8）。
function sendSalesMailBatch() {
  requireUser_();
  return sendSalesMailBatch_();
}

// ⑩受信トレイ一覧: 営業リストに登録されたメールアドレスからの返信のみを一覧表示する
// （Gmail受信トレイ全体ではなく営業メールへの返信に絞り込む。Sprint5 Step3）
function listInboxMessages() {
  requireUser_();
  return listSalesInboxMessages_();
}

// ⑪受信メール詳細取得: 受信トレイ一覧の行クリック時に本文を表示する（返信機能はStep11で実装する）
function getInboxMessageDetail(threadId) {
  requireUser_();
  return getInboxMessageDetail_(threadId);
}

// ⑫受信メール返信: 受信トレイの本文表示画面から、thread.reply()で返信を送信する（Sprint4 Step11）
function replyInboxMessage(threadId, body) {
  requireUser_();
  return replyInboxMessage_(threadId, body);
}

// ㉕返信のAI要約（Sprint8④-3、営業管理「返信確認」の新着返信タブ用）。既存の
// getInboxMessageDetail_で本文を取得し、既存のcallGemini_（GeminiService.js）を使う
// summarizeCompanyReply_で要約するだけで、新しいGemini呼び出しの仕組みは作らない。
function summarizeReply(threadId) {
  requireUser_();
  var detail = getInboxMessageDetail_(threadId);
  return summarizeCompanyReply_(detail.plainBody);
}

// ⑬返信有無の自動更新: 営業リストの各企業についてGmail受信を確認し、受信があれば
// 「返信あり」に更新する（Sprint4 Step12）
function syncReplyStatus() {
  requireUser_();
  return syncReplyStatus_();
}

// 返信確認タブの「返信を同期」ボタン付近に最終同期日時を表示するための読み取り専用関数。
function getReplySyncStatus() {
  requireUser_();
  return getReplySyncStatus_();
}

// ⑭AI返信文生成: 受信トレイの本文表示画面から、Geminiで返信文の下書きのみを生成する（Sprint5 Step1）
function generateReplyDraft(threadId) {
  requireUser_();
  return generateReplyDraft_(threadId);
}

// ⑮返信テンプレート: 受信メール詳細画面で、AI返信とは別に定型文をワンクリックで挿入するための
// テンプレート一覧を返す（Sprint5 Step2で新設。Sprint7⑤でSheetsバックエンドへ移行し、
// テンプレート管理画面からも同じ一覧を参照する）
function getReplyTemplates() {
  requireUser_();
  return getReplyTemplates_();
}

// ⑳返信テンプレート管理（Sprint7⑤）: 作成・編集・削除。一覧はgetReplyTemplates()と共用する。
// テンプレート編集はAdminのみ（Sprint8実装ルール⑥）。
function createReplyTemplate(data) {
  requireAdmin_();
  return createReplyTemplate_(data);
}

function updateReplyTemplate(templateId, data) {
  requireAdmin_();
  return updateReplyTemplate_(templateId, data);
}

function deleteReplyTemplate(templateId) {
  requireAdmin_();
  return deleteReplyTemplate_(templateId);
}

// ㉑営業メールテンプレート管理（Sprint7⑤）: Sprint3 Step5の固定1種類テンプレートから、
// テンプレート管理画面での複数管理・デフォルト切り替えに対応する。
// 一覧はUser（営業管理の一括送信タブのテンプレート選択）からも参照するため誰でも可。
// 作成・編集・削除・デフォルト切り替えはAdminのみ。
function listSalesTemplates() {
  requireUser_();
  return listSalesTemplates_();
}

function createSalesTemplate(data) {
  requireAdmin_();
  return createSalesTemplate_(data);
}

function updateSalesTemplate(templateId, data) {
  requireAdmin_();
  return updateSalesTemplate_(templateId, data);
}

function deleteSalesTemplate(templateId) {
  requireAdmin_();
  return deleteSalesTemplate_(templateId);
}

function setDefaultSalesTemplate(templateId) {
  requireAdmin_();
  return setDefaultSalesTemplate_(templateId);
}

// ㉒設定画面（Sprint7⑥）: スクリプトプロパティ（Gemini API・システム設定・デフォルト値）の
// 参照・更新。Adminのみ（Gmail送信者情報は追加依頼によりユーザーごとの個別管理に変更したため
// ここでは扱わない。下記getMySenderInfo/updateMySenderInfoを参照）。
function getSettings() {
  requireAdmin_();
  return getSettingsForAdmin_();
}

function updateSettings(data) {
  requireAdmin_();
  return updateSettings_(data);
}

// Gmail設定（送信者情報、追加依頼）: 営業メール・返信メールの署名に使う名前・電話番号・
// メールアドレスをユーザーごとに管理する。User/Admin問わず全員が利用でき、常に
// ログイン中の本人自身の情報のみを参照・更新する（emailをクライアントから受け取らず、
// requireUser_()が返す本人のメールアドレスを使うため、他人の情報は編集できない）。
function getMySenderInfo() {
  var user = requireUser_();
  return getSenderInfoForUser_(user.email);
}

function updateMySenderInfo(data) {
  var user = requireUser_();
  return updateSenderInfoForUser_(user.email, data);
}

// ㉓営業レポート（Sprint7⑦）: 総企業数・送信率・返信率・商談率・成約率・月別送信件数の推移を返す
// （読み取り専用。レポート閲覧はAdmin/User共通）
function getReportStats() {
  requireUser_();
  return getReportStats_();
}

// ⑯メール履歴: 営業リストの企業とやり取りしたGmailスレッドをスレッド単位で取得し、
// 各スレッドの件名とメッセージ一覧（送受信・日時・本文全文）を返す
// （返信機能は追加しない。Sprint6 Step1で新設、Step2でスレッド単位表示へ変更）
function listCompanyMailHistory(companyId) {
  requireUser_();
  return listCompanyMailHistory_(companyId);
}

// ⑰ダッシュボード集計: 営業リストを集計し、返信あり・送信待ち・商談中・本日のアクション
// （本日商談予定）の件数を返す（読み取り専用。Sprint6 Step3）
function getDashboardStats() {
  requireUser_();
  return getDashboardStats_();
}

// ⑱本日のフォローアップ: 優先順位（本日商談予定→返信あり・未対応→送信待ち）に沿って
// フォロー対象企業を抽出し、会社名・担当者名・ステータス・対象理由を返す
// （読み取り専用。Sprint6 Step4）
function listTodayFollowUps() {
  requireUser_();
  return listTodayFollowUps_();
}

// ⑲ステータス一括変更: 営業リストの「送信状況」列を任意の値に更新する
// （一括操作バーのステータス変更から使用。Sprint6 Step12）
function updateCompanyStatus(companyId, status) {
  requireUser_();
  return updateCompanyStatus_(companyId, status);
}

// ㉔ユーザー管理（Sprint8⑤、設定画面内・Adminのみ）
function listUsers() {
  requireAdmin_();
  return listUsers_();
}

function createUser(data) {
  requireAdmin_();
  return createUser_(data);
}

function updateUserRole(email, role) {
  requireAdmin_();
  return updateUserRole_(email, role);
}

// ユーザー管理: 名前の編集（追加依頼）。bootstrap登録時の初期名（メールアドレスの@より前）が
// 実際の名前と異なる場合に手動で修正できるようにする。
function updateUserName(email, name) {
  requireAdmin_();
  return updateUserName_(email, name);
}

function deleteUser(email) {
  var currentUser = requireAdmin_();
  return deleteUser_(email, currentUser.email);
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
  var result = generateSalesDraft_(companyId, tone, null, Session.getActiveUser().getEmail());
  Logger.log('debugGenerateDraft: result=' + JSON.stringify(result));
  return result;
}

// DEBUG (Sprint3 Step3動作確認用。確認後に削除する): Apps Scriptエディタの「実行」は引数を
// 渡せないため、企業IDを固定した引数なしのラッパーを用意する。
function debugGenerateDraftC000001() {
  return debugGenerateDraft('C000001');
}
