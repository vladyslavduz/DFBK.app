# SQL TASK — Project Management + Trial Entitlements v1

Дата: 06.10.2026 (Europe/Berlin). Status: PREPARED / NOT APPLIED TO PRODUCTION.

Задача для ветки SQL DB DFBK.app: выполнить отдельно и явно additive изменение `projects` перед deploy зависимого backend. Не повторять Admin migration. Не менять users, Auth, sessions, generated_contents или private R2.

## Почему нужна schema change

1. `title_source` надёжно сохраняет намерение пользователя. Сравнение текста с «Neues Projekt» не защищает ручной rename и race с generation.
2. Persistent optimization state + уникальный operation token запрещают два параллельных платных вызова из разных Worker instances. Внутрипроцессный flag недостаточен.

## Проверка до выполнения

В production D1 `dfbk-db`:

```sql
PRAGMA table_info(projects);
SELECT sql FROM sqlite_master WHERE type='table' AND name='projects';
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='projects';
SELECT COUNT(*) AS projects_before FROM projects;
SELECT COUNT(*) AS optimized_before FROM project_media WHERE role='optimized';
```

Убедиться, что новые поля ещё отсутствуют. Если часть полей уже есть — STOP, не запускать ALTER повторно; сравнить schema с задачей. Сделать production backup / зафиксировать точку Time Travel. Не выводить приватные фото, секреты или содержимое auth tables.

## Выполнение

Точный SQL находится в:

`database/tasks/2026-10-06-project-management-trial-v1.sql`

Это отдельный TASK, не автоматически применяемая migration.

Добавляются:

| Поле | Значение |
|---|---|
| title_source | NOT NULL DEFAULT system; CHECK system/auto/manual |
| photo_optimization_state | NOT NULL DEFAULT available; CHECK available/processing/completed |
| photo_optimization_token | nullable TEXT, UUID operation lock |
| photo_optimization_started_at | nullable SQLite UTC timestamp |

Backfill сохраняет meaningful legacy titles как manual, поскольку происхождение старого названия неизвестно. Старые placeholder names остаются system. Текст названия, дата создания и данные проектов не заменяются.

Проекты с существующим optimized media помечаются completed. Они уже использовали успешную оптимизацию, даже если созданы до этого этапа.

Изменений пользователей/планов и удаления записей нет. Нового bucket нет. Lifetime counter не добавляется, поскольку в актуальном коде Delete Project отсутствует; считаются все существующие проекты владельца. Если в будущем появится Delete, отдельно внедрить persistent lifetime usage до запуска удаления.

## Проверка после выполнения

```sql
PRAGMA table_info(projects);
SELECT COUNT(*) AS projects_after FROM projects;
SELECT COUNT(*) AS optimized_after FROM project_media WHERE role='optimized';
SELECT title_source, COUNT(*) AS count FROM projects GROUP BY title_source;
SELECT photo_optimization_state, COUNT(*) AS count FROM projects GROUP BY photo_optimization_state;
SELECT COUNT(*) AS inconsistent_optimized FROM projects p
WHERE p.photo_optimization_state <> 'completed'
  AND EXISTS (SELECT 1 FROM project_media pm WHERE pm.project_id=p.id AND pm.role='optimized');
```

Expected: counts before/after совпадают; inconsistent_optimized=0; constraints/defaults соответствуют таблице выше. Вернуть checkpoint «SQL TASK COMPLETED / VERIFIED» с датой и результатами. Только затем можно merge/deploy зависимого backend.

## Восстановление зависшего operation lock

Обычная provider ошибка, response timeout, read/storage error освобождают lock автоматически и возвращают available. Image API fetch ограничен 180 секундами.

При жёстком завершении Worker или неопределённом результате D1 commit `finally` не гарантирован. В этом редком случае lock сохраняется processing, чтобы не отправить второй платный запрос вслепую. Автоматический expiry lock не включён: старый Worker мог ещё сохранять результат.

Оператор сначала проверяет конкретный projectId, время и token, media metadata, R2 storage и завершение старого запроса. Если optimized есть, сохранить completed. Если подтверждено, что старый запрос закончился, результата нет и D1 не содержит optimized, можно вернуть available отдельным guarded UPDATE с проверкой известного token. Не сбрасывать живой lock по таймеру или из frontend. Не удалять working optimized.

Это эксплуатационная проверка, а не дополнительный пользовательский endpoint. Не запускать maintenance UPDATE без проверки конкретного проекта и состояния.
