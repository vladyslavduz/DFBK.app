# DFBK.app User Area — Frontend V1

## Scope

This branch implements the complete visual user journey without changing Worker routes, D1 schema, secrets, billing or publishing integrations.

## Routes

- `/app` — empty/existing user dashboard
- `/app/new` — Foto → Beschreibung/Sprache → DFBK.app verarbeitet → Ergebnis
- `/app/projects` — project library
- `/app/projects/:id` — project photo, description and generated channel content
- `/app/settings` — profile, sign-in methods and logout
- `/app/billing` — current plan placeholder without invented prices
- `/verify-email` — verification pending/success frontend state

Legacy frontend URLs redirect into the new `/app` structure.

## Real existing contracts used

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/google`

## Frontend-only states

Project data, edited channel text and the minimal user profile are isolated per authenticated user and stored in browser localStorage for the V1 preview. Photo selection, voice UI, processing, optimized image, project content, Apple login, password change, account deletion and billing are visual/mock states until backend contracts are added.

## UX and design

- Existing DFBK.app colors and tokens only
- Mobile-first photo flow and fixed bottom navigation
- Lightweight desktop navigation instead of a CRM sidebar
- Empty state without empty statistics
- No AI/KI terminology in the personal area
- No automatic publishing claim
- Existing WebP assets reused; no new heavy media assets or runtime libraries

## Quality checks

- Vite production build
- Frontend TypeScript check
- iPhone, tablet and desktop responsive breakpoints
- `prefers-reduced-motion` support
- touch targets and non-horizontal mobile content
