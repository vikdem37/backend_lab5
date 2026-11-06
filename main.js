import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { Command } from 'commander';

const program = new Command();

program
  .name('cat-proxy')
  .description('Кешуючий проксі-сервер для картинок з http.cat')
  .helpOption('--help', 'показати довідку')
  .requiredOption('-h, --host <address>', 'адреса, на якій працює сервер')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'тека, у якій зберігаються кешовані картинки')
  .parse();

const options = program.opts();
const host = options.host;
const cache = options.cache;
const port = Number(options.port);

if (!/^\d+$/.test(options.port) || port < 1 || port > 65535) {
  program.error('error: порт має бути цілим числом від 1 до 65535');
}

function sendText(res, status, message, extraHeaders) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(`${message}\n`);
}
  
function parseCode(url) {
  const pathname = url.split('?')[0];
  const match = /^\/(\d{3})$/.exec(pathname);
    return match ? match[1] : null;
}
  
async function handleGet(res, code) {
  sendText(res, 501, `GET /${code} Not Implemented`);
}
  
async function handlePut(req, res, code) {
  sendText(res, 501, `PUT /${code} Not Implemented`);
}
  
async function handleDelete(res, code) {
  sendText(res, 501, `DELETE /${code} Not Implemented`);
}
  
async function handleRequest(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
      sendText(res, 405, `Метод ${req.method} не підтримується`, { Allow: 'GET, PUT, DELETE' });
      return;
    }

    const code = parseCode(req.url);
    if (code === null) {
      sendText(res, 400, 'Шлях має бути тризначним кодом стану HTTP, наприклад /200');
      return;
    }

    if (req.method === 'GET') {
      await handleGet(res, code);
    } else if (req.method === 'PUT') {
      await handlePut(req, res, code);
    } else {
      await handleDelete(res, code);
    }
  } catch (err) {
    console.error(`Помилка: ${err.message}`, err.cause?.message ?? '');
    if (!res.headersSent) {
      sendText(res, 500, `Внутрішня помилка сервера: ${err.message}`);
    } else {
      res.end();
    }
  } finally {
    console.log(`${req.method} ${req.url} → ${res.statusCode}`);
  }
}

try {
  await mkdir(cache, { recursive: true });
} catch (err) {
  console.error(`Не вдалося створити теку кешу ${cache}: ${err.message}`);
  process.exit(1);
}

const server = http.createServer(handleRequest);
server.listen(port, host);

try {
  await once(server, 'listening');
} catch (err) {
  console.error(`Не вдалося запустити сервер на ${host}:${port}: ${err.message}`);
  process.exit(1);
}

console.log(`Проксі-сервер працює: http://${host}:${port}/ (кеш: ${path.resolve(cache)})`);