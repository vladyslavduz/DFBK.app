# SQL TASK — Social Publishing V1

Дата: 07.10.2026 Europe/Berlin. PREPARED / NOT APPLIED. Production `dfbk-db` не изменялась этой задачей.

## Preflight

Зафиксировать production backup / D1 Time Travel checkpoint. Выполнить:

```sql
SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('social_connections','social_oauth_states','publication_requests','publication_jobs');
PRAGMA table_info(users);
PRAGMA table_info(projects);
PRAGMA table_info(project_media);
SELECT COUNT(*) AS users_before FROM users;
SELECT COUNT(*) AS projects_before FROM projects;
SELECT COUNT(*) AS media_before FROM project_media;
SELECT COUNT(*) AS contents_before FROM generated_contents;
```

Все четыре social tables должны отсутствовать. Если существует хотя бы одна, STOP: сравнить реальную схему, не выполнять CREATE повторно и не скрывать несовпадение IF NOT EXISTS. Основные таблицы/поля должны соответствовать актуальному backend. Не выводить auth/token rows.

## Apply

Отдельно и явно выполнить `database/tasks/2026-10-07-social-publishing-v1.sql` после review и backup. Новые сущности:

- social_connections: encrypted credentials, owner/provider/account uniqueness, максимум один active account per provider.
- social_oauth_states: одноразовый state hash, owner + session binding, expiration; без OAuth code/tokens.
- publication_requests: durable owner/key uniqueness, canonical payload hash, batch admission/rate bound.
- publication_jobs: immutable caption/media snapshot, per-provider status, container/checkpoint/result, no duplicate processing of same job.

Две дополнительные таблицы нужны для безопасного OAuth replay protection и multi-provider idempotency; это не изменение существующих Auth tables. Никаких ALTER существующих tables, backfill, удаления проектов/media, user-plan updates, public R2 или новых buckets.

При частичном выполнении/ошибке STOP, сначала проверить фактический результат. Не повторять файл вслепую. `CREATE TABLE` constraints/indexes проверить через sqlite_master, а FK через PRAGMA foreign_key_list.

## Verify

```sql
SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND (name LIKE 'social_%' OR name LIKE 'publication_%' OR name LIKE 'idx_social_%' OR name LIKE 'idx_publication_%');
PRAGMA table_info(social_connections);
PRAGMA table_info(social_oauth_states);
PRAGMA table_info(publication_requests);
PRAGMA table_info(publication_jobs);
PRAGMA foreign_key_list(social_connections);
PRAGMA foreign_key_list(publication_jobs);
PRAGMA foreign_key_check;
SELECT COUNT(*) AS connections FROM social_connections;
SELECT COUNT(*) AS states FROM social_oauth_states;
SELECT COUNT(*) AS requests FROM publication_requests;
SELECT COUNT(*) AS jobs FROM publication_jobs;
SELECT COUNT(*) AS users_after FROM users;
SELECT COUNT(*) AS projects_after FROM projects;
SELECT COUNT(*) AS media_after FROM project_media;
SELECT COUNT(*) AS contents_after FROM generated_contents;
```

Ожидание: новые tables пусты, старые counts равны before, FK check без новых нарушений. Все defaults, CHECK, unique owner/provider/account, unique owner/idempotency key, unique request/provider и partial unique active connection соответствуют файлу.

Вернуть `SOCIAL SQL TASK COMPLETED / VERIFIED` с датой, counts, backup и результатами schema/index/FK verification. До этого backend остаётся в draft, `SOCIAL_ENABLED` отсутствует/false. Не включать реальные social actions в frontend.

## Retention / recovery

Expired OAuth states можно удалить оператором после безопасного retention window; они не нужны после callback. Не удалять active/recent states и не сбрасывать публикации по таймеру. Pending account credentials, если выбор не завершён, нуждаются в согласованной retention policy перед wider launch; disconnect уже удаляет все credentials этого provider.

Jobs с processing / SOCIAL_PUBLICATION_OUTCOME_UNKNOWN могут отражать реально опубликованный post. Оператор проверяет конкретный job/account/provider и external result, затем фиксирует результат отдельным guarded operation. Не переводить такие jobs массово в pending/failed: blind retry может создать duplicate public post. Token-key rotation требует re-encryption или controlled reconnect; нельзя просто заменить encryption key и считать старые tokens рабочими.
