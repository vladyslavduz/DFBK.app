# DFBK.app — Frontend checkpoint: Funktionen

**Дата фиксации:** 18.09.2026  
**Статус:** блок `Funktionen` завершён и слит в `main`.

## 1. Что закрыто

На ветке Frontend завершена переработка секции `Funktionen`.

Главное решение:
- исходный визуальный каркас секции сохранялся;
- контент переработан под DFBK.app;
- акцент смещён с AI/KI на продукт DFBK.app;
- итоговая версия отказалась от карусели в пользу последовательного вертикального показа шести карточек;
- карточки появляются через мягкий scroll reveal;
- секция не требует ручных кнопок/переключателей;
- поддержан `prefers-reduced-motion`.

## 2. Финальный контент Funktionen

В `src/sections/Features.tsx` закреплены 6 функций:

1. **Foto, Text oder Sprache** — Praxis  
   `/visual/features/01-praxis-input.webp`

2. **Intelligente Fotoanalyse** — Handwerk  
   `/visual/features/02-handwerk-analyse.webp`

3. **Professionelle Texte mit DFBK.app** — Friseur  
   `/visual/features/03-friseur-texte.webp`

4. **Content für alle Kanäle** — Beratung  
   `/visual/features/04-beratung-kanaele.webp`

5. **Projekte und Referenzen** — Gastronomie  
   `/visual/features/05-gastronomie-projekte.webp`

6. **Einfach verwenden** — Gastronomie  
   `/visual/features/06-gastronomie-verwenden.webp`

Заголовок секции:

**Funktionen**  
**DFBK.app macht Marketing einfacher**

## 3. Реализация

Файлы:
- `src/sections/Features.tsx`
- `src/styles/global.css`

Финальная логика:
- `useRef` вместо таймерной карусели;
- `IntersectionObserver` для reveal;
- threshold: `0.18`;
- rootMargin: `-6% 0px -6% 0px`;
- карточки идут вертикальным списком;
- первые 2 изображения — eager loading;
- остальные — lazy loading;
- decoding — async;
- изображения отображаются по ширине контейнера с `height:auto`;
- reveal: opacity + лёгкий blur;
- при `prefers-reduced-motion` анимация отключается.

## 4. Контрольные версии

Предыдущий экспериментальный вариант с carousel:
- commit `3eb9bdb038c4c8f0cc121f140cc81a810bb1a4fc`
- message: `feat(home): add functional feature carousel`

Утверждённая версия:
- commit `4e5bc1407f969eb0ded17f3fce96bc7e6fb6370f`
- message: `fix(home): stack feature slides with scroll reveal`

Cloudflare preview утверждённой версии:
- `a17ee964`

Все изменения после утверждённой версии были отброшены.

Merge в main:
- commit `70cae0bf70e08d0c4426b4c6626c1263ca8a58a4`
- message: `Merge approved Funktionen block`

**Статус: CLOSED / MERGED**

## 5. Что уже закрыто во Frontend до этой точки

Последовательность:
1. Hero multiscenario showcase — закрыт и merged.
2. Vorteil profession cards — закрыты и merged.
3. Funktionen — закрыт и merged.

Не возвращаться к этим блокам без конкретной ошибки или отдельного решения о редизайне.

## 6. Текущая структура HomePage

`src/pages/HomePage.tsx`:

1. Header
2. Hero
3. Benefits
4. Features / Funktionen
5. HowItWorks
6. Testimonials
7. Pricing
8. Footer

Следовательно, следующий необработанный основной визуальный блок после Funktionen:

**HowItWorks**

## 7. Следующий план Frontend

### Шаг 1 — контроль после merge
Проверить Cloudflare deployment `main` после merge `70cae0bf...`.

Проверить:
- desktop;
- mobile;
- последовательность Hero → Vorteil → Funktionen;
- отсутствие layout shift;
- scroll reveal;
- загрузку всех 6 WebP;
- reduced-motion fallback.

### Шаг 2 — HowItWorks
После успешной проверки deployment перейти к `HowItWorks`.

Цель:
- показать максимально просто, как работает DFBK.app;
- не дублировать Funktionen;
- объяснить путь пользователя, а не список возможностей;
- ориентир: **Foto hochladen → DFBK verarbeitet → Content verwenden/veröffentlichen**;
- сохранить общий визуальный язык текущего сайта;
- mobile first;
- не перегружать графикой.

### Шаг 3 — Testimonials
После HowItWorks:
- подготовить структуру отзывов/социального доказательства;
- до реальных клиентов использовать только честные placeholder/demo элементы, не выдавая их за реальные отзывы.

### Шаг 4 — Pricing
После Testimonials:
- MVP pricing;
- минимальное количество тарифов;
- простая коммерческая логика;
- не подключать сложный billing раньше необходимости.

### Шаг 5 — общий Frontend audit
После завершения homepage:
- Header/Footer;
- mobile spacing;
- typography;
- CTA consistency;
- performance/assets;
- accessibility;
- финальный визуальный проход.

## 8. Приоритет проекта

Текущий Frontend приоритет:

**Deployment check → HowItWorks → Testimonials → Pricing → Homepage audit.**

Backend/Auth остаётся отдельной незавершённой цепочкой и продолжается после согласованного Frontend-блока, не начиная register заново.

## 9. Следующее одно конкретное действие

**Открыть production/preview после merge `70cae0bf...` и проверить утверждённый блок Funktionen. Если всё корректно — начать переработку `src/sections/HowItWorks.tsx`.**
