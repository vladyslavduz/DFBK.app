// Narrow test-only ambient surface used by the scheduler read route.
// Not generated Cloudflare types or a claim that the entire Worker typechecks.
interface Fetcher { fetch(request:Request):Promise<Response>; }
interface R2Bucket {}
interface D1PreparedStatement {
 bind(...values:unknown[]):D1PreparedStatement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
}
interface D1DatabaseSession {
 prepare(sql:string):D1PreparedStatement;
 batch(statements:D1PreparedStatement[]):Promise<unknown>;
}
interface D1Database extends D1DatabaseSession { withSession(mode:'first-primary'):D1DatabaseSession; }
