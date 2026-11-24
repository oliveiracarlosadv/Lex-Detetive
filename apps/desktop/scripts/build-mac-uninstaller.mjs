// Compila o desinstalador AppleScript em um .app (somente no macOS).
import { execFileSync } from 'child_process';
import { cpSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build', 'mac', 'Desinstalar Lex Detetive.app');
rmSync(out, { recursive: true, force: true });
execFileSync('osacompile', ['-o', out, join(root, 'uninstaller', 'mac-uninstall.applescript')]);
const icns = join(root, 'build', 'icon.icns');
if (existsSync(icns)) cpSync(icns, join(out, 'Contents', 'Resources', 'applet.icns'));
console.log('Desinstalador macOS criado:', out);
