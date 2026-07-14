import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

// Apps Script runtime globals (not published by the `globals` package).
const gasGlobals = {
  HtmlService: 'readonly',
  SpreadsheetApp: 'readonly',
  GmailApp: 'readonly',
  MailApp: 'readonly',
  UrlFetchApp: 'readonly',
  PropertiesService: 'readonly',
  LockService: 'readonly',
  CacheService: 'readonly',
  ScriptApp: 'readonly',
  DriveApp: 'readonly',
  Session: 'readonly',
  Utilities: 'readonly',
  ContentService: 'readonly',
  Logger: 'readonly',
};

// Top-level declarations in gas/src/**/*.js are shared globals at runtime (GAS
// concatenates all files into one execution scope), but ESLint lints each file
// in isolation, so cross-file references need to be declared here too.
const gasProjectGlobals = {
  analyzeCompanyWebsite_: 'readonly',
  analyzeWebsite_: 'readonly',
  backfillMissingHasReply_: 'readonly',
  backfillMissingSendStatus_: 'readonly',
  buildHeaderIndex_: 'readonly',
  buildSalesEmailBody_: 'readonly',
  buildSalesEmailSubject_: 'readonly',
  calculateRate_: 'readonly',
  callGemini_: 'readonly',
  COMPANY_FIELD_TO_HEADER: 'readonly',
  COMPANY_HEADERS: 'readonly',
  COMPANY_PROTECTED_HEADERS: 'readonly',
  COMPANY_SHEET_NAME: 'readonly',
  companyToRow_: 'readonly',
  createGmailDraftForCompany_: 'readonly',
  createReplyTemplate_: 'readonly',
  createSalesTemplate_: 'readonly',
  createSendMailForCompany_: 'readonly',
  createUser_: 'readonly',
  DEAL_RESULT: 'readonly',
  DEFAULT_GEMINI_MODEL: 'readonly',
  deleteReplyTemplate_: 'readonly',
  deleteSalesTemplate_: 'readonly',
  deleteUser_: 'readonly',
  EMAIL_PATTERN: 'readonly',
  ensureHeaders_: 'readonly',
  findCompanyById_: 'readonly',
  findCompanyByPlaceId_: 'readonly',
  generateReplyDraft_: 'readonly',
  generateSalesDraft_: 'readonly',
  getCompanyAnalysisRow_: 'readonly',
  getCurrentUserContext_: 'readonly',
  getDashboardStats_: 'readonly',
  getDefaultSalesTemplate_: 'readonly',
  getInboxMessageDetail_: 'readonly',
  getCompanySheet_: 'readonly',
  getGeminiApiKey_: 'readonly',
  getGeminiModel_: 'readonly',
  getMapsApiKey_: 'readonly',
  getReplySyncStatus_: 'readonly',
  getReplyTemplates_: 'readonly',
  getReportStats_: 'readonly',
  getSalesPerson_: 'readonly',
  getSalesTemplateById_: 'readonly',
  getSettingsForAdmin_: 'readonly',
  getSpreadsheetId_: 'readonly',
  getTimeRexUrl_: 'readonly',
  HAS_REPLY: 'readonly',
  listAvailableGeminiModels_: 'readonly',
  listCompaniesFromSheet_: 'readonly',
  listCompanyMailHistory_: 'readonly',
  listInboxMessages_: 'readonly',
  listSalesInboxMessages_: 'readonly',
  listSalesTemplates_: 'readonly',
  listTodayFollowUps_: 'readonly',
  listUsers_: 'readonly',
  markCompanyReplied_: 'readonly',
  markCompanySent_: 'readonly',
  nextCompanyId_: 'readonly',
  PERMISSION_SHEET_NAME: 'readonly',
  readAllCompanies_: 'readonly',
  replyInboxMessage_: 'readonly',
  requireAdmin_: 'readonly',
  requireUser_: 'readonly',
  rowToCompany_: 'readonly',
  SEND_APPROVAL: 'readonly',
  SEND_STATUS: 'readonly',
  SETTINGS_KEYS: 'readonly',
  searchCompaniesViaMaps_: 'readonly',
  sendSalesMailBatch_: 'readonly',
  setDefaultSalesTemplate_: 'readonly',
  summarizeCompanyReply_: 'readonly',
  syncReplyStatus_: 'readonly',
  updateCompanyStatus_: 'readonly',
  updateCompanySummary_: 'readonly',
  updateReplyTemplate_: 'readonly',
  updateSalesTemplate_: 'readonly',
  updateSettings_: 'readonly',
  updateUserRole_: 'readonly',
  upsertCompanyAnalysisFields_: 'readonly',
  upsertCompanyCandidate_: 'readonly',
  USER_ROLE: 'readonly',
  validateCompanyCandidate_: 'readonly',
};

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'playwright-report/', 'test-results/'],
  },
  js.configs.recommended,
  {
    ignores: ['gas/'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['gas/src/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...gasGlobals, ...gasProjectGlobals },
      ecmaVersion: 2019,
      sourceType: 'script',
    },
    rules: {
      // GAS entry points (doGet, include, getCurrentUser, ...) are called by the
      // Apps Script runtime or from HTML via google.script.run, never from within
      // this file, so ESLint can't see the usage.
      'no-unused-vars': 'off',
      // Each cross-file symbol is declared once in its home file and listed in
      // gasProjectGlobals so other files can reference it; that registration
      // looks like a redeclaration to ESLint but isn't one at runtime.
      'no-redeclare': 'off',
    },
  },
  prettierConfig,
];
