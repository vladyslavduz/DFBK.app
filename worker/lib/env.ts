export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;

  OPENAI_API_KEY?: string;

  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_REDIRECT_URI?: string;
  META_GRAPH_VERSION?: string;
  SOCIAL_ENABLED?: string;
  SOCIAL_PUBLIC_ORIGIN?: string;
  SOCIAL_TOKEN_ENCRYPTION_KEY?: string;
  SOCIAL_MEDIA_SIGNING_KEY?: string;

  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;

  TELEGRAM_BOT_TOKEN?: string;

  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  SESSION_SECRET?: string;
  ADMIN_API_KEY?: string;
}
