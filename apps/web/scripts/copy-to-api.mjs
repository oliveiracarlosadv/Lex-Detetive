// Copia a interface exportada (out/) para apps/api/public, servida pelo backend.
import { cpSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'out');
const dest = join(here, '..', '..', 'api', 'public');
if (!existsSync(src)) throw new Error('Pasta out/ não encontrada. Rode "next build" antes.');
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Interface copiada para ${dest}`);
