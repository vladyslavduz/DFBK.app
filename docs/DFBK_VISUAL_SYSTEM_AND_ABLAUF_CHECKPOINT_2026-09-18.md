# DFBK.app — Visual System + Ablauf Checkpoint

**Дата:** 18.09.2026  
**Статус:** секция `Ablauf / HowItWorks` завершена для текущей версии сайта и слита в `main`.

---

## 1. Текущая Frontend-последовательность

На текущий момент закрыты и считаются базовыми:

1. Hero multiscenario showcase
2. Vorteil profession cards
3. Funktionen
4. Ablauf / HowItWorks

Эти блоки не пересобирать с нуля без явной причины. Дальнейшая работа должна идти через точечную визуальную унификацию и развитие следующих секций.

---

## 2. Ablauf — что реализовано

Основной файл:

`src/sections/HowItWorks.tsx`

Стили:

`src/styles/global.css`

Вместо старой упрощённой 4-шаговой схемы реализован полноценный 5-шаговый процесс:

### 01 — Foto aufnehmen oder hochladen
`/visual/ablauf/01-foto-hochladen.webp`

Описание:
Fotografiere deine Arbeit direkt mit dem Smartphone oder lade ein vorhandenes Foto hoch.

### 02 — Kurz beschreiben
`/visual/ablauf/02-kurz-beschreiben.webp`

Описание:
Schreibe oder sprich kurz ein, was du gemacht hast und was dir wichtig ist.

### 03 — DFBK.app versteht
`/visual/ablauf/03-dfbk-versteht.webp`

Описание:
DFBK.app erkennt dein Foto, versteht deine Angaben und verbindet alles miteinander.

### 04 — Inhalte erstellen & prüfen
`/visual/ablauf/04-inhalte-pruefen.webp`

Описание:
DFBK.app erstellt passende Bilder und Texte. Du prüfst das Ergebnis und passt es bei Bedarf an.

### 05 — Sichtbar werden
`/visual/ablauf/05-sichtbar-werden.webp`

Описание:
Nutze deine fertigen Inhalte für Website, Google und Social Media – und erreiche neue Kunden.

Заголовок секции:

**Ablauf**  
**So funktioniert DFBK.app**

Подзаголовок:

**In 5 einfachen Schritten von deiner Arbeit zu mehr Kunden.**

---

## 3. Ablauf — визуальная логика

### Desktop
- 5 карточек в одну строку;
- каждая карточка имеет номер;
- номера соединены тонкой синей линией;
- последняя точка акцентирована активным синим кругом;
- изображения внутри карточек;
- текст под изображением;
- равномерный ритм и одинаковая высота карточек;
- section-muted фон.

### Tablet
- вертикальная последовательность;
- номер слева;
- карточка справа;
- вертикальная connecting line;
- image + copy внутри одной карточки.

### Mobile
- компактная вертикальная цепочка;
- уменьшенные marker circles;
- изображения уменьшены;
- текстовая часть остаётся читаемой;
- сохраняется визуальное ощущение одного процесса.

---

## 4. Финальный summary-блок Ablauf

Под основным процессом расположен отдельный summary card:

**Eine fertige Arbeit. Viele Möglichkeiten.**

Подпись:

**Du machst die Arbeit. DFBK.app macht sie sichtbar.**

Визуально:
- светлый blue gradient;
- мягкая border;
- rounded corners;
- лёгкая тень;
- line icon;
- navy/blue typography.

Этот блок следует использовать как пример для будущих secondary highlight cards.

---

## 5. Контрольные commits

Feature commit:

`c55378d301f59060e12be71799e5d188c1985fa1`

Message:

`feat(home): build approved Ablauf section`

Merge commit:

`21396b2512a2ebc94c5e47d58ff4ff79749194a1`

Message:

`Merge approved Ablauf block`

**Статус: MERGED / CLOSED**

---

# 6. DFBK.app — зафиксированный визуальный язык

Ниже — текущая цифровая спецификация стиля сайта, собранная из Generator Ideen + Frontend.

## Общий характер

DFBK.app должен выглядеть как:

- clean SaaS;
- практичный;
- понятный;
- современный;
- дружелюбный, но не игрушечный;
- ориентированный на малый бизнес и Handwerk;
- визуально простой;
- без ощущения перегруженной AI-платформы.

Главный принцип:

**Показываем понятную пользу и результат, а не технологию ради технологии.**

---

## 7. Цветовая система

Базовая палитра проекта:

- Dark Navy: `#102A43`
- Primary Blue: `#2563EB`
- Amber Accent: `#FFB000`
- Main Background: `#F7F8F5`
- Card Background: `#FFFFFF`
- Main Text: `#17212B`
- Muted Text: `#64748B`
- Borders: `#DDE3E8`
- Success: `#16834A`
- Error: `#B42318`

Дополнительная визуальная зона:
- light blue / mint backgrounds;
- мягкие blue gradients;
- очень светлые нейтральные подложки.

Запрещено:
- слишком много насыщенных цветов;
- тяжёлые dark-section блоки без необходимости;
- кислотные AI-gradient решения;
- случайные цвета, не связанные с основной системой.

---

## 8. Контейнеры и карточки

Типовая карточка DFBK:

- белый фон;
- `border-radius` около 16–20 px;
- тонкая светлая border;
- лёгкая мягкая shadow;
- чистые внутренние отступы;
- визуальная иерархия через spacing, а не через декор.

Карточки не должны:
- выглядеть как отдельные приложения;
- иметь тяжёлый 3D;
- использовать толстые рамки;
- иметь множество badges одновременно.

---

## 9. Типографика

Подход:

- крупные, короткие h2;
- минимальное количество строк;
- navy/dark основной цвет;
- secondary copy — muted gray;
- немецкие формулировки короткие и прикладные;
- избегать AI-терминологии там, где можно сказать DFBK.app.

Пример правильного подхода:

**DFBK.app macht Marketing einfacher**

вместо перегруженного объяснения технологии.

---

## 10. Изображения

Базовый стиль изображений:

- реалистичные люди;
- реальный малый бизнес;
- работа руками;
- реальные рабочие ситуации;
- smartphone-first context;
- естественное освещение;
- без чрезмерно рекламного stock-look.

Отрасли, уже закреплённые визуально:
- Gastronomie
- Friseur & Beauty
- Handwerk
- Praxis
- Beratung

Дополнительные рабочие сценарии:
- Renovierung
- Nagelstudio
- Konditorei

---

## 11. Графика / illustrations

Для схем и процессов:

- clean vector / soft 3D hybrid;
- белый или светлый фон;
- blue/navy как основной UI color;
- лёгкие тени;
- без cartoon overload;
- без футуристического AI-glow;
- интерфейс должен быть понятен даже без чтения мелкого текста.

Графика показывает:

**input → processing → usable result**

а не абстрактную AI-мозговую сеть.

---

## 12. Motion / Animation

Основной motion style:

- мягкие transition;
- opacity;
- subtle blur;
- crossfade;
- scroll reveal;
- без резких slide-in;
- без bouncing;
- без агрессивных parallax effects.

Уже утверждены:

### Hero
много-сценарный showcase.

### Vorteil
crossfade без ручных dots/buttons.

### Funktionen
scroll reveal через IntersectionObserver.

### Ablauf
статический process flow с responsive перестройкой.

Motion должен поддерживать контент, а не быть самостоятельным аттракционом.

Обязательно:
- поддерживать `prefers-reduced-motion`.

---

## 13. Mobile-first правила

Любой новый блок проверяется отдельно на:

- desktop;
- tablet;
- mobile.

Для mobile:

- вертикальная структура предпочтительнее горизонтальных сложных схем;
- сохранять читаемость;
- уменьшать illustration, но не текст до мелкого размера;
- не создавать горизонтальный scroll;
- не делать элементы зависимыми от hover;
- кнопки и CTA должны оставаться touch-friendly.

---

## 14. Asset rules

Перед добавлением любого изображения:

1. проверить размер;
2. проверить визуальное качество;
3. конвертировать в WebP, если это raster;
4. не хранить тяжёлые исходники без необходимости;
5. использовать SVG для простых иконок/графики;
6. применять lazy loading вне первого viewport;
7. учитывать mobile bandwidth.

Правило:

**Если изображение можно облегчить без видимой потери качества — облегчать.**

---

## 15. Брендовая логика

Основной message hierarchy:

1. работа пользователя;
2. DFBK.app помогает сделать её видимой;
3. готовый маркетинговый результат;
4. новые клиенты.

Не делать главным:

- AI;
- automation;
- technology;
- API;
- model names.

AI остаётся внутренним механизмом продукта, не основным визуальным обещанием.

---

## 16. Структура homepage на текущей контрольной точке

Текущая последовательность:

1. Header
2. Hero
3. Benefits / Vorteil
4. Funktionen
5. Ablauf / HowItWorks
6. Testimonials
7. Pricing
8. Footer

Состояние:

- Hero — CLOSED
- Vorteil — CLOSED
- Funktionen — CLOSED
- Ablauf — CLOSED
- Testimonials — NEXT
- Pricing — AFTER
- final visual harmonization — LATER

---

## 17. Следующая логическая работа

### Шаг 1
Проверить текущий production после merge Ablauf.

### Шаг 2
Перейти к `Testimonials`.

Важно:
до появления реальных клиентов нельзя создавать ложные реальные отзывы.

Допустимые варианты:
- demo structure;
- placeholders;
- use-case snippets;
- explanatory social-proof block;
- clearly marked examples.

### Шаг 3
Перейти к Pricing.

Принцип:
- минимум тарифов;
- простое понимание цены;
- не перегружать billing логикой до MVP.

### Шаг 4
После completion homepage выполнить Visual Harmonization Pass.

---

# 18. Будущий Visual Harmonization Pass

После того как основные секции готовы, пройти сайт сверху вниз и унифицировать:

- радиусы карточек;
- shadows;
- vertical spacing;
- heading scale;
- eyebrow style;
- button dimensions;
- card borders;
- blue shades;
- muted backgrounds;
- illustration scale;
- mobile paddings;
- animation duration;
- CTA wording;
- widths контейнеров.

Цель:

**Сайт должен выглядеть как одна система, а не как набор отдельно сделанных секций.**

---

## 19. Что сейчас НЕ делать

Пока не завершены основные секции:

- не начинать полный redesign;
- не менять цветовую систему;
- не переделывать Hero;
- не переделывать Vorteil;
- не переделывать Funktionen;
- не переделывать Ablauf;
- не добавлять тяжёлые декоративные эффекты.

Все визуальные несогласованности записываются для финального harmonization pass.

---

## 20. Текущая точка проекта

Последний закрытый Frontend-блок:

**Ablauf / HowItWorks**

Merge:

`21396b2512a2ebc94c5e47d58ff4ff79749194a1`

Следующая Frontend-задача:

**Testimonials**

После Testimonials:

**Pricing**

После основных секций:

**Visual Harmonization Pass**

---

## 21. Один следующий конкретный шаг

**Проверить production после merge Ablauf. Если всё отображается корректно — открыть `src/sections/Testimonials.tsx` и спроектировать следующую секцию в соответствии с зафиксированным DFBK visual system.**
