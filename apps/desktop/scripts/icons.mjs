// Gera build/icon.png (1024) e build/icon.icns a partir do logotipo (macOS: qlmanage, sips, iconutil).
import { execFileSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, '..', '..', 'brand', 'logo-mark.svg');
const tmp = mkdtempSync(join(tmpdir(), 'lex-icons-'));
execFileSync('qlmanage', ['-t', '-s', '1024', '-o', tmp, svg], { stdio: 'ignore' });
const png = join(tmp, 'logo-mark.svg.png');
cpSync(png, join(root, 'build', 'icon.png'));
const set = join(tmp, 'icon.iconset');
mkdirSync(set);
for (const s of [16, 32, 64, 128, 256, 512]) {
  execFileSync('sips', ['-z', String(s), String(s), png, '--out', join(set, `icon_${s}x${s}.png`)], { stdio: 'ignore' });
  execFileSync('sips', ['-z', String(s * 2), String(s * 2), png, '--out', join(set, `icon_${s}x${s}@2x.png`)], { stdio: 'ignore' });
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', join(root, 'build', 'icon.icns')]);
rmSync(tmp, { recursive: true, force: true });
console.log('Ícones gerados em build/');
