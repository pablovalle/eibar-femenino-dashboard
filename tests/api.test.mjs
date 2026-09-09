import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_colorful_rafael_vega.sql','utf8'));
globalThis.__testDB = {
 prepare(sql) {
  return {
   bind(...args) {
    return {
     async first() { return db.prepare(sql).get(...args) || null; },
     async run() { const r = db.prepare(sql).run(...args); return {meta:{changes:Number(r.changes)}}; }
    };
   }
  };
 }
};
const bund=await build({entryPoints:['app/api/state/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-db',setup(b){b.onResolve({filter:/cloudflare:workers/},()=>({path:'cf',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env={DB:globalThis.__testDB}',loader:'js'}))}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(bund.outputFiles[0].text).toString('base64'));
const eb=await build({entryPoints:['lib/engine.ts'],bundle:true,platform:'node',format:'esm',write:false});const {fresh}=await import('data:text/javascript;base64,'+Buffer.from(eb.outputFiles[0].text).toString('base64'));
const req=(s,revision,origin='https://test.example')=>new Request('https://test.example/api/state',{method:'PUT',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({state:s,revision})});
test('guardado persistente, lectura, corrección y conflicto entre sesiones',async()=>{const s=fresh();assert.equal((await(await api.GET()).json()).revision,0);const first=await api.PUT(req(s,0));assert.equal(first.status,200);s.matches[0].hg=3;assert.equal((await api.PUT(req(s,1))).status,200);const loaded=await(await api.GET()).json();assert.equal(loaded.state.matches[0].hg,3);assert.equal(loaded.revision,2);assert.equal((await api.PUT(req(fresh(),1))).status,409);assert.equal((await(await api.GET()).json()).state.matches[0].hg,3)});
test('rechazo de origen externo y marcadores no válidos sin sobrescribir',async()=>{assert.equal((await api.PUT(req(fresh(),2,'https://other.example'))).status,403);const s=fresh();s.matches[0].hg=-1;assert.equal((await api.PUT(req(s,2))).status,400);assert.equal((await(await api.GET()).json()).revision,2)});
