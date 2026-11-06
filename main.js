import path from 'node:path';
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

try {
  await mkdir(cache, { recursive: true });
} catch (err) {
  console.error(`Не вдалося створити теку кешу ${cache}: ${err.message}`);
  process.exit(1);
}

console.log(`Тека кешу готова: ${path.resolve(cache)}; сервер буде на ${host}:${port}`);