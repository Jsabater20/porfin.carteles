import assert from 'node:assert/strict';
import {readFile,appendFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('node_modules/axe-core/axe.min.js',root),'utf8');
export async function auditPage(evaluate,label) {
 await evaluate(source+';true');
 const report=await evaluate('(async()=>{const result=await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}});return {url:location.pathname,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:result.incomplete.map(v=>v.id),passes:result.passes.length};})()');
 await mkdir(new URL('.test-build/',root),{recursive:true});
 await appendFile(new URL('.test-build/accessibility.jsonl',root),JSON.stringify({label,...report})+'\n');
 assert.deepEqual(report.violations,[],'Accesibilidad: '+label+' '+JSON.stringify(report.violations));
}
