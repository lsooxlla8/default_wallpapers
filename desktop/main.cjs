const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell, screen, globalShortcut, session} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const core = require('./core.cjs');
const platform = require('./platform.cjs');
const root = path.resolve(__dirname, '..'), art = path.join(root, 'art');
const smoke = process.argv.includes('--smoke-test');
const qaArg = process.argv.indexOf('--smoke-out');
const qa = qaArg >= 0 ? path.resolve(process.argv[qaArg + 1]) : path.join(root, 'qa');
if (smoke) app.setPath('userData', path.join(qa, 'app-data'));
app.setName('default_wallpaper');
let prefs, current, tray, preferencesWindow, controlWindow, timer, busy = false, error = '', status = '', pendingRefresh = false;
const windows = new Set();
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const currentFile = () => path.join(app.getPath('userData'), 'current.json');
const readJSON = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } };
const state = () => ({platform: process.platform, settings: prefs, pictures: app.getPath('pictures'), busy, hasWork: Boolean(current?.works?.length), error, status});
function publish() {
  if(preferencesWindow&&!preferencesWindow.isDestroyed())preferencesWindow.setContentSize(560,292+(prefs.photoSource==='folder'?22:0)+(error?44:0));
  for (const win of windows) if (!win.isDestroyed()) win.webContents.send('changed', state());
  if (tray) tray.setContextMenu(Menu.buildFromTemplate([
    {label: busy ? 'Generating…' : 'Generate', enabled: !busy, click: () => safely(generate())},
    {label: 'Save sketch + PNG', enabled: !busy && Boolean(current?.works?.length), click: () => safely(save())},
    {type: 'separator'}, {label: 'Settings…', click: showSettings},
    {label: 'Open export folder', click: () => safely(openFolder())},
    ...(error ? [{label: error, enabled: false}] : []),
    {type: 'separator'}, {label: 'Quit', click: () => app.quit()}
  ]));
}
function safely(promise) { promise.catch(e => { error = e.message; publish(); }); }
function secureWindow(options) {
  const win = new BrowserWindow({...options, webPreferences: {contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs')}});
  windows.add(win); win.on('closed', () => windows.delete(win));
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', e => e.preventDefault());
  return win;
}
function showSettings() {
  if (!preferencesWindow || preferencesWindow.isDestroyed()) {
    preferencesWindow = secureWindow({width: 560, height: 292, useContentSize: true, resizable: false, title: 'default_wallpaper', backgroundColor: '#050505', autoHideMenuBar: true, icon: path.join(root, 'assets/icon.png')});
    preferencesWindow.removeMenu(); preferencesWindow.loadFile(path.join(__dirname, 'settings.html'));
  } else { preferencesWindow.show(); preferencesWindow.focus(); }
}
function showControls() {
  if (controlWindow && !controlWindow.isDestroyed()) controlWindow.close();
  controlWindow = undefined;
  if (!prefs.desktopButtons) return;
  const d = screen.getPrimaryDisplay();
  controlWindow = secureWindow({width: 72, height: 32, x: d.workArea.x + 16, y: d.workArea.y + d.workArea.height - 48, frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false, focusable: process.platform === 'linux', skipTaskbar: process.platform !== 'linux', show: false, title: 'default_wallpaper — Controls'});
  controlWindow.loadFile(path.join(__dirname, 'controls.html'));
  controlWindow.once('ready-to-show', () => { if (!controlWindow?.isDestroyed()) { if(process.platform==='linux'&&process.env.XDG_SESSION_TYPE==='wayland')controlWindow.show();else controlWindow.showInactive();if(process.platform==='win32'){const handle=controlWindow.getNativeWindowHandle();safely(platform.lowerWindows(handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE()),app.isPackaged?path.join(process.resourcesPath,'set-wallpaper.ps1'):path.join(__dirname,'set-wallpaper.ps1')));} } });
}
function registerShortcut(next) {
  if (next === prefs?.shortcut) return;
  if (next && !globalShortcut.register(next, () => safely(generate()))) throw Error('Shortcut unavailable. Choose another.');
  if (prefs?.shortcut) globalShortcut.unregister(prefs.shortcut);
}
async function update(value) {
  const next = core.settings(value, {documents: app.getPath('documents')});
  if (value.shortcut && !core.validShortcut(value.shortcut)) throw Error('Use Ctrl / Alt / Super + a key');
  if (next.photoSource === 'folder' && !path.isAbsolute(next.photoFolder)) throw Error('Choose a photo folder first');
  registerShortcut(next.shortcut);
  try { await core.atomicJSON(settingsFile(), next); }
  catch (e) { if (next.shortcut) globalShortcut.unregister(next.shortcut); if (prefs.shortcut) globalShortcut.register(prefs.shortcut, () => safely(generate())); throw e; }
  const buttonsChanged = prefs.desktopButtons !== next.desktopButtons;
  prefs = next; error = ''; status = ''; if (buttonsChanged) showControls(); publish(); return state();
}
async function choose(kind) {
  if (!['photo', 'save'].includes(kind)) throw Error('Unknown folder type');
  const result = await dialog.showOpenDialog(preferencesWindow, {title: kind === 'photo' ? 'Photo folder' : 'Export folder', defaultPath: kind === 'photo' ? prefs.photoFolder || app.getPath('pictures') : prefs.saveFolder, properties: ['openDirectory', 'createDirectory']});
  if (!result.canceled && result.filePaths[0]) return update({...prefs, ...(kind === 'photo' ? {photoSource: 'folder', photoFolder: result.filePaths[0]} : {saveFolder: result.filePaths[0]})});
  return state();
}
function installIPC() {
  const actions = {state, settings: update, choose, generate: () => generate().then(state), save: () => save().then(state), 'open-folder': () => openFolder().then(state)};
  for (const [name, action] of Object.entries(actions)) ipcMain.handle(name, async (event, ...args) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const allowed = [pathToFileURL(path.join(__dirname, 'settings.html')).href, pathToFileURL(path.join(__dirname, 'controls.html')).href];
    if (!windows.has(senderWindow) || event.senderFrame !== event.sender.mainFrame || !allowed.includes(event.senderFrame.url)) throw Error('Invalid request source');
    try { return await action(...args); } catch (e) { error = e.message; publish(); throw e; }
  });
}
async function samplePhotos() {
  if (prefs.photoSource === 'none') return [];
  const dir = prefs.photoSource === 'system' ? app.getPath('pictures') : prefs.photoFolder;
  let names;
  try { names = await fs.readdir(dir, {withFileTypes: true}); }
  catch (e) { if (prefs.photoSource === 'system' && e.code === 'ENOENT') return []; throw Error('Cannot read photo folder: ' + e.message); }
  const candidates = names.filter(n => n.isFile() && /\.(png|jpe?g|webp|bmp)$/i.test(n.name));
  const photos = [];
  while (candidates.length && photos.length < 4) {
    const index = crypto.randomInt(candidates.length), file = path.join(dir, candidates.splice(index, 1)[0].name);
    try {
      if ((await fs.stat(file)).size > 32 * 1024 * 1024) continue;
      const image = nativeImage.createFromPath(file); if (image.isEmpty()) continue;
      const size = image.getSize(); if (size.width * size.height > 100000000) continue;
      const resized = image.resize({width: Math.max(1, Math.round(size.width * Math.min(1, 900 / Math.max(size.width, size.height)))), quality: 'good'});
      photos.push({id: 'local-' + crypto.randomUUID(), url: 'data:image/jpeg;base64,' + resized.toJPEG(82).toString('base64')});
    } catch { /* Skip unreadable images, without altering their source. */ }
  }
  return photos;
}
function displays() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, index) => ({id: String(d.id), index, primary: d.id === primary, width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor), physical: process.platform === 'win32' ? screen.dipToScreenRect(null, d.bounds) : d.bounds}));
}
async function renderFrames(targets, base, palette, photos, extra = {}) {
  const win = new BrowserWindow({show: false, width: 480, height: 270, webPreferences: {contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false}});
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'})); win.webContents.on('will-navigate', e => e.preventDefault());
  const render = async () => {
    await win.loadFile(path.join(art, 'index.html'));
    return win.webContents.executeJavaScript(`(async()=>{for(let i=0;i<500&&!window.Art?.isReady;i++)await new Promise(r=>setTimeout(r,20));if(!window.Art?.isReady)throw Error('Engine not ready');await DesktopExperiments.setPhotos(${JSON.stringify(photos)});let palette=${JSON.stringify(palette || null)};const extra=${JSON.stringify(extra)};if(extra.family==='__photo_fixture__')extra.family=DesktopExperiments.catalogue.find(r=>r.source==='photo').id;const out=[];for(const t of ${JSON.stringify(targets)}){Art.resize(t.width,t.height,1);Art.load({seed:t.seed,...extra,recent:[],...(palette?{palette}: {})});Art.setVisible(false);const frame=Art.stillFrame(t.width,t.height),record=Art.metadata();palette=palette||record.palette;out.push({id:t.id,png:frame.png,record,palette});}return out;})()`);
  };
  let timeout;
  try { return await Promise.race([render(), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Renderer timed out')), 120000); })]); }
  finally { clearTimeout(timeout); if (!win.isDestroyed()) win.destroy(); }
}
async function generate({refresh = false} = {}) {
  if (busy) { if (refresh) pendingRefresh = true; return; }
  busy = true; error = ''; status = 'Generating…'; publish();
  try {
    const targets = displays(); if (!targets.length) throw Error('No displays connected');
    const reuse = refresh && current;
    const base = reuse ? current.base : crypto.randomBytes(4).readUInt32LE(0) || 1;
    const photos = reuse ? current.photos || [] : await samplePhotos();
    const keep = reuse ? current.works.filter(w => targets.some(t => t.id === w.id && t.width === w.width && t.height === w.height)).map(w => ({...w, ...targets.find(t => t.id === w.id)})) : [];
    const missing = targets.filter(t => !keep.some(w => w.id === t.id));
    const frames = missing.length ? await renderFrames(missing.map(t => ({...t, seed: core.seedFor(base, t.id)})), base, reuse ? current.palette : null, photos) : [];
    if (frames.length !== missing.length) throw Error('Incomplete display set');
    const directory = path.join(app.getPath('userData'), 'wallpapers'); await fs.mkdir(directory, {recursive: true});
    const works = [...keep];
    for (const frame of frames) {
      const target = missing.find(t => t.id === frame.id);
      const image = nativeImage.createFromDataURL(frame.png), size = image.getSize();
      if (image.isEmpty() || size.width !== target.width || size.height !== target.height) throw Error('Invalid wallpaper dimensions');
      const file = path.join(directory, crypto.randomUUID() + '.png'); await fs.writeFile(file, image.toPNG());
      works.push({...target, path: file, record: frame.record});
    }
    const previous = current;
    current = {base, palette: frames[0]?.palette || current?.palette, works, photos, lastGeneration: reuse ? current.lastGeneration : Date.now()};
    await core.atomicJSON(currentFile(), current);
    let warning = '';
    if (!smoke) {
      if (process.platform === 'win32') await platform.applyWindows(works, app.getPath('userData'), app.isPackaged ? path.join(process.resourcesPath, 'set-wallpaper.ps1') : path.join(__dirname, 'set-wallpaper.ps1'));
      else if (process.platform === 'linux') warning = await platform.applyLinux(works);
    }
    const retaining = new Set([...works, ...(previous?.works || [])].map(w => path.basename(w.path)));
    for (const name of await fs.readdir(directory)) if (/^[\da-f-]{36}\.png$/.test(name) && !retaining.has(name)) await fs.rm(path.join(directory, name));
    status = warning || '';
  } catch (e) { error = e.message; status = ''; throw e; }
  finally { busy = false; publish(); if (pendingRefresh) { pendingRefresh = false; safely(generate({refresh: true})); } }
}
async function save() {
  if (busy || !current?.works?.length) return;
  const work = current.works.find(w => w.primary) || current.works[0];
  const destination = prefs.saveFolder;
  await fs.mkdir(destination, {recursive: true});
  const folder = path.join(destination, 'work-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8));
  await core.exportWork({work, photos: current.photos, folder, art});
  error = ''; status = 'Saved: ' + folder; publish(); return folder;
}
async function openFolder() { await fs.mkdir(prefs.saveFolder, {recursive: true}); const message = await shell.openPath(prefs.saveFolder); if (message) throw Error(message); }
async function smokeTest() {
  let stage = 'initialization';
  const checkpoint = value => { stage = value; console.log('[smoke] ' + value); };
  const watchdog = setTimeout(() => { console.error('Smoke verification timed out at: ' + stage); app.exit(1); }, 180000);
  checkpoint('initial generation');
  await fs.mkdir(qa, {recursive: true});
  await update({...prefs, photoSource: 'none', intervalMinutes: 0, saveFolder: qa});
  await generate(); const folder = await save();
  checkpoint('photo export');
  const photo = {id: 'fixture-photo', url: nativeImage.createFromPath(path.join(root, 'assets/icon.png')).toDataURL()};
  const frames = await renderFrames([{id: 'landscape', width: 640, height: 360, seed: 17}, {id: 'portrait', width: 360, height: 640, seed: 29}], 7, null, [photo], {family: '__photo_fixture__'});
  for (const f of frames) await fs.writeFile(path.join(qa, f.id + '.png'), nativeImage.createFromDataURL(f.png).toPNG());
  const photoFrame = frames[0];
  if (!core.photoIDs(photoFrame.record).has(photo.id)) throw Error('Photo was not retained in recipe');
  const photoPath = path.join(qa, 'photo.png'); await fs.writeFile(photoPath, nativeImage.createFromDataURL(photoFrame.png).toPNG());
  const photoExport = path.join(qa, 'photo-export');
  await core.exportWork({work: {record: photoFrame.record, path: photoPath}, photos: [photo], folder: photoExport, art});
  const exported = new BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    await exported.loadFile(path.join(photoExport, 'index.html'));
    const result = await exported.webContents.executeJavaScript(`(async()=>{for(let i=0;i<500&&!window.Art?.isReady;i++)await new Promise(r=>setTimeout(r,20));Art.setVisible(false);return {metadata:Art.metadata(),png:Art.stillFrame(640,360).png,photos:DesktopExperiments.photos().length};})()`);
    if (result.photos !== 1 || !core.photoIDs(result.metadata).has(photo.id)) throw Error('Photo export did not reload');
    if (result.png !== photoFrame.png) throw Error('Photo export pixels differ from original');
  } finally { exported.destroy(); }
  checkpoint('settings UI and IPC');
  showSettings(); preferencesWindow.setPosition(32,32);
  if (preferencesWindow.webContents.isLoading()) await new Promise(resolve => preferencesWindow.webContents.once('did-finish-load', resolve));
  const settingsViaUI = await preferencesWindow.webContents.executeJavaScript(`(async()=>{
    await new Promise(r=>setTimeout(r,100));
    const interval=document.getElementById('interval');interval.value='15';interval.dispatchEvent(new Event('change'));
    for(let i=0;i<100&&(await wallpapers.state()).settings.intervalMinutes!==15;i++)await new Promise(r=>setTimeout(r,20));
    const shortcut=document.getElementById('shortcut');shortcut.click();shortcut.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',ctrlKey:true,altKey:true,bubbles:true}));
    for(let i=0;i<100&&(await wallpapers.state()).settings.shortcut!=='Control+Alt+G';i++)await new Promise(r=>setTimeout(r,20));
    const state=await wallpapers.state();return state.settings.intervalMinutes===15&&state.settings.shortcut==='Control+Alt+G';
  })()`);
  if (!settingsViaUI) throw Error('Settings / shortcut recorder failed through actual IPC');
  checkpoint('custom photo and export directories');
  const fixtureDir=path.join(qa,'fixture-photos');await fs.mkdir(fixtureDir,{recursive:true});await fs.copyFile(path.join(root,'assets/icon.png'),path.join(fixtureDir,'photo.png'));
  await update({...prefs,photoSource:'folder',photoFolder:fixtureDir,saveFolder:path.join(qa,'Custom exports — работы')});
  await generate(); if (current.photos.length!==1) throw Error('Custom photo folder not used');
  const customExport=await save(); if (!customExport.startsWith(prefs.saveFolder+path.sep)) throw Error('Custom export folder not used');
  const persisted=await readJSON(settingsFile());if(persisted.photoFolder!==fixtureDir||persisted.saveFolder!==prefs.saveFolder||persisted.shortcut!=='Control+Alt+G')throw Error('Settings did not persist');
  checkpoint('screenshots');
  await update({...prefs,intervalMinutes:60,photoSource:'system',saveFolder:path.join(app.getPath('documents'),'default_wallpaper'),desktopButtons:true});
  await preferencesWindow.webContents.executeJavaScript('new Promise(r=>setTimeout(r,250))');
  await fs.writeFile(path.join(qa, 'settings.png'), (await preferencesWindow.webContents.capturePage()).toPNG());
  await controlWindow.webContents.executeJavaScript('new Promise(r=>setTimeout(r,250))');
  await fs.writeFile(path.join(qa, 'controls.png'), (await controlWindow.webContents.capturePage()).toPNG());
  const report = {platform: process.platform, version: app.getVersion(), frames: frames.map(f => ({id: f.id, size: f.record.renderSize, palette: f.palette})), exportedFolder: folder, photoExportExact: true, settingsViaUI, customPhotoFolder: true, customExportFolder: true, persistedSettings: true, desktopUnchanged: true, settings: prefs};
  await fs.writeFile(path.join(qa, 'report.json'), JSON.stringify(report, null, 2));
  clearTimeout(watchdog); console.log(JSON.stringify(report)); app.exit(0);
}
const hasLock = smoke || app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', showSettings);
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => { clearInterval(timer); globalShortcut.unregisterAll(); });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({cancel: !/^(file:|data:|blob:|devtools:)/.test(details.url)}));
    await fs.mkdir(app.getPath('userData'), {recursive: true});
    const stored = await readJSON(settingsFile());
    prefs = core.settings(stored || {}, {documents: app.getPath('documents')});
    current = await readJSON(currentFile());
    if (current?.works && !(await Promise.all(current.works.map(w => fs.access(w.path).then(() => true, () => false)))).every(Boolean)) current = null;
    installIPC();
    if (smoke) return smokeTest();
    tray = new Tray(nativeImage.createFromPath(path.join(root, 'assets/icon.png')).resize({width: 24, height: 24}));
    tray.setToolTip('default_wallpaper'); tray.on('double-click', showSettings); publish();
    if (prefs.shortcut && !globalShortcut.register(prefs.shortcut, () => safely(generate()))) { error = 'Shortcut unavailable. Choose another in Settings.'; publish(); }
    showControls();
    screen.on('display-added', () => { showControls(); safely(generate({refresh: true})); });
    screen.on('display-removed', () => { showControls(); safely(generate({refresh: true})); });
    screen.on('display-metrics-changed', () => { showControls(); safely(generate({refresh: true})); });
    timer = setInterval(() => { if (prefs.intervalMinutes > 0 && Date.now() - (current?.lastGeneration || 0) >= prefs.intervalMinutes * 60000) safely(generate()); }, 30000);
    if (!stored) showSettings();
    safely(generate({refresh: Boolean(current)}));
  }).catch(e => { console.error(e); if (smoke) app.exit(1); else { error = e.message; publish(); } });
}
