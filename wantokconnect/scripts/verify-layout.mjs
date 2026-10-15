// Runs before every build. Stops with a plain-English message if the Vite entry point is missing,
// which is what causes: Could not resolve entry module "index.html".
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const fail = msg => { console.error(`\nBUILD STOPPED\n${msg}\n\nWorking folder: ${process.cwd()}\nFiles here: ${readdirSync('.').join(', ')}\n`); process.exit(1); };
for (const f of ['index.html', 'src/main.js', 'package.json']) {
  if (!existsSync(f)) fail(`Missing ${f}.\nindex.html, package.json and src/ must sit at the TOP of the repository.\nIf your repository contains a folder (for example "wantokconnect/") that holds them, set Render > Settings > Root Directory to that folder, or move the files up one level.`);
}
if (!/<script[^>]*type=["']module["'][^>]*src=["']\/src\/main\.js["']/.test(readFileSync('index.html', 'utf8')))
  fail('index.html must contain: <script type="module" src="/src/main.js"></script>');

// Every relative import must point at a real file.
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
let bad = 0;
for (const f of walk('src').filter(f => f.endsWith('.js'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(f), m[1] || m[2]);
    if (!existsSync(target)) { bad++; console.error(`${f}: cannot find "${m[1] || m[2]}" (file names are case-sensitive on Render)`); }
  }
}
if (bad) fail(`${bad} broken import path(s) listed above.`);
console.log('Layout OK: entry point and imports found.');
