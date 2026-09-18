# DFBK.app — Backend / Email checkpoint

**Дата:** 18.09.2026  
**Статус:** текущий backend/email рабочий блок зафиксирован перед паузой.

---

## 1. Что было завершено до email-блока

Базовая Auth-цепочка уже работает:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Register ранее исправлен после Cloudflare 1101 / PBKDF2 issue:

- PBKDF2 iterations: `100_000`
- register success: HTTP `201`
- duplicate email: HTTP `409 / EMAIL_ALREADY_EXISTS`

Login использует:

- `verifyPassword()`
- `email_verified`
- случайный session token
- SHA-256 hash session token в D1
- `dfbk_session` HttpOnly/Secure/SameSite=Lax cookie

---

## 2. Current user / active session

Commit:

`a6a85735e5c1e0296ea9ed8d1cbc8348364a752d`

Добавлен endpoint:

`GET /api/auth/me`

Flow:

`dfbk_session cookie`
→ SHA-256
→ lookup по `sessions.token_hash`
→ проверка `revoked_at`
→ проверка `expires_at`
→ JOIN `users`
→ текущий пользователь.

Обрабатываются состояния:

- `NOT_AUTHENTICATED`
- `INVALID_SESSION`
- `SESSION_REVOKED`
- `SESSION_EXPIRED`
- success `200`

---

## 3. Logout / session revocation

Commit:

`21514bf1ef2c32097ea08935cb82140b5714fdd0`

Endpoint:

`POST /api/auth/logout`

Flow:

`dfbk_session cookie`
→ SHA-256
→ поиск session через `token_hash`
→ `revoked_at = CURRENT_TIMESTAMP`
→ очистка cookie.

Logout сделан идемпотентным: отсутствие cookie не считается ошибкой.

Cookie очищается через:

- `Max-Age=0`
- `Expires=Thu, 01 Jan 1970 00:00:00 GMT`
- `HttpOnly`
- `Secure`
- `SameSite=Lax`

Текущий auth milestone `register / login / session / me / logout` считается закрытым и проверенным.

---

# 4. Email verification token layer

Создан файл:

`worker/lib/auth-token.ts`

Commit:

`ba5e824522da8e59fed59a9acf88ccf1e8700426`

Реализовано:

- `createAuthToken()`
- random token: 32 bytes
- Base64URL output
- `hashAuthToken()`
- SHA-256 token hash
- `getEmailVerificationExpiry()`
- срок verification token: **24 часа**

Принцип безопасности:

**сырой verification token отправляется пользователю по ссылке; в D1 хранится только SHA-256 hash.**

---

# 5. Resend email helper

Создан файл:

`worker/lib/email.ts`

Initial commit:

`4e94efd5266bba527f461632abf9724da70f9c4a`

Реализована функция:

`sendVerificationEmail()`

Используется Resend API:

`https://api.resend.com/emails`

Email содержит:

- subject: `E-Mail-Adresse bestätigen – DFBK.app`
- бренд DFBK.app
- кнопку `E-Mail bestätigen`
- verification URL
- указание, что ссылка действует 24 часа
- текст для пользователя, который не регистрировался.

Цветовая логика письма соответствует бренду:

- Navy `#102A43`
- Blue `#2563EB`
- Text `#17212B`
- Muted `#64748B`

При ошибке Resend:

- логируется `RESEND_EMAIL_ERROR`
- функция выбрасывает ошибку.

---

# 6. Исправление имени email secret

Изначально helper использовал старое имя:

`EMAIL_API_KEY`

Это исправлено.

Правильное имя Cloudflare Worker secret:

`RESEND_API_KEY`

Commit `env.ts`:

`fb6c5d5f40953eb3efa4ddf981b15c285057c8e0`

Commit `email.ts`:

`4b39d6f01bccb866083726a0265260354737bd90`

Текущее правило:

- `RESEND_API_KEY` — Secret
- `EMAIL_FROM` — обычная runtime variable с подтверждённым sender/domain Resend
- не создавать дублирующий `EMAIL_API_KEY`.

---

# 7. Register теперь связан с email verification

Commit:

`7b1d3209e227a0140c25e065f11033b29b067030`

В `POST /api/auth/register` добавлено:

1. создать пользователя;
2. создать email verification token;
3. SHA-256 hash token;
4. записать `auth_tokens` type = `email_verification`;
5. срок действия — 24 часа;
6. сформировать verification URL;
7. отправить письмо через Resend;
8. вернуть `verificationEmailSent: true`.

User + auth token создаются через `env.DB.batch(...)`.

---

# 8. Rollback при ошибке email

Если verification email не удалось отправить:

- логируется `VERIFICATION_EMAIL_SEND_ERROR`;
- только что созданный пользователь удаляется;
- связанный `auth_tokens` удаляется через `ON DELETE CASCADE`;
- пользователь может повторить регистрацию;
- API возвращает:

HTTP `502`

`VERIFICATION_EMAIL_FAILED`

Если rollback сам завершится ошибкой, логируется:

`REGISTER_ROLLBACK_ERROR`

Это предотвращает ситуацию, когда email уже занят пользователем, который физически не получил verification link.

---

# 9. Verify email endpoint

Теперь реализован:

`GET /api/auth/verify-email?token=...`

Алгоритм:

1. получить raw token из query string;
2. SHA-256 hash token;
3. найти `auth_tokens` с type `email_verification`;
4. JOIN `users`;
5. проверить `used_at`;
6. проверить `expires_at`;
7. обновить пользователя:
   - `email_verified = 1`
   - `email_verified_at = CURRENT_TIMESTAMP`
8. отметить token:
   - `used_at = CURRENT_TIMESTAMP`.

Обрабатываются ошибки:

- `VERIFICATION_TOKEN_REQUIRED`
- `INVALID_VERIFICATION_TOKEN`
- `VERIFICATION_TOKEN_ALREADY_USED`
- `VERIFICATION_TOKEN_EXPIRED`
- `EMAIL_VERIFICATION_FAILED`

Повторный переход по уже успешно использованной ссылке сделан безопасным:

если token использован и user уже verified, возвращается `200` + `alreadyVerified: true`.

---

# 10. Forgot/reset password

Пока ещё НЕ реализованы полностью:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Они остаются следующей auth/email цепочкой.

В зависимостях уже используется правильное имя:

`RESEND_API_KEY`

---

# 11. Runtime configuration

Актуальные email-related переменные:

### Secret

`RESEND_API_KEY`

### Runtime variable

`EMAIL_FROM`

Важно:

- secret value никогда не сохранять в GitHub;
- не создавать `EMAIL_API_KEY`;
- `EMAIL_FROM` должен соответствовать подтверждённому sender/domain Resend.

Проектный домен для auth/email:

`auth.dfbk.app`

---

# 12. Что считать завершённым

### CLOSED

- register basic flow
- login
- session creation
- `/api/auth/me`
- logout
- session revocation
- session cookie clearing
- auth token helper
- verification token hashing
- 24h verification expiry
- Resend email helper
- register → verification token linkage
- verify-email backend handler
- переход с `EMAIL_API_KEY` на `RESEND_API_KEY`

---

# 13. Что ещё нужно проверить/закрыть

Email-verification код уже находится в backend, но перед окончательным закрытием блока нужен реальный end-to-end runtime test:

1. убедиться, что Cloudflare deploy содержит последние commits;
2. убедиться, что Worker имеет `RESEND_API_KEY`;
3. убедиться, что `EMAIL_FROM` настроен корректно;
4. зарегистрировать новый test user;
5. получить реальное письмо;
6. открыть verification link;
7. проверить в D1:
   - `users.email_verified = 1`
   - `users.email_verified_at` заполнен;
   - `auth_tokens.used_at` заполнен;
8. проверить login нового verified user.

Если эти runtime-проверки уже выполнены в следующей сессии, email verification можно считать полностью CLOSED.

---

# 14. Следующая логическая Auth-цепочка

После подтверждения end-to-end email verification:

1. `forgot-password`
2. reset token
3. password reset email
4. `reset-password`
5. при необходимости revocation старых sessions
6. затем Frontend Auth integration.

Не возвращаться к register/login/session/me/logout без конкретной ошибки.

---

# 15. Точная точка остановки

Последний backend commit в текущем блоке:

`4b39d6f01bccb866083726a0265260354737bd90`

`worker/lib/email.ts` переведён на `RESEND_API_KEY`.

Следующий конкретный шаг при возвращении:

**Провести реальный end-to-end тест новой регистрации с отправкой verification email через Resend и подтверждением `GET /api/auth/verify-email?token=...`, затем проверить изменения в D1 и login verified user.**
