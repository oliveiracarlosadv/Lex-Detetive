/**
 * Lex Detetive — aplicativo desktop (Electron).
 * Mostra a splash screen, inicia o servidor local (NestJS) com o Node embutido do
 * Electron e abre a interface. Inclui backup, restauração, atualização via arquivo
 * e desinstalação.
 */
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const JSZip = require('jszip');

const DATA_DIR = process.env.LEX_DATA_DIR || path.join(os.homedir(), '.lex-detetive');

// Máquina modesta (até 6 GB de RAM ou até 4 núcleos, ex.: 4 GB + Intel i3): modo econômico.
const LOW_END = os.totalmem() <= 6 * 1024 ** 3 || os.cpus().length <= 4;
if (LOW_END) {
  app.commandLine.appendSwitch('enable-low-end-device-mode'); // Chromium: menos cache e memória por aba
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256'); // teto de memória da interface
  app.commandLine.appendSwitch('renderer-process-limit', '1');
}
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const API_DIR = app.isPackaged ? path.join(process.resourcesPath, 'api') : path.join(__dirname, '..', 'api');
const PREFERRED_PORT = 3333; // porta fixa: o redirecionamento OAuth do Gmail depende dela

let splash = null;
let userClosedWindow = false; // fechada pelo usuário: a vigia de abertura não reabre
let win = null;
let server = null;
let port = PREFERRED_PORT;
let quitting = false;

// Vídeo integrado (Intel HD/UHD) ligado: rolagem e telas ficam lisas sem ocupar o
// processador (essencial em i3). Se a placa de vídeo falhar, o app grava um aviso e
// passa a abrir sem ela automaticamente. Forçar: LEX_GPU=0 (desliga) ou LEX_GPU=1 (liga).
const GPU_OFF_FLAG = path.join(DATA_DIR, 'sem-aceleracao-video');
const gpuOff = process.env.LEX_GPU === '0' || (process.env.LEX_GPU !== '1' && fs.existsSync(GPU_OFF_FLAG));
if (gpuOff) app.disableHardwareAcceleration();
app.on('child-process-gone', (_e, d) => {
  if (d.type === 'GPU' && !gpuOff && ['crashed', 'launch-failed', 'abnormal-exit'].includes(d.reason)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(GPU_OFF_FLAG, `${new Date().toISOString()} ${d.reason}\n`); } catch {}
  }
});
// Menos trabalho em segundo plano no navegador embutido.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,DialMediaRouteProvider,AutofillServerCommunication,OptimizationHints');

// Windows: identificação necessária para as notificações de novas movimentações.
if (process.platform === 'win32') app.setAppUserModelId('com.lextecnologias.lexdetetive');
// Uma instância por vez. Se a anterior ainda está FECHANDO, espera até 8 s ela terminar
// (antes, a nova desistia e a antiga fechava: o usuário ficava sem nada aberto).
// Se a anterior está aberta de verdade, ela recebe "second-instance", mostra a janela, e esta encerra.
const lockReady = new Promise((resolve) => {
  if (app.requestSingleInstanceLock()) return resolve(true);
  const started = Date.now();
  const retry = setInterval(() => {
    if (app.requestSingleInstanceLock()) { clearInterval(retry); resolve(true); }
    else if (Date.now() - started > 8000) { clearInterval(retry); resolve(false); }
  }, 400);
});
/** Clique no Dock ou nova abertura do app: mostra a janela (restaurando/exibindo se preciso) ou cria outra. */
function showMain() {
  userClosedWindow = false;
  if (!server) return; // ainda iniciando: a janela aparece sozinha ao terminar
  if (!win || win.isDestroyed()) return createMain();
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}
app.on('second-instance', () => showMain());

for (const d of [DATA_DIR, BACKUP_DIR, LOG_DIR]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });

// ---------------------------------------------------------------- servidor
function portFree(p) {
  return new Promise((resolve) => {
    const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
    s.listen(p, '127.0.0.1');
  });
}

async function pickPort() {
  for (let p = PREFERRED_PORT; p < PREFERRED_PORT + 20; p++) if (await portFree(p)) return p;
  throw new Error('Nenhuma porta livre entre 3333 e 3352.');
}

function startServer() {
  return new Promise(async (resolve, reject) => {
    port = await pickPort().catch(reject);
    if (!port) return;
    const log = fs.createWriteStream(path.join(LOG_DIR, 'servidor.log'), { flags: 'a' });
    log.write(`\n===== ${new Date().toISOString()} · versão ${app.getVersion()} · porta ${port}\n`);
    // Limite de memória do servidor: suficiente para relatórios grandes e leve para máquinas de 4 GB.
    server = spawn(process.execPath, [`--max-old-space-size=${LOW_END ? 256 : 384}`, '--max-semi-space-size=2', path.join(API_DIR, 'dist', 'main.js')], {
      cwd: API_DIR,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', UV_THREADPOOL_SIZE: String(Math.min(4, Math.max(2, os.cpus().length))), NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1', LEX_DATA_DIR: DATA_DIR, LEX_VERSION: app.getVersion() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Servidor em prioridade baixa: as buscas e o monitoramento cedem o processador à tela.
    try { os.setPriority(server.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* sem permissão */ }
    server.stdout.pipe(log);
    server.stderr.pipe(log);
    server.once('exit', (code) => {
      server = null;
      if (!quitting) dialog.showErrorBox('Lex Detetive', `O serviço local foi encerrado (código ${code}). Veja ${path.join(LOG_DIR, 'servidor.log')}.`);
    });
    const started = Date.now();
    const poll = async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (r.ok) return resolve(port);
      } catch { /* ainda iniciando */ }
      if (Date.now() - started > 90_000) return reject(new Error('O serviço local não respondeu em 90 segundos.'));
      setTimeout(poll, 400);
    };
    poll();
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    const s = server;
    quitting = true;
    const t = setTimeout(() => { try { s.kill('SIGKILL'); } catch {} resolve(); }, 8000);
    s.once('exit', () => { clearTimeout(t); resolve(); });
    s.kill('SIGTERM');
  });
}

async function restartServer() {
  await stopServer();
  quitting = false;
  await startServer();
  if (win) win.loadURL(`http://127.0.0.1:${port}/`);
}

// ---------------------------------------------------------------- janelas
function createSplash() {
  splash = new BrowserWindow({
    // Opaca (sem transparência): mais leve para a placa de vídeo e sempre desenhada.
    width: 460, height: 320, frame: false, resizable: false, center: true, show: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#0B1F3A', webPreferences: { sandbox: true, spellcheck: false, backgroundThrottling: true },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'), { query: { v: app.getVersion() } });
  // Nunca fica presa: some sozinha depois de 45 s.
  setTimeout(closeSplash, 45_000);
}

function closeSplash() { if (splash && !splash.isDestroyed()) splash.close(); splash = null; }

const setStatus = (text) => splash && !splash.isDestroyed() && splash.webContents.executeJavaScript(`setStatus(${JSON.stringify(text)})`).catch(() => {});

function isLocal(url) {
  try { const u = new URL(url); return ['127.0.0.1', 'localhost'].includes(u.hostname) && Number(u.port) === port; } catch { return false; }
}

function createMain() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 980, minHeight: 640, show: false, title: 'Lex Detetive',
    backgroundColor: '#F4F6F8', icon: path.join(__dirname, 'assets', 'logo-mark.svg'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true, backgroundThrottling: true, v8CacheOptions: 'bypassHeatCheck' },
  });
  win.webContents.session.setSpellCheckerLanguages(['pt-BR']);
  // Links externos (BNMP, WhatsApp, Google OAuth, publicações) abrem no navegador padrão.
  win.webContents.setWindowOpenHandler(({ url }) => { if (!isLocal(url)) shell.openExternal(url); return { action: isLocal(url) ? 'allow' : 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isLocal(url)) { e.preventDefault(); shell.openExternal(url); } });
  // A janela é exibida no primeiro destes eventos: pronta para mostrar, página carregada ou 4 s.
  // (Se o app for aberto em segundo plano, o macOS pode nunca disparar "ready-to-show".)
  let shown = false;
  const reveal = () => {
    if (shown || !win || win.isDestroyed()) return;
    shown = true;
    closeSplash();
    win.show();
    win.focus();
  };
  win.once('ready-to-show', reveal);
  win.webContents.once('did-finish-load', reveal);
  setTimeout(reveal, 4000);
  // Servidor ainda subindo ou falha momentânea: tenta carregar de novo (até 15 vezes).
  let retries = 0;
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || !win || win.isDestroyed() || retries >= 15) return;
    retries++;
    setTimeout(() => { if (win && !win.isDestroyed()) win.loadURL(`http://127.0.0.1:${port}/`); }, 1000);
  });
  // Tela travada ou processo de exibição encerrado: recarrega em vez de deixar a janela em branco.
  win.webContents.on('render-process-gone', () => { if (win && !win.isDestroyed()) win.reload(); });
  win.on('unresponsive', () => { if (win && !win.isDestroyed()) win.webContents.reload(); });
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.on('closed', () => { win = null; if (!quitting) userClosedWindow = true; });
}

// ---------------------------------------------------------------- backup / restauração
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

/** Backup completo com o servidor parado (cópia consistente do SQLite + WAL + chave). */
async function backupFiles(reason) {
  const zip = new JSZip();
  for (const f of ['lex.db', 'lex.db-wal', 'lex.db-shm', 'master.key']) {
    const p = path.join(DATA_DIR, f);
    if (fs.existsSync(p)) zip.file(f, fs.readFileSync(p));
  }
  zip.file('backup.json', JSON.stringify({ app: 'Lex Detetive', version: app.getVersion(), createdAt: new Date(), reason }, null, 2));
  const file = path.join(BACKUP_DIR, `lex-detetive-backup-${stamp()}-${reason}.zip`);
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), { mode: 0o600 });
  return file;
}

async function backupNow(reason = 'manual') {
  await stopServer();
  try { return await backupFiles(reason); } finally { quitting = false; await startServer(); if (win) win.reload(); }
}

async function restoreBackup() {
  const r = await dialog.showOpenDialog(win, { title: 'Restaurar backup do Lex Detetive', defaultPath: BACKUP_DIR, filters: [{ name: 'Backup Lex Detetive', extensions: ['zip'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, message: 'Cancelado.' };
  const zip = await JSZip.loadAsync(fs.readFileSync(r.filePaths[0]));
  if (!zip.file('lex.db')) return { ok: false, message: 'Arquivo não é um backup válido do Lex Detetive.' };
  const c = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Restaurar'], defaultId: 0, cancelId: 0, title: 'Restaurar backup',
    message: 'Os dados atuais serão substituídos pelos do backup.', detail: 'Uma cópia dos dados atuais será guardada antes, por segurança.' });
  if (c.response !== 1) return { ok: false, message: 'Cancelado.' };
  await stopServer();
  try {
    await backupFiles('antes-da-restauracao');
    for (const f of ['lex.db', 'lex.db-wal', 'lex.db-shm']) fs.rmSync(path.join(DATA_DIR, f), { force: true });
    for (const f of ['lex.db', 'lex.db-wal', 'lex.db-shm', 'master.key']) {
      const entry = zip.file(f);
      if (entry) fs.writeFileSync(path.join(DATA_DIR, f), await entry.async('nodebuffer'), { mode: 0o600 });
    }
  } finally { quitting = false; await startServer(); if (win) win.loadURL(`http://127.0.0.1:${port}/`); }
  return { ok: true, message: 'Backup restaurado.' };
}

// ---------------------------------------------------------------- atualização via arquivo
async function updateFromFile() {
  const filters = process.platform === 'win32' ? [{ name: 'Instalador do Lex Detetive', extensions: ['exe'] }]
    : process.platform === 'darwin' ? [{ name: 'Instalador do Lex Detetive', extensions: ['pkg', 'dmg'] }]
    : [{ name: 'Instalador do Lex Detetive', extensions: ['AppImage', 'deb'] }];
  const r = await dialog.showOpenDialog(win, { title: 'Selecione o instalador da nova versão', filters, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, message: 'Atualização cancelada.' };
  const file = r.filePaths[0];
  if (!/lex[-_ ]?detetive/i.test(path.basename(file))) {
    const w = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Continuar mesmo assim'], defaultId: 0, cancelId: 0,
      message: 'O arquivo escolhido não parece ser um instalador do Lex Detetive.', detail: path.basename(file) });
    if (w.response !== 1) return { ok: false, message: 'Atualização cancelada.' };
  }
  const c = await dialog.showMessageBox(win, { type: 'info', buttons: ['Cancelar', 'Fazer backup e atualizar'], defaultId: 1, cancelId: 0, title: 'Atualizar Lex Detetive',
    message: 'Antes de atualizar, será feito um backup completo dos seus dados.',
    detail: `Versão atual: ${app.getVersion()}\nInstalador: ${path.basename(file)}\n\nO Lex Detetive será fechado e o instalador será aberto.` });
  if (c.response !== 1) return { ok: false, message: 'Atualização cancelada.' };
  await stopServer();
  const backup = await backupFiles('atualizacao');
  if (process.platform === 'linux' && file.endsWith('.AppImage')) fs.chmodSync(file, 0o755);
  const err = await shell.openPath(file);
  if (err) { quitting = false; await startServer(); return { ok: false, message: `Não foi possível abrir o instalador: ${err}` }; }
  dialog.showMessageBoxSync({ type: 'info', message: 'Backup concluído. O instalador foi aberto.', detail: `Backup salvo em:\n${backup}` });
  app.quit();
  return { ok: true, message: 'Instalador aberto.' };
}

// ---------------------------------------------------------------- desinstalação
async function uninstall() {
  if (process.platform === 'win32') {
    const exe = fs.readdirSync(path.dirname(process.execPath)).find((f) => /^Uninstall.*\.exe$/i.test(f));
    if (!exe) return { ok: false, message: 'Desinstalador não encontrado. Use "Adicionar ou remover programas".' };
    shell.openPath(path.join(path.dirname(process.execPath), exe));
    app.quit();
    return { ok: true, message: '' };
  }
  if (process.platform === 'darwin') {
    const src = path.join(process.resourcesPath, 'Desinstalar Lex Detetive.app');
    if (!fs.existsSync(src)) return { ok: false, message: 'Desinstalador não encontrado.' };
    // Copia para uma pasta temporária: ele precisa apagar o próprio app.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lex-uninstall-'));
    fs.cpSync(src, path.join(tmp, 'Desinstalar Lex Detetive.app'), { recursive: true });
    spawn('open', [path.join(tmp, 'Desinstalar Lex Detetive.app')], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
    return { ok: true, message: '' };
  }
  return { ok: false, message: 'No Linux, remova pelo gerenciador de pacotes (sudo apt remove lex-detetive-desktop) e apague ~/.lex-detetive se quiser remover os dados.' };
}

// ---------------------------------------------------------------- IPC e menu
ipcMain.on('lex:version', (e) => { e.returnValue = app.getVersion(); });
ipcMain.handle('lex:update-from-file', () => updateFromFile());
ipcMain.handle('lex:backup', async () => ({ ok: true, message: `Backup salvo em ${await backupNow('manual')}` }));
ipcMain.handle('lex:restore', () => restoreBackup());
ipcMain.handle('lex:open-data', () => shell.openPath(DATA_DIR));
ipcMain.handle('lex:uninstall', () => uninstall());

const notify = (r) => r && r.message && dialog.showMessageBox(win, { type: r.ok ? 'info' : 'warning', message: r.message });

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const lexMenu = [
    { label: 'Sobre o Lex Detetive', click: () => dialog.showMessageBox(win, { title: 'Lex Detetive', message: `Lex Detetive ${app.getVersion()}`, detail: 'Monitoramento jurídico e investigação processual.\n© Lex Tecnologias\n\nDados locais em ' + DATA_DIR }) },
    { type: 'separator' },
    { label: 'Atualizar via arquivo…', click: async () => notify(await updateFromFile()) },
    { label: 'Fazer backup agora', click: async () => notify({ ok: true, message: `Backup salvo em ${await backupNow('manual')}` }) },
    { label: 'Restaurar backup…', click: async () => notify(await restoreBackup()) },
    { label: 'Abrir pasta de dados', click: () => shell.openPath(DATA_DIR) },
    { label: 'Abrir registro do servidor', click: () => shell.openPath(path.join(LOG_DIR, 'servidor.log')) },
    { type: 'separator' },
    { label: 'Desinstalar Lex Detetive…', click: async () => notify(await uninstall()) },
    { type: 'separator' },
    isMac ? { role: 'quit', label: 'Sair do Lex Detetive' } : { role: 'quit', label: 'Sair' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: isMac ? 'Lex Detetive' : 'Arquivo', submenu: lexMenu },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }] },
    { label: 'Exibir', submenu: [{ role: 'reload', label: 'Recarregar' }, { role: 'resetZoom', label: 'Tamanho real' }, { role: 'zoomIn', label: 'Aumentar' }, { role: 'zoomOut', label: 'Diminuir' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Tela cheia' }, ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }])] },
    { label: 'Janela', submenu: [{ label: 'Mostrar Lex Detetive', accelerator: 'CmdOrCtrl+0', click: () => showMain() }, { type: 'separator' }, { role: 'minimize', label: 'Minimizar' }, { role: 'zoom', label: 'Zoom' }, ...(isMac ? [{ role: 'front', label: 'Trazer tudo para a frente' }] : [{ role: 'close', label: 'Fechar' }])] },
  ]));
}

// ---------------------------------------------------------------- ciclo de vida
app.whenReady().then(async () => {
  if (!(await lockReady)) return app.exit(0);
  app.setName('Lex Detetive');
  buildMenu();
  createSplash();
  try {
    setStatus('Verificando dados locais…');
    await new Promise((r) => setTimeout(r, 300));
    setStatus('Iniciando serviços…');
    await startServer();
    setStatus('Abrindo o Lex Detetive…');
    createMain();
    // Vigia de abertura: no primeiro minuto, se não houver janela visível, mostra/recria.
    const startedAt = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - startedAt > 60_000) return clearInterval(watchdog);
      if (userClosedWindow) return clearInterval(watchdog);
      if (!win || win.isDestroyed() || (!win.isVisible() && !win.isMinimized())) showMain();
    }, 5000);
  } catch (e) {
    if (splash && !splash.isDestroyed()) splash.close();
    dialog.showErrorBox('Lex Detetive', `Não foi possível iniciar: ${e.message}\n\nRegistro: ${path.join(LOG_DIR, 'servidor.log')}`);
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => showMain());
app.on('before-quit', () => { quitting = true; try { app.releaseSingleInstanceLock(); } catch {} if (server) { try { server.kill('SIGTERM'); } catch {} } });
