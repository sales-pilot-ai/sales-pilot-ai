import { existsSync, readFileSync, writeFileSync } from 'fs';
import { google } from 'googleapis';

// OAuth トークンは Sheets と Gmail の両方をカバーする（sales-pilot auth で一括取得）
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
];

// サービスアカウントは Sheets のみ（Gmail は domain-wide delegation が必要なため）
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * サービスアカウント認証クライアントを作成する。
 * GOOGLE_SERVICE_ACCOUNT_KEY（デフォルト: credentials/service-account.json）を使用。
 * @returns {Promise<any>}
 */
async function createServiceAccountAuth() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? 'credentials/service-account.json';
  const auth = new google.auth.GoogleAuth({ keyFile, scopes: SHEETS_SCOPES });
  return auth.getClient();
}

/**
 * OAuth2 認証クライアントを作成する。
 * GOOGLE_TOKEN_PATH（デフォルト: credentials/oauth-token.json）に保存済みトークンが必要。
 * トークン更新時は同ファイルへ自動保存する。
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
async function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tokenPath = process.env.GOOGLE_TOKEN_PATH ?? 'credentials/oauth-token.json';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/oauth2callback';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が .env に設定されていません');
  }

  if (!existsSync(tokenPath)) {
    throw new Error(
      `OAuth トークンが見つかりません (${tokenPath})\n` +
        '"sales-pilot auth" を実行して認証してください'
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
  client.setCredentials(token);

  // refresh_token を受け取ったときトークンファイルを更新する
  client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      const current = JSON.parse(readFileSync(tokenPath, 'utf-8'));
      writeFileSync(tokenPath, JSON.stringify({ ...current, ...tokens }, null, 2));
    }
  });

  return client;
}

/**
 * 認証クライアントを作成する。
 *
 * GOOGLE_AUTH_TYPE で認証方式を切り替える:
 *   - 'oauth'            : OAuth2 認証（ユーザーアカウント）
 *   - 'service_account'  : サービスアカウント認証（デフォルト）
 *
 * @returns {Promise<any>}
 */
export async function createAuth() {
  const authType = process.env.GOOGLE_AUTH_TYPE ?? 'service_account';
  if (authType === 'oauth') {
    return createOAuthClient();
  }
  return createServiceAccountAuth();
}

/**
 * OAuth2 認証 URL を生成する。
 * "sales-pilot auth" コマンドで使用する。
 * OAUTH_SCOPES（Sheets + Gmail）を一括でリクエストする。
 * @returns {string}
 */
export function getOAuthAuthUrl() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/oauth2callback';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が .env に設定されていません');
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return client.generateAuthUrl({ access_type: 'offline', scope: OAUTH_SCOPES });
}

/**
 * 認証コードを使ってトークンを取得し、tokenPath に保存する。
 * "sales-pilot auth" コマンドで使用する。
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function saveOAuthToken(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/oauth2callback';
  const tokenPath = process.env.GOOGLE_TOKEN_PATH ?? 'credentials/oauth-token.json';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が .env に設定されていません');
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken(code);
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
}
