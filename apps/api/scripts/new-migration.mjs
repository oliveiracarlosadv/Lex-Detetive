// Gera uma nova migração SQL comparando o banco de desenvolvimento com o schema.prisma.
// Uso: npm run db:new-migration -w apps/api -- nome_da_mudanca
import { execSync } from 'child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const name = (process.argv[2] || 'alteracao').replace(/\W+/g, '_');
const dir = join(process.cwd(), 'prisma', 'migrations');
const next = String(readdirSync(dir).filter((d) => /^\d{4}_/.test(d)).length + 1).padStart(4, '0');
const url = process.env.DATABASE_URL || `file:${join(process.env.LEX_DATA_DIR || join(homedir(), '.lex-detetive'), 'lex.db')}`;
const sql = execSync(`npx prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --script`, { encoding: 'utf8' });
if (!sql.replace(/--.*$/gm, '').trim()) { console.log('Nenhuma diferença.'); process.exit(0); }
mkdirSync(join(dir, `${next}_${name}`));
writeFileSync(join(dir, `${next}_${name}`, 'migration.sql'), sql);
console.log(`Criada prisma/migrations/${next}_${name}/migration.sql`);
