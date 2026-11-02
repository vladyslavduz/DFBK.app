# Планер: готовность каналов

Срез: 02.11.2026. Проверенная база main: b57a8d594cf2f185fb9549e818f974ccf7a209c1.
Статус: аудит кода и официальной документации; подключений и реальных отправок не выполнялось.

## Объём, подтверждённый владельцем

Все восемь направлений каталога, кроме Google Business. WhatsApp: выбираемые Статус, канал и сообщения клиентам, в том числе сочетания. E-Mail: письмо выбранным клиентам с фото и текстом. Наличие режима в требованиях не означает доступность API.
Общие дата/время с отдельными значениями для каналов; подтверждение расписания разрешает автоматическую отправку при закрытом сайте. Базовый часовой пояс Europe/Berlin.

## Реализация в main

| Канал | Что есть в DFBK | Чего нет / критерий подключения |
| --- | --- | --- |
| Instagram | Meta OAuth-код, адаптер создания контейнера и отправки фото, задания и ключи повторного запроса | Успешный актуальный OAuth/E2E не доказан; исторический callback incident OPEN. Проверить права, выбранный профессиональный аккаунт, формат фото, срок токена и реальное выполнение |
| Facebook | Meta OAuth-код и отправка фото в Page | Это публикация на Page, не доказанная отправка в личный профиль/группу. Требуются проверенное подключение и успешный ограниченный E2E |
| Pinterest | Ручное открытие и материалы | Нет OAuth/адаптера; нужны приложение, доступ на запись и выбранная доска. [API Pins](https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/) |
| X | Окно с подготовленным текстом | Нет OAuth/загрузки фото/адаптера; проверить доступ приложения и условия аккаунта. [Create Post](https://docs.x.com/x-api/posts/create-post) |
| LinkedIn | Ручное открытие; сервер явно возвращает in_preparation | Нет адаптера. Различать пользователя и организацию, разрешения и идентификатор автора. [Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [Posts](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11) |
| WhatsApp | Ссылка ручной передачи текста | Нет Business-коннектора. Сообщения клиентам: официальный Cloud API документирует отправку и шаблоны. Статус и каналы: пригодный официальный write API в этом аудите НЕ ПОДТВЕРЖДЁН; не подменять их отправкой в чат. [Meta collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) |
| E-Mail | mailto и отдельный Resend-код подтверждения регистрации | Это не маркетинговая рассылка. Нужны отправитель, разрешённые получатели, фото/вложение, учёт каждого получателя, статусы/отписка. [Attachments](https://resend.com/docs/dashboard/emails/attachments) |
| Website / Blog | Выбор 14 платформ и ручная инструкция | Нет коннекторов. Нужны выбранный сайт, его права и соответствующий CMS-адаптер; см. ниже |

Для используемой ветки Instagram с Facebook Login связь Page и профессионального Instagram описана в [официальной коллекции Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api). Не заменять её разрешения scopes из другого типа Login без отдельного решения.
Официальные страницы Meta напрямую вернули ошибки доступа/429; доступность App Review, текущие grants и режим Meta App не устанавливались по публичным документам. Секреты и панели Production не читались.

## Website / Blog: 14 существующих пунктов

У всех пунктов коннектор DFBK отсутствует. Наличие API у платформы не доказывает доступ конкретного клиентского сайта.

| Платформа | Подтверждённый путь / оставшаяся проверка |
| --- | --- |
| WordPress | REST posts/media, права отдельного пользователя и Application Password через HTTPS. [REST](https://developer.wordpress.org/rest-api/reference/), [auth](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/) |
| Wix | Blog draft/create/publish, разрешение Manage Blog, конкретный сайт/автор. Это блог, не произвольная правка сайта. [Draft Posts](https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/introduction?apiView=SDK) |
| Joomla | Web Services articles + API token/ACL; отдельно проверить изображения и установленную версию. [Web Services](https://manual.joomla.org/docs/general-concepts/webservices/) |
| Drupal | Включённые JSON:API write operations, аутентификация, сопоставление полей и загрузка файлов. [Create](https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/creating-new-resources-post), [files](https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/file-uploads) |
| Tilda | Найденная документация описывает получение/экспорт страниц; создание новой записи извне не подтверждено. [API](https://help.tilda.cc/api) |
| Jimdo | Автопубликация через официальный write API не подтверждена; требуется отдельная проверка конкретного продукта/тарифа |
| IONOS | Требуется определить продукт: сайт на WordPress и Website Builder — разные подключения; write API конструктора не подтверждён |
| Webflow | CMS item creation API подтверждён; публикацию, media и поля коллекции проверить отдельно. [Create item](https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-item) |
| Squarespace | Подходящий официальный blog write API не подтверждён; не считать commerce API коннектором блога |
| Ghost | Admin API posts + images; Content API не использовать для записи. [Create](https://docs.ghost.org/admin-api/posts/creating-a-post), [images](https://docs.ghost.org/admin-api/images/overview) |
| Blogger | OAuth + blogId + posts.insert; фото/хостинг и права проверить отдельно. [Insert](https://developers.google.com/blogger/docs/3.0/reference/posts/insert) |
| Shopify | Admin GraphQL articleCreate, блог и права записи; проверить загрузку/доступность картинки. [Create article](https://shopify.dev/docs/api/admin-graphql/latest/mutations/articlecreate) |
| TYPO3 | Универсальный готовый blog write contract не установлен; проверить версию, модель контента и разрешённый API/расширение конкретного сайта |
| Andere Website | Только после определения проверенного API сайта; произвольный URL не означает поддержку автопубликации |

UNKNOWN означает отсутствие доказательства в этом аудите, а не доказанное отсутствие любой возможности. Для таких направлений сохраняется ручной экспорт; автоматический режим не обещать до подтверждения.

## Подтверждённые технические разрывы

- worker/routes/social-publish.ts: POST /api/projects/:id/publish принимает несколько Meta providers, но одну общую caption. X/LinkedIn отклоняются; остальные каналы отсутствуют в контракте. runJob вызывается внутри HTTP-запроса; нельзя использовать этот маршрут как готовый фоновый планер.
- worker/lib/social-meta.ts: только Instagram photo/container и Facebook Page photos; видео/карусели не реализованы этим адаптером.
- checkMedia проверяет серверное фото; Instagram требует JPEG и ограничивает размер/пропорции. Ручной PublishingPanel конвертирует WebP в JPEG только в браузере. Эта конвертация не подготавливает серверный материал для будущего задания.
- worker/index.ts: нет scheduled/queue handler. wrangler.jsonc: нет cron/queue конфигурации, SOCIAL_ENABLED=false в репозитории. Это не повторная проверка текущих переменных Cloudflare.
- worker/routes/publish.ts и integrations.ts содержат notImplemented; наличие URL не равно коннектору.
- worker/lib/email.ts отправляет verification email. Это не готовый сервис рассылки проектов клиентам.
- database/tasks/2026-10-07-social-publishing-v1.sql описывает существующую модель Social; локальные scheduler-прототипы лежат в отдельных worktrees и не являются применёнными production-миграциями.

## Повторное использование локальных заготовок

В scheduler-adapter-local-01 есть contract/state/codec/builder/statements/decoder/adapter. Checkpoints описывают локальные тесты и cannotDispatch:true во всех результатах. Это основа проверки сохранения/повторов, не разрешение отправлять посты и не готовый HTTP сервис. Независимое QA адаптера и совместимость с локальным D1 ещё нужно подтвердить; старые результаты тестов в этом аудите не воспроизводились.

## Доступы и точка остановки

Самостоятельно: локальный серверный контракт/хранилище, mock-коннекторы, UI календаря/галочек, unit и браузерные проверки, подготовка migrations/PR и инструкций подключения.
Потребуются действия владельца: разрешённые приложения/доступы провайдеров, контрольные аккаунты и CMS-сайты, подтверждённый отправитель/получатели E-Mail, выбор и проверка разрешений. Пароли/токены не передавать в чат или документы; использовать защищённые настройки подключения.
Production D1/R2/Worker, OAuth/secrets, включение Social и реальные тестовые посты требуют отдельного разрешения. Оплата/API-тарифы не активировались. Внешние панели и актуальные production connections не проверены.

Следующая реализационная задача: локальный контракт пакета публикации и дочерних заданий с отдельными текстами, временем, адресатами и snapshot материалов; затем совместимость/QA существующего хранилища. Подробный порядок и критерии: SCHEDULER_PRODUCT_CONTRACT.md.
