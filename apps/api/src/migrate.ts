import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * Migrações SQL versionadas (prisma/migrations/NNNN_nome/migration.sql), aplicadas
 * na inicialização. Não depende da CLI do Prisma, então funciona no app instalado.
 */
export function migrationsDir() {
  const candidates = [join(__dirname, '..', 'prisma', 'migrations'), join(process.cwd(), 'prisma', 'migrations')];
  return candidates.find((d) => existsSync(d));
}

export async function migrate(log: (m: string) => void = console.log) {
  const dir = migrationsDir();
  if (!dir) throw new Error('Pasta de migrações não encontrada.');
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_lex_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" DATETIME DEFAULT CURRENT_TIMESTAMP)');
    let applied = new Set((await prisma.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM "_lex_migrations"')).map((r) => r.name));
    // Banco criado antes do controle de migrações (versões de desenvolvimento): adota a 0001 como base.
    if (!applied.size) {
      const legacy = await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM sqlite_master WHERE type='table' AND name='User'`);
      if (legacy.length) {
        await prisma.$executeRawUnsafe('INSERT INTO "_lex_migrations" ("name") VALUES (?)', '0001_init');
        applied = new Set(['0001_init']);
        log('Banco existente adotado como base (0001_init).');
      }
    }
    const pending = readdirSync(dir).filter((d) => existsSync(join(dir, d, 'migration.sql')) && !applied.has(d)).sort();
    for (const name of pending) {
      const sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
      await prisma.$transaction([
        ...statements.map((s) => prisma.$executeRawUnsafe(s)),
        prisma.$executeRawUnsafe('INSERT INTO "_lex_migrations" ("name") VALUES (?)', name),
      ]);
      log(`Migração aplicada: ${name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  require('./config');
  migrate().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
