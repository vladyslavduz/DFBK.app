# API map — exact connection points

Every route below already exists as a safe `501 NOT_IMPLEMENTED` placeholder.

| Route | Purpose | Secret / binding later |
|---|---|---|
| `GET /api/health` | Worker health check | none |
| `POST /api/auth/register` | create account | SESSION_SECRET, EMAIL_API_KEY, DB |
| `POST /api/auth/login` | login/session | SESSION_SECRET, DB |
| `POST /api/auth/forgot-password` | reset e-mail | SESSION_SECRET, EMAIL_API_KEY, DB |
| `POST /api/ai/analyze-photo` | vision analysis | OPENAI_API_KEY |
| `POST /api/ai/generate-content` | generate marketing text | OPENAI_API_KEY |
| `/api/projects*` | save/reference projects | D1 (later), R2 (later) |
| `/api/upload*` | photo upload | R2 (later) |
| `POST /api/publish/google_business` | Google Business post | Google OAuth secrets |
| `POST /api/publish/instagram` | Instagram publishing | Meta secrets |
| `POST /api/publish/facebook` | Facebook publishing | Meta secrets |
| `POST /api/publish/telegram` | Telegram channel | TELEGRAM_BOT_TOKEN |
| `/api/integrations/google*` | Google OAuth | Google secrets |
| `/api/integrations/meta*` | Meta OAuth | Meta secrets |
| `POST /api/billing/checkout` | subscription checkout | STRIPE_SECRET_KEY |
| `POST /api/billing/webhook` | billing webhook | STRIPE_WEBHOOK_SECRET |

The current code intentionally does not call third-party APIs.
