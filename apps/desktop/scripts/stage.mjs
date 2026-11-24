// Prepara o servidor (API + interface) para ser empacotado no app desktop.
// Uso: node scripts/stage.mjs [mac|win|linux]
import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const target = process.argv[2] || { darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform];
const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, '..');
const repo = join(desktop, '..', '..');
const api = join(repo, 'apps', 'api');

console.log('1/4 Compilando interface e servidor…');
execSync('npm run build', { cwd: repo, stdio: 'inherit' });
if (!existsSync(join(api, 'public', 'index.html'))) throw new Error('Interface não encontrada em apps/api/public.');

console.log('2/4 Copiando arquivos…');
const tmp = mkdtempSync(join(tmpdir(), 'lex-stage-'));
for (const p of ['dist', 'public', 'assets', 'prisma/migrations', 'prisma/schema.prisma']) cpSync(join(api, p), join(tmp, p), { recursive: true });
const pkg = JSON.parse(readFileSync(join(api, 'package.json'), 'utf8'));
writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'lex-detetive-server', version: pkg.version, private: true, dependencies: pkg.dependencies }, null, 2));

console.log('3/4 Instalando dependências de produção…');
execSync('npm install --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error', { cwd: tmp, stdio: 'inherit' });
// Cliente Prisma já gerado (com motores para todos os sistemas) — mantemos só o do alvo.
const gen = join(repo, 'node_modules', '.prisma', 'client');
cpSync(gen, join(tmp, 'node_modules', '.prisma', 'client'), { recursive: true });
const keep = { mac: /darwin/, win: /windows/, linux: /debian|linux/ }[target];
for (const f of readdirSync(join(tmp, 'node_modules', '.prisma', 'client'))) {
  if (/query_engine|libquery_engine/.test(f) && !keep.test(f)) rmSync(join(tmp, 'node_modules', '.prisma', 'client', f));
}

console.log('    Removendo arquivos de desenvolvimento (fontes, mapas, tipos, testes, documentação)…');
const JUNK_DIRS = new Set(['test', 'tests', '__tests__', 'docs', 'doc', 'example', 'examples', '.github', 'benchmark', 'benchmarks', 'coverage']);
const JUNK_FILE = /(\.map|\.d\.ts|\.d\.mts|\.d\.cts|\.md|\.markdown|\.tsbuildinfo)$|^(CHANGELOG|HISTORY|AUTHORS|CONTRIBUTING)(\..*)?$|(?<!\.d)\.ts$/i;
let removed = 0;
const prune = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) {
      if (JUNK_DIRS.has(name.toLowerCase()) || (name === 'src' && existsSync(join(dir, 'dist')))) { removed += du(p); rmSync(p, { recursive: true, force: true }); }
      else prune(p);
    } else if (JUNK_FILE.test(name)) { removed += st.size; rmSync(p); }
  }
};
const du = (p) => { const st = statSync(p); return st.isDirectory() ? readdirSync(p).reduce((a, n) => a + du(join(p, n)), 0) : st.size; };
const nm = join(tmp, 'node_modules');
rmSync(join(nm, '@types'), { recursive: true, force: true });
rmSync(join(nm, 'exceljs', 'dist'), { recursive: true, force: true }); // versões para navegador; o Node usa exceljs/lib
prune(nm);
console.log(`    ${(removed / 1048576).toFixed(0)} MB removidos`);

console.log('4/4 Movendo para apps/desktop/staging/api…');
const dest = join(desktop, 'staging', 'api');
rmSync(join(desktop, 'staging'), { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });
cpSync(tmp, dest, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
console.log(`Pronto para ${target}.`);
