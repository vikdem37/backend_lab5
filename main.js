import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import superagent from 'superagent';

const UPSTREAM = 'https://http.cat';
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

function cacheFile(code) {
  return path.join(cache, `${code}.jpg`);
}

async function readFromCache(code) {
  try {
    return await readFile(cacheFile(code));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error('не вдалося прочитати картинку з кешу', { cause: err });
  }
}

async function saveToCache(code, data) {
  const target = cacheFile(code);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, data);
    await rename(temp, target);
  } catch (err) {
    await rm(temp, { force: true });
    throw new Error('не вдалося зберегти картинку в кеш', { cause: err });
  }
}

function sendText(res, status, message, extraHeaders) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(`${message}\n`);
}

function sendImage(res, data, source) {
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': data.length,
    'X-Image-Source': source,
  });
  res.end(data);
}
  
function parseCode(url) {
  const pathname = url.split('?')[0];
  const match = /^\/(\d{3})$/.exec(pathname);
    return match ? match[1] : null;
}
  
async function handleGet(res, code) {
  const cached = await readFromCache(code);
  if (cached) {
    sendImage(res, cached, 'cache');
    return;
  }

  let response;
  try {
    response = await superagent.get(`${UPSTREAM}/${code}`).timeout({ response: 5000, deadline: 15000 });
  } catch (err) {
    const reason = err.status ? `http.cat відповів ${err.status}` : `http.cat недоступний (${err.code ?? err.message})`;
    sendText(res, 404, `Картинку для коду ${code} не знайдено: ${reason}`);
    return;
  }

  const data = response.body;
  if (!Buffer.isBuffer(data) || data.length === 0) {
    sendText(res, 404, `http.cat не повернув картинку для коду ${code}`);
    return;
  }

  await saveToCache(code, data);
  sendImage(res, data, 'http.cat');
}
  
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handlePut(req, res, code) {
  const data = await readBody(req);
  if (data.length === 0) {
    sendText(res, 400, 'Тіло запиту порожнє: надішліть картинку');
    return;
  }
  await saveToCache(code, data);
  sendText(res, 201, `Картинку для коду ${code} збережено в кеш`);
}
  
async function handleDelete(res, code) {
  try {
    await unlink(cacheFile(code));
  } catch (err) {
    if (err.code === 'ENOENT') {
      sendText(res, 404, `Картинки для коду ${code} немає в кеші`);
      return;
    }
    throw new Error('не вдалося видалити картинку з кешу', { cause: err });
  }
  sendText(res, 200, `Картинку для коду ${code} видалено з кешу`);
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