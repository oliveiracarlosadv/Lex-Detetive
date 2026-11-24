// O electron-builder descarta pastas node_modules em extraResources; copiamos as
// dependências do servidor depois do empacotamento (antes de gerar .pkg/.dmg/.exe).
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const resources = electronPlatformName === 'darwin'
    ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(appOutDir, 'resources');
  const src = path.join(__dirname, '..', 'staging', 'api', 'node_modules');
  const dest = path.join(resources, 'api', 'node_modules');
  // Sem .bin (atalhos de linha de comando, inúteis em execução e quebram o empacotamento no Windows).
  fs.cpSync(src, dest, { recursive: true, dereference: true, filter: (p) => path.basename(p) !== '.bin' });
  console.log(`  • dependências do servidor copiadas  → ${dest}`);
};
