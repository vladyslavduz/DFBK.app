# DFBK.app — canonical product baseline

**Решение владельца: 03.11.2026. Координация и контроль отклонений: Plan & Gemacht.**
Уточнение владельца 04.11.2026: Trial — три реальных проекта за всё время аккаунта.
Этот документ фиксирует утверждённую цель, тарифный контракт и границы реализации.
При расхождении со старыми планами/checkout handoffs сверяться с этим baseline;
исторические checkpoints не считать доказательством текущего production.

## Утверждённая цель и тарифы

Trial и Business имеют одинаковый основной сценарий: своё фото → AI-текст отдельно
для канала → подключение поддерживаемых каналов/назначений → preview → подтверждение
→ publish-now или schedule → unattended execution без открытого сайта. Можно выбрать
несколько каналов для одновременной отправки, общие дату/время либо отдельные дату/время
каждому назначению. Результат каждого назначения показывается отдельно и честно;
успех одного не означает успех остальных. Черновик не является публикацией.

- **Trial:** пробный пакет **3 lifetime-проекта + 15 успешных отправок суммарно**,
  без ежемесячного возобновления бюджета отправок.
- Один материал в три канала = три отправки. Неудачные отправки не расходуют успешную
  квоту; technical retries не списывают её повторно. Schedule резервирует место в
  бюджете, отмена освобождает резерв. Durable учёт и защита от двойного списания
  должны появиться до активации отправок; этот документ сам их не реализует.
- **Business:** тот же основной сценарий с большим объёмом. Численные лимиты,
  цена и unlimited AI **не утверждены**. Базовые возможности не закрывать только
  условием `plan === 'business'`.

15 lifetime-отправок — характеристика бюджета, **не perpetual доступ**. Действующий
срок Trial, правила expiry и downgrade не переопределяются молча: нужные продуктовые
уточнения остаются UNKNOWN. Создание реального проекта расходует lifetime-слот;
удаление его не освобождает, редактирование не является новым созданием. Точный retry
не расходует второй слот. Legacy runtime пока считает существующие строки с cap 5;
удаление строки может вернуть место при таком count. Новый target 3 ещё не enforcement.
**Утверждение владельца 05.11.2026:** историю старых Trial подтверждать вручную.
До доверенного admin-подтверждения unknown history запрещает только новые project creates.
Существующие проекты не удалять и не прятать, в том числе сверх трёх. Число неудалённых
строк не доказывает lifetime-историю; молчаливые baseline 0 и backfill запрещены.
Новый аккаунт сможет получить verified 0 только при надёжном доказательстве новизны
в будущей registration-интеграции. Manual Business grant сохраняется независимо от
платежей; новая downgrade/history policy этим решением не устанавливается.

**Блокирующий шаг перед активацией:** отдельная reviewed offline SQL task ручного
подтверждения истории. `trial_project_scope_no_update` сейчас блокирует unknown → verified;
работающего admin confirmation ещё нет. Будущая task должна в одной контролируемой
транзакции проверить единственную строку unknown/NULL конкретного аккаунта, зафиксировать
evidence и подтверждённый baseline, временно снять именно guard обновления, выполнить
условный UPDATE unknown/NULL → verified/nonnegative baseline, проверить ровно одно
изменение и восстановить тот же guard до commit. Verified baseline никогда не уменьшать
и verified scope не переписывать. Новые admissions учитываются отдельно и прибавляются
к baseline; evidence должно исключать двойной учёт. Любой провал assertion требует rollback.
Общего reset/unguarded UPDATE или production SQL здесь нет. Запрет включается только
по отдельному release/schema/config плану.

Все каналы остаются дорожной целью. Обещать automation можно только для реально
поддержанного, подключённого и ready connector с правами конкретного назначения.
Кнопка в каталоге, copy/export или native Share не являются такой интеграцией.

## Что реально реализовано на 03.11.2026

Функциональную разработку продолжаем. Live checkout и реальные списания закрыты до
отдельного согласования оформления деятельности и live billing; test billing можно
подготовить отдельной задачей. Purchase CTA должен показывать честное окно:
«DFBK.app befindet sich in Entwicklung. Zahlungen sind derzeit nicht möglich.»
с существующей контактной ссылкой владельца, если она есть. Это утверждённое UX-notice,
не уже реализованный UI, не юридическое освобождение и не установленная compliance.

- Календарь доступен для чтения, project preview released (PR68); PR69 закрепил
  `SCHEDULER_READ_ENABLED="true"` в source config. `SOCIAL_ENABLED="false"`, Social FROZEN.
- По подтверждённому production checkpoint центра созданы/проверены четыре D1 draft
  таблицы и три индекса. Это хранение/чтение черновиков, не очередь реальных отправок.
- Draft writes выключены; write/policy flags не активированы. Нет утверждённой
  реализации successful-publication ledger, reserve/consume/release или реального
  unattended dispatch. Наличие локальных модулей/тестов не означает активацию.
- Project admission foundation пока не подключён: SQL task применяется только локально
  в тестах. Неактивный store объединяет admission, реальный project INSERT и чтение receipt
  одним batch; immutable completion marker сохраняет tombstone после удаления. HTTP не подключён;
  отдельно записанный receipt не разрешает создание проекта или AI-вызов. Новым аккаунтам
  нужен проверенный scope, старым Trial — ручное подтверждение истории по решению 05.11.
  Business/downgrade history policy остаётся отдельным вопросом.
  Повтор receipt удалённого проекта не должен восстанавливать проект или запускать AI.

Ранее утверждённые **начальные технические ограничения**: `maxTargets=2`, horizon
30 дней, media 8 MiB, 100 новых drafts за rolling 24 часа. Они не являются тарифной
квотой 15 успешных отправок, не списывают её и не устанавливают окончательный запрет
остальных каналов. Не выдавать их за активные production write settings.

Краткое evidence существующего кода (тарифная сверка, не новый полный аудит):

- [project-management.ts](../worker/lib/project-management.ts#L5): legacy Trial project cap 5;
  [projects.ts](../worker/routes/projects.ts#L295) проверяет count строк при создании.
- [entitlements.ts](../worker/lib/entitlements.ts#L30): `share`/`contentGeneration`
  включены обоим; `businessIntegrations` пока различается по тарифу. Это gap к цели
  capability parity, а не новое продуктовое разрешение закрыть Trial-сценарий.
- [project-generation.ts](../worker/routes/project-generation.ts#L119): отдельная
  численная тарифная квота генераций не найдена; processing-lock не доказывает
  утверждение unlimited AI.
- [social-publish.ts](../worker/routes/social-publish.ts#L137): 20 requests/час — общий
  technical rate limit, не 15 бесплатных успешных постов и не доказательство ledger.
- [scheduler-package-create.ts](../worker/routes/scheduler-package-create.ts#L14):
  требует явные flags/policies; новый draft допускает Business или активный Trial,
  verified email и общую configured draft quota. Он возвращает `cannotDispatch:true`,
  не публикует и пока не реализует тарифный budget успешных отправок.

## Контроль отклонений

Plan & Gemacht утверждает baseline и изменения. Профильные чаты сверяются с этим
документом и возвращают в центральный чат scope, PR, проверки и блокеры. Каждый PR
указывает соответствие baseline и закрываемый gap. Несовместимое решение сначала
согласуется в центре. Новые постоянные чаты/автомации для этого не требуются.

## Следующая последовательность

1. Тарифный контракт/capability parity и enforcement budget до activation; отдельно
   уточнить открытые expiry/downgrade/project-count semantics.
2. Durable reserve/consume/release, idempotency и success per channel без двойного списания.
3. Writes и сохранение реального draft выбранного собственного проекта.
4. Первый реальный ready connector, recovery и runner после отдельных разрешений.
5. Расширение connectors, тарифы/billing и release.

Документирование цели не разрешает SQL/settings changes, Social activation, реальные
публикации или deployment. Такие действия остаются отдельными решениями центра/владельца.
