# backend_lab5

Кешуючий проксі-сервер для картинок з https://http.cat.

Встановлення: `npm install` (Node.js 22.12+).

Запуск: `npm start` або `node main.js -h 127.0.0.1 -p 3000 -c cache`; `npm run dev` для автоматичного перезапуску.

| Запит | Відповідь |
| --- | --- |
| `GET /<код>` | 200, image/jpeg, заголовок `X-Image-Source`: `cache` або `http.cat`; 404, якщо картинки немає |
| `PUT /<код>` з картинкою в тілі | 201, картинку збережено або замінено |
| `DELETE /<код>` | 200; 404, якщо в кеші немає |
| інший метод | 405, заголовок `Allow: GET, PUT, DELETE` |
| шлях не є тризначним кодом | 400 |

`test.txt` - тестові запити
`cat proxy.postman_collection.json` та `insomnia_cat-proxy.json` - колекції Postman та Insomnia.