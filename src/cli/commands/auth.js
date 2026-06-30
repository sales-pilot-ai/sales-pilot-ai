import { createServer } from 'http';
import { exec } from 'child_process';
import chalk from 'chalk';
import { getOAuthAuthUrl, saveOAuthToken } from '../../sheets/auth.js';
import { logger } from '../../utils/logger.js';

const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * port: 0 でサーバーを起動して OS に空きポートを割り当ててもらい、
 * ポート番号とコードを受け取る Promise を返す。
 * @returns {Promise<{ port: number, codePromise: Promise<string> }>}
 */
function listenForCode() {
  return new Promise((resolve, reject) => {
    let codeResolve, codeReject;

    const codePromise = new Promise((res, rej) => {
      codeResolve = res;
      codeReject = rej;
    });

    const server = createServer((req, res) => {
      const { searchParams: query } = new URL(req.url ?? '/', 'http://localhost');

      if (query.get('code')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<html><body style="font-family:sans-serif;padding:40px;">' +
            '<h2>✅ 認証完了</h2><p>このタブを閉じて、ターミナルに戻ってください。</p>' +
            '</body></html>'
        );
        server.close();
        codeResolve(String(query.get('code')));
        return;
      }

      if (query.get('error')) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<html><body style="font-family:sans-serif;padding:40px;">' +
            `<h2>❌ 認証エラー</h2><p>${query.get('error_description') ?? query.get('error')}</p>` +
            '</body></html>'
        );
        server.close();
        codeReject(
          new Error(`OAuth エラー: ${query.get('error_description') ?? query.get('error')}`)
        );
      }
    });

    const timeout = setTimeout(() => {
      server.close();
      codeReject(new Error('認証がタイムアウトしました（5 分）'));
    }, TIMEOUT_MS);

    server.on('close', () => clearTimeout(timeout));
    server.on('error', (err) => {
      codeReject(err);
      reject(err);
    });

    // port: 0 で OS に空きポートを割り当ててもらい、決定後に呼び出し元へ通知
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ port, codePromise });
    });
  });
}

export async function authCommand() {
  console.log('');
  console.log(chalk.bold.cyan('╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║    Sales Pilot AI — OAuth2 認証           ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝'));
  console.log('');

  // サーバーを起動してポートを確定させてから認証 URL を生成する
  let port, codePromise;
  try {
    ({ port, codePromise } = await listenForCode());
  } catch (err) {
    logger.error(`ローカルサーバーの起動に失敗しました: ${err.message}`);
    process.exit(1);
  }

  // 確定したポートで redirect URI を上書き（getOAuthAuthUrl / saveOAuthToken が参照）
  process.env.GOOGLE_REDIRECT_URI = `http://localhost:${port}/oauth2callback`;

  let authUrl;
  try {
    authUrl = getOAuthAuthUrl();
  } catch (err) {
    logger.error(err.message);
    logger.error('→ .env に GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を設定してください');
    process.exit(1);
  }

  console.log(chalk.bold('以下の URL をブラウザで開いて、Google アカウントで認証してください。'));
  console.log('');
  console.log(chalk.cyan(authUrl));
  console.log('');

  exec(`open "${authUrl}"`, () => {});

  console.log(
    chalk.gray(`認証後に http://localhost:${port}/oauth2callback へリダイレクトされます。`)
  );
  console.log(chalk.gray('5 分以内に認証を完了してください...'));
  console.log('');

  try {
    const code = await codePromise;
    await saveOAuthToken(code);

    console.log('');
    console.log(chalk.green(chalk.bold('✅ 認証が完了しました！')));
    console.log(chalk.gray('トークンを credentials/oauth-token.json に保存しました。'));
    console.log('');
    console.log(chalk.bold('次のステップ:'));
    console.log(chalk.cyan('  sales-pilot doctor') + chalk.gray(' — 接続状態を確認'));
    console.log(chalk.cyan('  sales-pilot find') + chalk.gray(' — 企業を検索'));
    console.log('');
  } catch (err) {
    console.log('');
    logger.error(err.message);
    process.exit(1);
  }
}
