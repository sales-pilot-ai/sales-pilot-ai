import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, renderTemplate } from '../../gmail/index.js';
import { createPersonalizedContent } from '../../personalizer/index.js';
import { env } from '../../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../../../templates/emails');

/**
 * @param {string} name テンプレート名（拡張子なし）
 * @returns {{ textTemplate: string, htmlTemplate: string|null, subjectTemplate: string|null }}
 */
export function loadEmailTemplates(name) {
  const txtPath = resolve(TEMPLATES_DIR, `${name}.txt`);
  const htmlPath = resolve(TEMPLATES_DIR, `${name}.html`);
  const subjectPath = resolve(TEMPLATES_DIR, `${name}.subject.txt`);
  return {
    textTemplate: loadTemplate(txtPath),
    htmlTemplate: existsSync(htmlPath) ? loadTemplate(htmlPath) : null,
    subjectTemplate: existsSync(subjectPath) ? loadTemplate(subjectPath).trim() : null,
  };
}

export function buildTextSignature() {
  const parts = ['--'];
  if (env.gmailName) parts.push(env.gmailName);
  if (env.gmailFrom) parts.push(env.gmailFrom);
  return parts.join('\n');
}

export function buildHtmlSignature() {
  const lines = [];
  if (env.gmailName) lines.push(`<strong>${env.gmailName}</strong>`);
  if (env.gmailFrom) lines.push(`<a href="mailto:${env.gmailFrom}">${env.gmailFrom}</a>`);
  if (!lines.length) return '';
  return `<div style="border-top:1px solid #e0e0e0;margin-top:24px;padding-top:16px;font-size:12px;color:#666;">${lines.join('<br />')}</div>`;
}

/**
 * 企業情報とテンプレートからメール内容を構築する。
 *
 * @param {import('../../models/company.js').Company} company
 * @param {{ textTemplate: string, htmlTemplate: string|null, subjectTemplate: string|null }} templates
 * @returns {Promise<{ subject: string, textBody: string, htmlBody: string|undefined }>}
 */
export async function buildEmailContent(company, { textTemplate, htmlTemplate, subjectTemplate }) {
  const { introText } = await createPersonalizedContent(company);
  const vars = {
    companyName: company.companyName,
    contactName: company.contactName || 'ご担当者',
    meetingUrl: env.meetingUrl,
    introText,
  };

  const subject = subjectTemplate
    ? renderTemplate(subjectTemplate, vars)
    : `【ご提案】${company.companyName} 様の営業効率化についてのご相談`;

  const textBody = renderTemplate(textTemplate, vars) + '\n' + buildTextSignature();
  const htmlBody = htmlTemplate
    ? renderTemplate(htmlTemplate, vars).replace('</body>', `${buildHtmlSignature()}</body>`)
    : undefined;

  return { subject, textBody, htmlBody };
}
