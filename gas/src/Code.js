var PAGE_TEMPLATES = {
  dashboard: 'Views/Dashboard',
  search: 'Views/Search',
  companyList: 'Views/CompanyList',
  inbox: 'Views/Inbox',
  templates: 'Views/Templates',
  settings: 'Views/Settings',
  report: 'Views/Report',
};

// Admin専用ページ（Sprint8⑥）。URL直打ちでもサーバー側（doGet時点）でアクセスを拒否する
// （クライアント側のサイドバー非表示だけに依存しない）。
// settingsは追加依頼によりUser/Admin共通でアクセス可能な画面に変更した（画面内の
// Gemini API設定・システム設定・デフォルト値設定・ユーザー管理の4セクションはRouter層の
// requireAdmin_()で個別に保護されており、画面自体のアクセス制限とは独立して維持される）。
var ADMIN_ONLY_PAGES = ['templates'];

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'dashboard';
  if (!PAGE_TEMPLATES[page]) {
    page = 'dashboard';
  }

  // ログイン中のGoogleアカウントを権限シートと照合する（Sprint8②）。権限シートが空の場合は
  // 最初のアクセス者を自動でAdmin登録する（PermissionService.js参照）。
  var user = getCurrentUserContext_();

  var template = HtmlService.createTemplateFromFile('Views/Index');
  template.page = page;
  template.user = user;
  template.accessDenied = !!user && ADMIN_ONLY_PAGES.indexOf(page) !== -1 && user.role !== USER_ROLE.ADMIN;
  template.pageTemplate = user && !template.accessDenied ? PAGE_TEMPLATES[page] : null;
  // IFRAMEサンドボックスでは初回表示後にトップレベルURLがgoogleusercontent.comの
  // サンドボックスURLに変わるため、画面遷移は常にこのexec URLを絶対URLとして使う
  // （Views/Index.html の navigateToPage() 参照）。
  template.baseUrl = ScriptApp.getService().getUrl();

  return template
    .evaluate()
    .setTitle('Sales Pilot AI')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
