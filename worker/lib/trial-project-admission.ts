/** Inactive trusted-server foundation. Not imported by project create/API.
 * Caller must verify active Trial/manual grants and migration-approved account history.
 * This records only an admission tombstone. Future create must include project INSERT
 * in the SAME transaction; a standalone receipt cannot authorize project creation/AI.
 * A replay (including a deleted-project tombstone) must NOT reinsert a project or rerun AI.
 * Existing Business/admin routes remain unchanged. No send ledger or quota reset here.
 */
export interface TrialAdmissionStatement {
  bind(...values: (string | number | null)[]): TrialAdmissionStatement;
  all(): Promise<{ results: unknown[] }>;
}

/** Inactive atomic create; trusted caller must first establish Trial eligibility.
 * Fixed project columns match routes/projects.ts; defaults remain schema-owned.
 * Completion tombstones distinguish a deleted project from an unfinished admission.
 * No outcome authorizes AI/dispatch, including a newly created project.
 */
export type TrialProjectCreate = Omit<TrialProjectAdmission, 'requestIdentity'> & { description: string | null };
export type TrialProjectCreateResult = {
  status: 'created' | 'replayed' | 'deleted' | 'blocked' | 'conflict' | 'not_configured' | 'uncertain';
  project?: { id: string; title: string; description: string | null; status: string };
  cannotDispatch: true;
};
const READ_CREATED = `SELECT a.project_id,a.request_identity,p.id,p.title,p.description,p.status
 FROM trial_project_admissions a JOIN trial_project_completions c
 ON c.user_id=a.user_id AND c.idempotency_key=a.idempotency_key
 LEFT JOIN projects p ON p.id=a.project_id AND p.user_id=a.user_id
 WHERE a.user_id=?1 AND a.idempotency_key=?2`;
export async function createTrialProject(port: TrialAdmissionPort, command: TrialProjectCreate): Promise<TrialProjectCreateResult> {
  const out=(status: TrialProjectCreateResult['status']): TrialProjectCreateResult=>({status,cannotDispatch:true});
  if(!command || typeof command!=='object' || Array.isArray(command) ||
    Object.values(Object.getOwnPropertyDescriptors(command)).some(p=>!('value' in p))) return out('conflict');
  const input={...command};
  if(!text(input.ownerId)||!text(input.projectId)||typeof input.key!=='string'||
    !/^[A-Za-z0-9_-]{16,128}$/.test(input.key)||!Number.isSafeInteger(input.now)||
    !Number.isFinite(new Date(input.now).getTime())||
    (input.description!==null && typeof input.description!=='string')) return out('conflict');
  const description=input.description?.trim() || null;
  // Same temporary title as TEMPORARY_PROJECT_TITLE in project-management.ts.
  const title='Neues Projekt';
  const identity=JSON.stringify({title,description});
  const decode=(rows: unknown[]): TrialProjectCreateResult | null=>{
    if(!Array.isArray(rows)||rows.length>1) return out('uncertain');
    if(!rows.length) return null;
    const row=rows[0] as Record<string,unknown>;
    if(!row||typeof row!=='object'||row.project_id!==input.projectId||row.request_identity!==identity) return out('conflict');
    if(row.id===null) return out('deleted'); // Also conceals a foreign-owner replacement.
    if(row.id!==input.projectId||typeof row.title!=='string'||typeof row.status!=='string'||
      (row.description!==null&&typeof row.description!=='string')) return out('uncertain');
    return {status:'replayed',project:{id:row.id,title:row.title,description:row.description as string|null,status:row.status},cannotDispatch:true};
  };
  const read=async()=>decode((await port.withSession('first-primary').prepare(READ_CREATED).bind(input.ownerId,input.key).all()).results);
  try {
    const prior=await read(); if(prior) return prior;
    const s=port.withSession('first-primary');
    const batch=await s.batch([
      s.prepare(`INSERT INTO trial_project_admissions(user_id,idempotency_key,project_id,request_identity,created_at_ms,creation_mode)
        VALUES(?1,?2,?3,?4,?5,'atomic') ON CONFLICT(user_id,idempotency_key) DO NOTHING`)
        .bind(input.ownerId,input.key,input.projectId,identity,input.now),
      s.prepare(`INSERT INTO projects(id,user_id,title,description)
        SELECT ?3,?1,?4,?5 FROM trial_project_admissions a
        WHERE a.user_id=?1 AND a.idempotency_key=?2 AND a.project_id=?3 AND a.creation_mode='atomic'
        AND NOT EXISTS(SELECT 1 FROM trial_project_completions c WHERE c.user_id=?1 AND c.idempotency_key=?2)`)
        .bind(input.ownerId,input.key,input.projectId,title,description),
      s.prepare(`INSERT INTO trial_project_completions(user_id,idempotency_key) VALUES(?1,?2)
        ON CONFLICT(user_id,idempotency_key) DO NOTHING`).bind(input.ownerId,input.key),
      s.prepare(READ_CREATED).bind(input.ownerId,input.key),
    ]);
    if(batch.length!==4||batch.some(r=>r.success!==true)) return out('uncertain');
    const receipt=decode(batch[3].results);
    if(!receipt) return out('uncertain');
    return receipt.status==='replayed'&&batch[1].meta?.changes===1 ? {...receipt,status:'created'} : receipt;
  } catch(error) {
    try {const recovered=await read(); if(recovered) return recovered;} catch {return out('uncertain');}
    const message=error instanceof Error?error.message:'';
    if(message.includes('TRIAL_LIFETIME_PROJECT_LIMIT')) return out('blocked');
    if(message.includes('TRIAL_PROJECT_HISTORY_REQUIRED')) return out('not_configured');
    return out(/constraint|TRIAL_PROJECT_/i.test(message)?'conflict':'uncertain');
  }
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
