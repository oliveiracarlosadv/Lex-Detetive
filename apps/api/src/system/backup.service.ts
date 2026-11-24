import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join, basename } from 'path';
import { DATA_DIR } from '../config';
import { PrismaService } from '../prisma.service';

export const BACKUP_DIR = join(DATA_DIR, 'backups');

/**
 * Backup completo dos dados locais: cópia consistente do banco (VACUUM INTO)
 * + chave mestra (sem ela os dados criptografados não podem ser lidos).
 */
@Injectable()
export class BackupService {
  constructor(private prisma: PrismaService) {}

  async create(reason = 'manual') {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tmpDb = join(BACKUP_DIR, `.tmp-${stamp}.db`);
    await this.prisma.$executeRawUnsafe(`VACUUM INTO '${tmpDb.replace(/'/g, "''")}'`);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('lex.db', readFileSync(tmpDb));
    const key = join(DATA_DIR, 'master.key');
    if (existsSync(key)) zip.file('master.key', readFileSync(key));
    zip.file('backup.json', JSON.stringify({ app: 'Lex Detetive', version: process.env.LEX_VERSION || '0.1.2', createdAt: new Date(), reason }, null, 2));
    const file = join(BACKUP_DIR, `lex-detetive-backup-${stamp}-${reason}.zip`);
    const { writeFileSync } = await import('fs');
    writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), { mode: 0o600 });
    rmSync(tmpDb, { force: true });
    this.prune();
    return this.info(file);
  }

  /** Mantém os 20 backups mais recentes. */
  private prune() {
    const files = this.list();
    for (const f of files.slice(20)) rmSync(join(BACKUP_DIR, f.name), { force: true });
  }

  private info(file: string) {
    const st = statSync(file);
    return { name: basename(file), size: st.size, createdAt: st.mtime };
  }

  list() {
    if (!existsSync(BACKUP_DIR)) return [];
    return readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.zip')).map((f) => this.info(join(BACKUP_DIR, f)))
      .sort((a, b) => +b.createdAt - +a.createdAt);
  }

  path(name: string) {
    const safe = basename(name);
    const file = join(BACKUP_DIR, safe);
    if (!safe.endsWith('.zip') || !existsSync(file)) throw new NotFoundException('Backup não encontrado.');
    return file;
  }
}
