# Page map

## Public
- `/` — landing page, current visual direction kept.
- `/pricing` — pricing placeholder.
- `/help` — FAQ/support.
- `/impressum`, `/datenschutz`, `/agb`, `/widerruf` — legal placeholders.

## Account
- `/login`
- `/register`
- `/forgot-password`

## Product
- `/dashboard` — main workspace.
- `/create` — upload/new project.
- `/result` — AI result/review.
- `/projects` — archive/references.
- `/projects/:id` — project details.
- `/profile` — business context used by AI.
- `/integrations` — Google/Meta/Telegram/etc.
- `/settings`
- `/billing`

All pages are separate source files under `src/pages/` so they can evolve independently.
