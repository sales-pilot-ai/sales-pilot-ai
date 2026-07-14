// 営業メール・DM下書きの件名・本文組み立て（Sprint3 Step5で固定テンプレート化、
// Sprint7⑤でテンプレート管理画面に対応するため、コード直書きの固定文言から
// Sheets（Services/SalesTemplateService.js）バックエンドのテンプレートデータへ移行）。
//
// 本文テンプレートは{{personalizedNote}}（Gemini生成の感想・共感ポイント・提案理由）・
// {{salesPersonName}}・{{salesPersonTel}}・{{salesPersonMail}}・{{timeRexUrl}}の
// プレースホルダーを持ち、送信時に実際の値へ単純な文字列置換で埋め込む。
//
// 営業担当者情報（氏名・電話番号・メールアドレス）は、共通設定ではなく「実際にこのメールを
// 生成した（＝ログイン中の）ユーザー本人」の情報を使う（追加依頼: Gmail設定の個人化）。
// 本文組み立て時（buildSalesEmailBody_実行時）にemail引数からPermissionService.jsの
// getSenderInfoForUser_()で都度取得する。

function applySalesEmailPlaceholders_(text, values) {
  return Object.keys(values).reduce(function (acc, key) {
    return acc.split('{{' + key + '}}').join(values[key] == null ? '' : values[key]);
  }, text);
}

// templateIdを省略した場合はデフォルトテンプレート（Services/SalesTemplateService.js）を使用する。
// companyNameは将来の件名パーソナライズに備えて引数として残しているが、現時点では未使用。
function buildSalesEmailSubject_(companyName, templateId) {
  var template = templateId ? getSalesTemplateById_(templateId) : getDefaultSalesTemplate_();
  if (!template) {
    throw new Error('営業メールテンプレートが見つかりません。テンプレート管理画面でテンプレートを作成してください。');
  }
  return template.subject;
}

// 本文を組み立てる。personalizedNoteはGemini生成の「感想・共感ポイント・提案理由」(200〜400文字程度)。
// personalizedNoteが空文字・未定義の場合（Gemini生成失敗時のフォールバック含む）は、
// プレースホルダーを空文字に置換した上で、生じた余分な空行（3行以上の連続改行）を2行にまとめる。
// emailは営業メール生成を実行した本人（ログイン中ユーザー）のメールアドレス。
function buildSalesEmailBody_(companyName, personalizedNote, templateId, email) {
  var template = templateId ? getSalesTemplateById_(templateId) : getDefaultSalesTemplate_();
  if (!template) {
    throw new Error('営業メールテンプレートが見つかりません。テンプレート管理画面でテンプレートを作成してください。');
  }
  var salesPerson = getSenderInfoForUser_(email);
  var body = applySalesEmailPlaceholders_(template.bodyTemplate, {
    personalizedNote: String(personalizedNote || '').trim(),
    salesPersonName: salesPerson.name,
    salesPersonTel: salesPerson.tel,
    salesPersonMail: salesPerson.mail,
    timeRexUrl: getTimeRexUrl_(),
  });
  return body.replace(/\n{3,}/g, '\n\n').trim();
}
