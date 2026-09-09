import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

const storeBundle=await build({entryPoints:['lib/google-sheets-store.ts'],bundle:true,platform:'node',format:'esm',write:false});
const store=await import('data:text/javascript;base64,'+Buffer.from(storeBundle.outputFiles[0].text).toString('base64'));
const engineBundle=await build({entryPoints:['lib/engine.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {fresh}=await import('data:text/javascript;base64,'+Buffer.from(engineBundle.outputFiles[0].text).toString('base64'));

test('normaliza la implementación y crea un enlace compartible sin exponer el PIN',()=>{
 const id='AKfycbx123456789012345678901234567890';
 const endpoint=`https://script.google.com/macros/s/${id}/exec`;
 assert.equal(store.normalizeSheetsEndpoint(id),endpoint);
 assert.equal(store.normalizeSheetsEndpoint(endpoint),endpoint);
 assert.equal(store.deploymentIdFromEndpoint(endpoint),id);
 const url=store.staffShareUrl(endpoint,'https://staff.example/eibar/?foo=1#panel');
 assert.equal(url,`https://staff.example/eibar/?foo=1&sheets=${id}`);
 assert.ok(!url.includes('pin'));
 assert.throws(()=>store.normalizeSheetsEndpoint('https://example.com/datos'));
});

test('el Apps Script valida la temporada completa antes de escribirla',()=>{
 const context=vm.createContext({console,__state:fresh()});
 vm.runInContext(readFileSync('google-apps-script/Code.gs','utf8'),context,{filename:'Code.gs'});
 assert.doesNotThrow(()=>vm.runInContext('validateState_(__state)',context));
 context.__state.matches[0].note='=IMPORTDATA("https://example.com")';
 assert.doesNotThrow(()=>vm.runInContext('validateState_(__state)',context));
 assert.equal(vm.runInContext('safeText_(__state.matches[0].note)',context),'\'=IMPORTDATA("https://example.com")');
 context.__state.matches[0].id='=formula';
 assert.throws(()=>vm.runInContext('validateState_(__state)',context),/Partido no válido/);
 assert.throws(()=>vm.runInContext('validCallback_("x);alert(1)")',context),/Callback no válido/);
});
