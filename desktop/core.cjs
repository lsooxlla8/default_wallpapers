const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const INTERVALS = [0, 1, 5, 15, 30, 60, 120, 360, 720, 1440];
function settings(value = {}, paths = {}) {
  return {
    intervalMinutes: INTERVALS.includes(value.intervalMinutes) ? value.intervalMinutes : 60,
    photoSource: ['system', 'folder', 'none'].includes(value.photoSource) ? value.photoSource : 'system',
    photoFolder: typeof value.photoFolder === 'string' ? value.photoFolder : '',
    saveFolder: typeof value.saveFolder === 'string' && path.isAbsolute(value.saveFolder) ? value.saveFolder : path.join(paths.documents || '.', 'Wallpaper Generator'),
    desktopButtons: value.desktopButtons === true,
    shortcut: validShortcut(value.shortcut) ? value.shortcut : ''
  };
}
function validShortcut(value) {
  return typeof value === 'string' && (value === '' || /^(?:(?:CommandOrControl|Control|Command|Alt|Shift|Super)\+){1,4}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/.test(value) && /(?:CommandOrControl|Control|Command|Alt|Super)\+/.test(value));
}
function seedFor(base, id) { let h = (base ^ 0x9e3779b9) >>> 0; for (const c of Buffer.from(String(id))) h = Math.imul(h ^ c, 16777619) >>> 0; return h || 1; }
async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  try { await fs.writeFile(tmp, JSON.stringify(value, null, 2), {mode: 0o600}); await fs.rename(tmp, file); }
  finally { await fs.rm(tmp, {force: true}).catch(() => {}); }
}
function photoIDs(value, ids = new Set()) {
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { if (key === 'photo' && typeof item === 'string') ids.add(item); else photoIDs(item, ids); }
  return ids;
}
async function exportWork({work, photos = [], folder, art}) {
  // mkdir without recursive prevents accidentally removing an existing export on failure.
  await fs.mkdir(folder);
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(art, 'engine.json'), 'utf8'));
    const parts = await Promise.all(manifest.scripts.filter(n => !['p5.min.js', 'sketches.js'].includes(n)).map(n => fs.readFile(path.join(art, n), 'utf8')));
    const renderer = await fs.readFile(path.join(art, 'sketches.js'), 'utf8');
    const record = work.record, [w, h] = record.renderSize;
    const ids = photoIDs(record), selected = photos.filter(p => ids.has(p.id));
    const source = `window.DEFAULT_DESKTOP_WIDTH=${w};window.DEFAULT_DESKTOP_HEIGHT=${h};window.DEFAULT_DESKTOP_DENSITY=1;window.DEFAULT_DESKTOP_SKETCH=${JSON.stringify(record)};\n${parts.join('\n\n')}\nDesktopExperiments.setPhotos(${JSON.stringify(selected)}).then(()=>{\n${renderer}\n});\n`;
    await fs.writeFile(path.join(folder, 'sketch.js'), source);
    await fs.writeFile(path.join(folder, 'recipe.json'), JSON.stringify(record, null, 2));
    await fs.writeFile(path.join(folder, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wallpaper Generator — p5.js</title><style>html,body{margin:0;background:#050505}body{min-height:100vh;display:grid;place-items:center}canvas{display:block;max-width:100vw;max-height:100vh;width:auto!important;height:auto!important}</style><script src="p5.min.js"></script></head><body><script src="sketch.js"></script></body></html>');
    for (const name of ['p5.min.js', 'p5-LICENSE.txt']) await fs.copyFile(path.join(art, name), path.join(folder, name));
    await fs.copyFile(work.path, path.join(folder, 'wallpaper.png'));
  } catch (error) { await fs.rm(folder, {recursive: true, force: true}); throw error; }
}
module.exports = {INTERVALS, settings, validShortcut, seedFor, atomicJSON, photoIDs, exportWork};
