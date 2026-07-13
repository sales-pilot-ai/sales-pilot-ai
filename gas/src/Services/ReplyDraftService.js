// 受信メールへのAI返信文生成（Sprint5 Step1）。受信トレイの本文表示画面から、
// 「AI返信を作成」ボタン押下時に返信文の下書きのみを生成する。
// 営業メール生成（AiAnalysisService.js / Config/SalesEmailTemplate.js）とは別実装であり、
// 双方は互いに影響しない。

function buildReplyDraftPrompt_(subject, plainBody) {
  return [
    'あなたは法人営業担当です。',
    '',
    '以下の受信メールに対して、丁寧で自然な日本語の返信文のみを作成してください。',
    '署名は不要です。',
    '',
    '件名:',
    subject || '(件名なし)',
    '',
    '本文:',
    plainBody || '(本文なし)',
    '',
    '返信文のみ返してください。',
  ].join('\n');
}

// 受信メール（threadId）の件名・本文を取得し、Geminiで返信文の下書き（文字列）のみを生成する。
function generateReplyDraft_(threadId) {
  var detail = getInboxMessageDetail_(threadId);
  var prompt = buildReplyDraftPrompt_(detail.subject, detail.plainBody);
  return callGemini_(prompt);
}

// 返信確認「新着返信（初回）」一覧のAI要約（Sprint8④-3）。受信メール本文を1文程度に
// 要約するだけの単純なプロンプトで、新しいGemini呼び出しの仕組みは作らずcallGemini_を
// そのまま再利用する（generateReplyDraft_と同じ構成）。
function buildReplySummaryPrompt_(plainBody) {
  return [
    '以下はある企業からの返信メールの本文です。営業担当が一覧画面で内容を素早く把握できるよう、',
    '1文（40文字程度）で日本語要約してください。要約文のみを返してください。',
    '',
    '本文:',
    plainBody || '(本文なし)',
  ].join('\n');
}

function summarizeCompanyReply_(plainBody) {
  return callGemini_(buildReplySummaryPrompt_(plainBody));
}
