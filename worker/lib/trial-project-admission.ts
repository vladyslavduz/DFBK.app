/** Inactive trusted-server foundation. Not imported by project create/API.
 * Caller must verify active Trial/manual grants and migration-approved account history.
 * This records only an admission tombstone. Future create must include project INSERT
 * in the SAME transaction; a standalone receipt cannot authorize project creation/AI.
 * A replay (including a deleted-project tombstone) must NOT reinsert a project or rerun AI.
 * Existing Business/admin routes remain unchanged. No send ledger or quota reset here.
 */
export interface TrialAdmissionStatement {
  bind(...values: (string | number)[]): TrialAdmissionStatement;
  all(): Promise<{ results: unknown[] }>;
}
export interface TrialAdmissionSession {
  prepare(sql: string): TrialAdmissionStatement;
  batch(statements: TrialAdmissionStatement[]): Promise<{ success: boolean; results: unknown[]; meta?: { changes?: number } }[]>;
}
export interface TrialAdmissionPort { withSession(mode: 'first-primary'): TrialAdmissionSession }
export type TrialProjectAdmission = { ownerId: string; key: string; projectId: string; requestIdentity: string; now: number };
export type TrialProjectAdmissionResult = {
  status: 'admitted' | 'replayed' | 'blocked' | 'conflict' | 'not_configured' | 'uncertain';
  cannotCreateProject: true; cannotDispatch: true;
};
const result = (status: TrialProjectAdmissionResult['status']): TrialProjectAdmissionResult => ({ status, cannotCreateProject: true, cannotDispatch: true });
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && !/[\u0000-\u001f\u007f]/u.test(v);
const READ = 'SELECT project_id,request_identity FROM trial_project_admissions WHERE user_id=?1 AND idempotency_key=?2';
const INSERT = `INSERT INTO trial_project_admissions(user_id,idempotency_key,project_id,request_identity,created_at_ms)
  VALUES(?1,?2,?3,?4,?5) ON CONFLICT(user_id,idempotency_key) DO NOTHING`;
function matches(rows: unknown[], input: TrialProjectAdmission): 'replayed' | 'conflict' | 'absent' {
  if (!Array.isArray(rows) || rows.length>1) return 'conflict';
  if (rows.length===0) return 'absent';
  const r=rows[0];
  return !!r && typeof r==='object' && !Array.isArray(r) &&
    Object.getOwnPropertyDescriptor(r,'project_id')?.value===input.projectId &&
    Object.getOwnPropertyDescriptor(r,'request_identity')?.value===input.requestIdentity ? 'replayed' : 'conflict';
}
export async function recordTrialProjectAdmission(port: TrialAdmissionPort, command: TrialProjectAdmission): Promise<TrialProjectAdmissionResult> {
  if (!command || typeof command!=='object' || Array.isArray(command) ||
      Object.values(Object.getOwnPropertyDescriptors(command)).some(p=>!('value' in p))) return result('conflict');
  const input={...command}; // Freeze caller-supplied primitive identity before any await.
  if (!text(input.ownerId)||!text(input.projectId)||!text(input.requestIdentity)||typeof input.key!=='string'||
      !/^[A-Za-z0-9_-]{16,128}$/.test(input.key)||!Number.isSafeInteger(input.now)||!Number.isFinite(new Date(input.now).getTime())) return result('conflict');
  const read=async()=>{
    const s=port.withSession('first-primary');
    return matches((await s.prepare(READ).bind(input.ownerId,input.key).all()).results,input);
  };
  try {
    const old=await read(); if(old!=='absent') return result(old);
    const s=port.withSession('first-primary');
    const rows=(await s.prepare('SELECT history_status FROM trial_project_admission_scopes WHERE user_id=?1').bind(input.ownerId).all()).results;
    if(!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0]!=='object'||
      Object.getOwnPropertyDescriptor(rows[0],'history_status')?.value!=='verified') return result('not_configured');
    const batch=await s.batch([
      s.prepare(INSERT).bind(input.ownerId,input.key,input.projectId,input.requestIdentity,input.now),
      s.prepare(READ).bind(input.ownerId,input.key),
    ]);
    if(batch.length!==2||batch.some(r=>r.success!==true)||matches(batch[1].results,input)!=='replayed') return result('uncertain');
    return batch[0].meta?.changes===1 ? result('admitted') : result('replayed');
  } catch(error) {
    try { const recovered=await read(); if(recovered!=='absent') return result(recovered); } catch { return result('uncertain'); }
    const message=error instanceof Error?error.message:'';
    if(message.includes('TRIAL_LIFETIME_PROJECT_LIMIT')) return result('blocked');
    if(message.includes('TRIAL_PROJECT_HISTORY_REQUIRED')) return result('not_configured');
    return result(/constraint|TRIAL_PROJECT_/i.test(message)?'conflict':'uncertain');
  }
}
