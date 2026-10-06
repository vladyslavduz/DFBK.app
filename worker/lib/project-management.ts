import type { Env } from './env';
import type { PlanCode } from './entitlements';

export const TEMPORARY_PROJECT_TITLE = 'Neues Projekt';
export const TRIAL_PROJECT_LIMIT = 5;
export const MAX_PROJECT_TITLE_LENGTH = 120;
export type TitleSource = 'system' | 'auto' | 'manual';
export type PhotoOptimizationState = 'available' | 'processing' | 'completed';

export function normalizeProjectTitle(value: unknown, maxLength = MAX_PROJECT_TITLE_LENGTH): string | null {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}<>]/u.test(value)) return null;
  const title = value.trim().replace(/\s+/gu, ' ');
  if (!title || Array.from(title).length > maxLength) return null;
  return title;
}

export function normalizeAutoTitle(value: unknown): string | null {
  const title = normalizeProjectTitle(value, 80);
  if (!title || /dfbk|\bprojekt\b|\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/iu.test(title)) return null;
  if (/^(professionelle arbeit|tolle arbeit|tolles projekt|neues projekt|amazing renovierung)$/iu.test(title)) return null;
  return title;
}

export async function getProjectUsage(env: Env, userId: string) {
  const row = await env.DB.prepare(`SELECT u.plan,
    (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects_used
    FROM users u WHERE u.id = ?1`).bind(userId).first<{ plan: PlanCode; projects_used: number }>();
  if (!row) throw new Error('USER_NOT_FOUND');
  return { plan: row.plan, usage: { projectsUsed: row.projects_used,
    projectsLimit: row.plan === 'business' ? null : TRIAL_PROJECT_LIMIT } };
}

// Candidate selection and manual protection run inside one UPDATE statement.
// A later manual PATCH wins even if generation started with an older title.
export function autoTitleStatement(env: Env, userId: string, projectId: string, title: string) {
  return env.DB.prepare(`UPDATE projects SET title = (
    WITH RECURSIVE numbers(n) AS (
      SELECT 1 UNION ALL SELECT n + 1 FROM numbers
      WHERE n <= (SELECT COUNT(*) + 1 FROM projects WHERE user_id = ?1)
    ), candidates AS (
      SELECT n, CASE WHEN n = 1 THEN ?3 ELSE ?3 || ' ' || n END AS candidate FROM numbers
    )
    SELECT candidate FROM candidates WHERE NOT EXISTS (
      SELECT 1 FROM projects other WHERE other.user_id = ?1 AND other.id <> ?2
        AND other.title = candidates.candidate COLLATE NOCASE
    ) ORDER BY n LIMIT 1
  ), title_source = 'auto', updated_at = CURRENT_TIMESTAMP
  WHERE id = ?2 AND user_id = ?1 AND title_source <> 'manual' AND status = 'processing'`)
    .bind(userId, projectId, title);
}
