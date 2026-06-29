import { randomUUID } from 'crypto';

/**
 * 非 ASCII 文字を含む場合に RFC 2047 encoded word に変換する。
 * 日本語件名が文字化けしないよう Subject ヘッダーに適用する。
 * @param {string} str
 * @returns {string}
 */
function encodeHeaderValue(str) {
  // Unicode プロパティエスケープで非 ASCII 文字を検出（ES2018+ / Node.js 10+）
  if (/\P{ASCII}/u.test(str)) {
    return `=?utf-8?B?${Buffer.from(str, 'utf-8').toString('base64')}?=`;
  }
  return str;
}

/**
 * 文字列を MIME base64 エンコードし 76 文字で折り返す。
 * @param {string} str
 * @returns {string}
 */
function encodeBody(str) {
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return b64.replace(/(.{76})/g, '$1\r\n').trimEnd();
}

/**
 * 添付ファイル 1 件分の MIME パートを生成する。
 * @param {{ filename: string, mimeType: string, data: Buffer | string }} attachment
 * @param {string} boundary
 * @returns {string}
 */
function buildAttachmentPart(attachment, boundary) {
  const { filename, mimeType, data } = attachment;
  const encodedFilename = encodeHeaderValue(filename);
  const b64data =
    typeof data === 'string'
      ? data
      : data
          .toString('base64')
          .replace(/(.{76})/g, '$1\r\n')
          .trimEnd();

  return [
    `--${boundary}`,
    `Content-Type: ${mimeType}; name="${encodedFilename}"`,
    `Content-Disposition: attachment; filename="${encodedFilename}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    b64data,
    '',
  ].join('\r\n');
}

/**
 * text/plain + text/html の multipart/alternative パートを生成する。
 * @param {string} textBody
 * @param {string} htmlBody
 * @param {string} boundary
 * @returns {string}
 */
function buildAlternativePart(textBody, htmlBody, boundary) {
  const parts = [];

  if (textBody) {
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: base64`,
        '',
        encodeBody(textBody),
        '',
      ].join('\r\n')
    );
  }

  if (htmlBody) {
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: base64`,
        '',
        encodeBody(htmlBody),
        '',
      ].join('\r\n')
    );
  }

  parts.push(`--${boundary}--`);
  return parts.join('\r\n');
}

/**
 * @typedef {{
 *   filename: string,
 *   mimeType: string,
 *   data: Buffer | string,
 * }} Attachment
 */

/**
 * MIME メッセージ文字列を生成する。
 *
 * 添付ファイルなし: multipart/alternative（text + html）
 * 添付ファイルあり: multipart/mixed（outer）+ multipart/alternative（inner）+ 各添付
 *
 * @param {{
 *   from: string,
 *   to: string,
 *   subject: string,
 *   textBody?: string,
 *   htmlBody?: string,
 *   attachments?: Attachment[],
 *   _boundary?: string,
 * }} options
 * @returns {string} 生の MIME 文字列（base64url エンコード前）
 */
export function buildMimeMessage({
  from,
  to,
  subject,
  textBody = '',
  htmlBody = '',
  attachments = [],
  _boundary,
}) {
  const hasAttachments = attachments.length > 0;
  const outerBoundary = _boundary ?? randomUUID().replace(/-/g, '');
  const innerBoundary = _boundary ? `${_boundary}_inner` : randomUUID().replace(/-/g, '');

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    `MIME-Version: 1.0`,
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${outerBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${outerBoundary}"`,
  ].join('\r\n');

  let body;

  if (hasAttachments) {
    const altPart = [
      `--${outerBoundary}`,
      `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
      '',
      buildAlternativePart(textBody, htmlBody, innerBoundary),
      '',
    ].join('\r\n');

    const attParts = attachments.map((att) => buildAttachmentPart(att, outerBoundary)).join('\r\n');

    body = `${altPart}\r\n${attParts}\r\n--${outerBoundary}--`;
  } else {
    body = buildAlternativePart(textBody, htmlBody, outerBoundary);
  }

  return `${headers}\r\n\r\n${body}`;
}

/**
 * MIME 文字列を Gmail API が要求する base64url 形式にエンコードする。
 * @param {string} mimeMessage
 * @returns {string}
 */
export function encodeMimeMessage(mimeMessage) {
  return Buffer.from(mimeMessage).toString('base64url');
}
