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
