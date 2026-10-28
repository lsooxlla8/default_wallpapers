const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const exec = promisify(execFile);
const run = (file, args) => exec(file, args, {windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024});
async function applyWindows(works, stateDir, helper) {
  const manifest = path.join(stateDir, 'windows-displays.json');
  await fs.writeFile(manifest, JSON.stringify(works.map(w => ({path: w.path, ...w.physical}))));
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-ManifestPath', manifest]);
}
async function applyLinux(works, env = process.env, command = run) {
  const desktop = (env.XDG_CURRENT_DESKTOP || env.DESKTOP_SESSION || '').toLowerCase();
  const primary = works.find(w => w.primary) || works[0];
  if (!primary) throw Error('No displays connected');
  if (/kde|plasma/.test(desktop)) {
    const entries = works.map(w => ({screen: w.index, uri: pathToFileURL(w.path).href}));
    const script = `var items=${JSON.stringify(entries)}; var ds=desktops(); for(var i=0;i<ds.length;i++){var d=ds[i];var p=items.filter(function(x){return x.screen===d.screen;})[0]||items[0];d.wallpaperPlugin='org.kde.image';d.currentConfigGroup=['Wallpaper','org.kde.image','General'];d.writeConfig('Image',p.uri);}`;
    let last;
    for (const qdbus of ['qdbus6', 'qdbus', 'qdbus-qt5']) { try { await command(qdbus, ['org.kde.plasmashell', '/PlasmaShell', 'org.kde.PlasmaShell.evaluateScript', script]); return ''; } catch (e) { last = e; if (e.code !== 'ENOENT') throw e; } }
    throw last;
  }
  if (/xfce/.test(desktop)) {
    const {stdout} = await command('xfconf-query', ['-c', 'xfce4-desktop', '-l']);
    const properties = stdout.split('\n').filter(s => /^\/backdrop\/screen\d+\/monitor[^/]+\/workspace\d+\/last-image$/.test(s));
    if (!properties.length) throw Error('XFCE wallpaper properties not found');
    for (const prop of properties) await command('xfconf-query', ['-c', 'xfce4-desktop', '-p', prop, '-s', primary.path]);
    return works.length > 1 ? 'XFCE uses one image on all displays' : '';
  }
  let schema, key = 'picture-uri', uri = pathToFileURL(primary.path).href;
  if (/cinnamon/.test(desktop)) schema = 'org.cinnamon.desktop.background';
  else if (/mate/.test(desktop)) { schema = 'org.mate.background'; key = 'picture-filename'; uri = primary.path; }
  else if (/gnome|unity|budgie|pantheon/.test(desktop)) schema = 'org.gnome.desktop.background';
  else throw Error('Automatic wallpaper installation is unavailable on this desktop. Save PNG from the tray menu. Supported: GNOME, KDE Plasma, XFCE, Cinnamon, MATE.');
  // GVariant strings are passed as one literal argument, never evaluated by a shell.
  const literal = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  await command('gsettings', ['set', schema, key, literal(uri)]);
  const {stdout: keys} = await command('gsettings', ['list-keys', schema]);
  if (keys.split('\n').includes('picture-uri-dark')) await command('gsettings', ['set', schema, 'picture-uri-dark', literal(uri)]);
  return works.length > 1 ? 'This desktop uses one image on all displays' : '';
}
async function lowerWindows(handle,helper){await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-WindowHandle',handle]);}
module.exports = {applyWindows, applyLinux, lowerWindows};
