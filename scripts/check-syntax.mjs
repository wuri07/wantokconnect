// Finds the exact file, line and column that Rollup would choke on. Run: npm run check
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let parseAst = null;
try { ({ parseAst } = await import('rollup/parseAst')); } catch { console.warn('Note: rollup/parseAst not available, skipping the full parse check.'); }

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = ['index.html', ...walk('src'), ...walk('server').filter(f => f.endsWith('.js'))];
let bad = 0;
const fail = (f, msg, line, text) => { bad++; console.error(`\n${f}${line ? ':' + line : ''}\n  ${msg}${text ? '\n  > ' + text.trim().slice(0, 140) : ''}`); };

for (const f of files) {
  const code = readFileSync(f, 'utf8'), lines = code.split('\n');
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) fail(f, 'Markdown code fence left in the file (delete this line)', i + 1, l);
    if (/^(<<<<<<<|>>>>>>>|=======$)/.test(l)) fail(f, 'Git merge conflict marker', i + 1, l);
    const m = l.match(/[\u2018\u2019\u201C\u201D\u00A0\u200B\uFEFF]/);
    if (m) console.warn(`Warning: ${f}:${i + 1} has an unusual character U+${m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} (fine inside text, an error in code)`);
  });
  if (parseAst && /\.m?js$/.test(f)) {
    try { parseAst(code); }
    catch (e) { const { line, column } = e.loc || {}; fail(f, e.message, line, line ? lines[line - 1].slice(Math.max(0, column - 40), column + 60) : ''); }
  }
}
console.log(bad ? `\n${bad} problem(s) found.` : 'No syntax problems found.');
process.exit(bad ? 1 : 0);
