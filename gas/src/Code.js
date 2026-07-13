var PAGE_TEMPLATES = {
  dashboard: 'Views/Dashboard',
  search: 'Views/Search',
  companyList: 'Views/CompanyList',
  inbox: 'Views/Inbox',
  templates: 'Views/Templates',
  settings: 'Views/Settings',
  report: 'Views/Report',
};

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'dashboard';
  if (!PAGE_TEMPLATES[page]) {
    page = 'dashboard';
  }

  var template = HtmlService.createTemplateFromFile('Views/Index');
  template.page = page;
  template.pageTemplate = PAGE_TEMPLATES[page];
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
