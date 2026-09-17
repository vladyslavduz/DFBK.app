# DFBK.app — Project History: Idea → Frontend

**Зафиксировано:** 17.09.2026  
**Назначение:** единый исторический журнал проекта от генерации идеи до текущего состояния Frontend/Backend. Этот файл нужен как долговременная контрольная точка для всех веток проекта.

---

# 1. Исходная идея

Проект начался как идея недорогого максимально автоматизированного AI-сервиса для малого бизнеса в Германии, в первую очередь для Handwerk.

Базовая пользовательская цепочка:

`Фото выполненной работы → AI обработка → готовый маркетинговый контент`

Планируемый результат:
- обработанные изображения;
- описание выполненной работы;
- материалы для сайта;
- Google Business;
- Social Media;
- позже автоматическая публикация.

Главный принцип проекта:

**Рабочий MVP → первый пользователь → первый платящий клиент → только потом масштабирование.**

Архитектурные принципы:
- максимум автоматизации;
- минимум действий пользователя;
- простота важнее количества функций;
- дешёвые serverless/cloud/API решения;
- pay-as-you-go;
- GDPR / Datenschutz для Германии и ЕС;
- secrets никогда не хранить в публичном коде;
- не строить сложную инфраструктуру заранее.

---

# 2. Название и бренд

Закреплено название:

**DFBK.app**

Расшифровка:

**Dein Foto bringt Kunden**

Домен:

`dfbk.app`

Домен зарегистрирован и подключён к Cloudflare.

---

# 3. Организация проекта по рабочим веткам

В процессе проект был разделён на отдельные рабочие направления.

## Generator Ideen / Генератор идей
Использовался для:
- бизнес-модели;
- позиционирования;
- маркетинговой логики;
- отраслевых сценариев;
- монетизации;
- идей без технической детализации.

## Backend DFBK.app
Ранее назывался `Каркас DFBK.app`.

Используется для:
- Cloudflare Worker;
- API;
- Auth;
- маршрутизации;
- backend-кода;
- server-side интеграций.

## Frontend DFBK.app
Используется для:
- визуала;
- homepage;
- Hero;
- адаптивности;
- отраслевых карточек;
- UI/UX.

## SQL DB DFBK.app
Для:
- Cloudflare D1;
- Auth DB;
- SQL schema;
- индексов;
- каскадных связей.

## ERROR_!!!
Для изолированной диагностики:

`ошибка → симптом → logs → причина → исправление → повторный тест → FIXED`

## Registrieren API
Для внешних сервисов и API.

## Plan & Gemacht
Центральная ветка контроля проекта.

Перед началом новой задачи требуется сверяться с актуальным статусом проекта и продолжать незавершённую цепочку, если нет веской причины изменить приоритет.

---

# 4. Брендинг и визуальная база

Для DFBK.app была выбрана и принята базовая цветовая схема в clean SaaS стиле:
- navy / blue;
- mint;
- белый фон;
- мягкие тени;
- rounded containers.

Логотип:
- D F B K + точка + `app`;
- прямоугольная композиция;
- чёрная рамка;
- белый контур для читаемости;
- уменьшенная точка;
- итоговый вариант принят как основной.

В дальнейших визуалах снизили акцент на слове AI и усилили узнаваемость DFBK.app как самостоятельного бренда.

---

# 5. Инфраструктура

GitHub repository:

`vladyslavduz/DFBK.app`

Default branch:

`main`

Cloudflare Worker:

`dfbk-app`

Service URL:

`dfbk-app.vladyslavduz.workers.dev`

Zone:

`dfbk.app`

Основной стек постепенно сформировался вокруг:
- GitHub;
- Cloudflare Worker;
- Cloudflare D1;
- Cloudflare R2 планируется для файлов;
- Turnstile планируется;
- Workers Secrets для ключей;
- React/Vite frontend.

HTTPS работал. HTTP/www redirect ранее был выделен как отдельная задача для окончательной проверки.

---

# 6. OpenAI / внешние API

Для проекта OpenAI была зафиксирована ограниченная конфигурация моделей:
- `gpt-5.6-luna`
- `gpt-image-2`
- `omni-moderation-latest`

Остальные модели были заблокированы для контроля расходов и архитектуры.

Worker secret:

`OPENAI_API_KEY`

Для email-потока настроен Resend secret:

`RESEND_API_KEY`

Домен отправки:

`auth.dfbk.app`

Важно:
- сами значения secrets не фиксируются в документации;
- email verification logic ещё должна быть завершена и протестирована.

---

# 7. SQL / D1 — Auth DB v1

Cloudflare D1 database:

`dfbk-db`

Binding:

`DB`

Использование в Worker:

`env.DB`

Созданы таблицы:
- `users`
- `auth_tokens`
- `sessions`

Проведены проверки:
- таблицы существуют;
- индексы очищены от дублей;
- UNIQUE constraints работают;
- test user создавался;
- verify token создавался;
- session создавалась;
- `ON DELETE CASCADE` полностью протестирован;
- удаление user корректно удаляло связанные `auth_tokens` и `sessions`.

**Auth DB v1 считается готовой.**

---

# 8. Backend Auth — Register

Endpoint:

`POST /api/auth/register`

Реализовано:
- JSON parsing;
- email normalization;
- email validation;
- required email/password;
- password minimum = 8;
- duplicate email check;
- UUID user ID;
- password hashing;
- INSERT в D1;
- UNIQUE/race protection;
- JSON responses.

## ERROR #1

Проблема:
- HTTP `500`;
- Cloudflare Error `1101`;
- HTML error page вместо JSON.

Для диагностики был включён Cloudflare Logging / Observability.

Причина:

PBKDF2:

`ITERATIONS = 600000`

Исправление:

`ITERATIONS = 100000`

Результат:
- successful register → HTTP `201`;
- duplicate email → HTTP `409`;
- `EMAIL_ALREADY_EXISTS`.

Status:

**FIXED**

Commit:

`f0b2ddbae29a61c34eacede3c753f163ad1d05df`

---

# 9. Password verification

Файл:

`worker/lib/password.ts`

Текущее значение:

`const ITERATIONS = 100_000;`

Реализовано:
- PBKDF2;
- SHA-256;
- random salt;
- 256-bit derived key;
- `hashPassword()`;
- `verifyPassword()`;
- base64 encode/decode;
- safe byte comparison.

Commit:

`5dcb94a9cfa81ebe22fc2f5622bf6abf3d151646`

---

# 10. Session layer

Создан:

`worker/lib/session.ts`

Реализовано:
- random 32-byte session token;
- Base64URL format;
- SHA-256 token hash;
- 30-day expiry;
- cookie builder.

Cookie:
- `dfbk_session`
- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/`

Архитектурный принцип:

**Настоящий session token хранится только в browser cookie. В D1 хранится только hash.**

Commit:

`8a054ed5c5a4ab62944486aa13c3344687d35f37`

---

# 11. Backend Login

Файл:

`worker/routes/auth.ts`

Endpoint:

`POST /api/auth/login`

Flow:

`email + password → user lookup → password_hash → verifyPassword() → email_verified → session token → SHA-256 token → sessions INSERT → HttpOnly cookie`

Обработаны ответы:
- `INVALID_JSON`
- `EMAIL_AND_PASSWORD_REQUIRED`
- `INVALID_CREDENTIALS`
- `EMAIL_NOT_VERIFIED`
- `SESSION_CREATION_FAILED`
- success `200` + `Set-Cookie`.

Commit:

`c9d27ee5e1845037958f00b4d81355e6cf74a00f`

Login-код уже присутствует, но полноценный end-to-end login ещё не считается завершённым до email verification и теста verified user.

---

# 12. Auth — что ещё не завершено

Пока остаются незавершёнными:
- email verification;
- полноценный verified login test;
- session validation/current-user logic;
- logout;
- forgot password;
- reset password;
- frontend Auth integration.

В `auth.ts` соответствующие routes пока частично остаются заглушками.

---

# 13. Frontend — первый большой Hero showcase

Был создан отдельный много-сценарный DFBK showcase для трёх отраслей:

1. Renovierung
2. Nagelstudio
3. Konditorei

Добавлено:
- 11 WebP;
- 3 SVG;
- runtime HTML/CSS/JavaScript;
- config;
- переключение сценариев;
- переходы между сценами;
- responsive layout;
- Hero 4:5;
- standalone 16:9;
- mobile 4:5.

Showcase интегрирован в Homepage Hero вместо placeholder.

Frontend не обращается к `/api/*` и не затрагивает D1/Auth/SQL.

Feature branch:

`feature/hero-multiscenario-visual`

Коммиты:
- `bf867f43400b0ebed3cb4c75c2d40d9635dca0cd`
- `a07818bd4de54ff1529505f2d399fac6b1848573`
- `090e79ca47f81ba0e7a6da76d5b7fbc86840edcf`

PR #1:

`feat(home): add three-scenario DFBK showcase`

Изменено:
- 20 файлов;
- +713 / -1.

Merge commit:

`583e2cd19382025bac0040b48e1b103b7d046206`

Status:

**MERGED into main**

---

# 14. Frontend — отраслевые карточки Vorteil

После Hero showcase работа продолжилась над отраслевыми карточками.

Визуальная логика карточек была разработана в Generator Ideen и перенесена в Frontend без повторного проектирования.

MASTER/reference Gastronomie:
- широкий raster примерно 1536×521;
- aspect ratio около 2.95:1;
- белый rounded container;
- clean SaaS;
- photo слева;
- DFBK brand block в центре;
- result/content block справа;
- синие стрелки между этапами;
- light mint result zone.

Позже визуальная концепция была упрощена:
- убрать лишнюю нумерацию шагов;
- снизить акцент на AI;
- усилить DFBK.app;
- сохранить узнаваемую DFBK icon-концепцию;
- убрать лишние элементы и growth scale;
- не увеличивать высоту фотографий;
- сохранять горизонтальные пропорции карточек.

Особое правило Frontend:

**Всегда контролировать вес файлов для mobile и desktop. Если можно облегчить без заметной потери качества — облегчать.**

---

# 15. Vorteil profession card deck — финальная реализация

Создана feature branch:

`feature/profession-card-deck`

Добавлено пять финальных карточек в WebP.

Функциональная логика:
- 100% ширина контейнера;
- без точек pagination;
- без кнопок перехода;
- без горизонтального сдвига элементов;
- один кадр плавно угасает;
- следующий плавно проявляется;
- crossfade;
- период показа примерно 4.2 секунды;
- transition примерно 1 секунда.

Commit:

`9164afdb0f3aaecc6f41c1b46e9f207ae8047266`

Затем карточки были слиты в `main`.

Merge commit:

`31c71e0e2af233ea218018ae737581db91936ba9`

Message:

`Merge profession card crossfade into main`

Status:

**MERGED / FRONTEND BLOCK CLOSED**

---

# 16. Важное правило по Frontend assets

Для всех следующих визуальных элементов:
- проверять размеры;
- проверять weight;
- отдавать WebP/оптимизированные форматы;
- не загружать тяжёлые исходники без необходимости;
- учитывать mobile не меньше, чем desktop;
- сохранять качество только до уровня, который реально заметен пользователю.

Это постоянное правило проекта.

---

# 17. Что уже находится в main к текущей точке

В `main` уже находятся:
- рабочая Auth DB integration;
- register fix;
- password verify logic;
- session utilities;
- login backend code;
- Hero multiscenario showcase;
- Renovierung/Nagelstudio/Konditorei assets;
- homepage Hero integration;
- Vorteil profession card crossfade;
- оптимизированные WebP карточек;
- исторический checkpoint проекта.

---

# 18. Известные важные commits

Backend:
- `f0b2ddbae29a61c34eacede3c753f163ad1d05df` — PBKDF2 error fix
- `5dcb94a9cfa81ebe22fc2f5622bf6abf3d151646` — verifyPassword
- `8a054ed5c5a4ab62944486aa13c3344687d35f37` — session.ts
- `c9d27ee5e1845037958f00b4d81355e6cf74a00f` — login flow

Frontend Hero:
- `bf867f43400b0ebed3cb4c75c2d40d9635dca0cd`
- `a07818bd4de54ff1529505f2d399fac6b1848573`
- `090e79ca47f81ba0e7a6da76d5b7fbc86840edcf`
- merge `583e2cd19382025bac0040b48e1b103b7d046206`

Project checkpoint:
- `6b49f82af07ab52e680cc5c5c6a97ca96ad2ea0e`

Vorteil cards:
- `9164afdb0f3aaecc6f41c1b46e9f207ae8047266`
- merge `31c71e0e2af233ea218018ae737581db91936ba9`

---

# 19. Что остаётся незавершённым

## Backend/Auth
- email verification;
- verified login end-to-end test;
- session validation;
- current user / protected state;
- logout;
- forgot password;
- reset password.

## Frontend/Auth
- register UI ↔ API;
- login UI ↔ API;
- verification UI;
- password reset UI;
- protected account/dashboard state.

## Deployment/Domain
- продолжать контролировать Cloudflare deploy после merge;
- при deploy error работать через `ERROR_!!!`;
- окончательно проверить HTTP → HTTPS / www → root при необходимости.

## Main MVP
- photo upload;
- storage;
- AI analysis;
- generated work description;
- marketing text generation;
- result screen;
- export/copy;
- later direct publishing integrations.

---

# 20. Текущая фактическая точка остановки

На 17.09.2026 Frontend-блок с Hero и Vorteil-карточками завершён и слит в `main`.

Последний merge:

`31c71e0e2af233ea218018ae737581db91936ba9`

То есть следующий рабочий сеанс НЕ должен заново собирать Hero или Vorteil cards.

Текущий логический переход:

**проверить состояние deployment после последнего merge → при успехе продолжить следующий запланированный функциональный блок → при ошибке идти в ERROR_!!!**

Backend при возвращении продолжать с незавершённого Auth chain, а не с register.

---

# 21. Правило Plan & Gemacht

После каждого крупного рабочего блока фиксировать:
- что реально сделано;
- файлы;
- commits;
- merges/PR;
- ошибки;
- исправления;
- протестированное;
- непротестированное;
- точную точку остановки;
- один следующий action.

Новая задача всегда сверяется с последней контрольной точкой проекта.

---

# 22. Итог

Путь проекта к текущему состоянию:

**Idea Generator → DFBK brand → domain → Cloudflare/GitHub → D1 Auth DB → Register → PBKDF2 fix → Password verify → Sessions → Login code → Hero showcase → Profession/Vorteil cards → merge into main.**

Текущий проект уже имеет устойчивую базу, рабочий визуальный frontend-слой и существенную часть Auth backend.

Следующие изменения должны развивать эту цепочку, а не пересобирать уже закрытые этапы без технической причины.
