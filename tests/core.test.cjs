const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const core = require('../desktop/core.cjs');
const {applyLinux} = require('../desktop/platform.cjs');
test('settings preserve explicit manual mode, both controls, and custom export destination', () => {
  const folder = path.join(os.tmpdir(), 'экспорт с пробелами');
  const s = core.settings({intervalMinutes: 0, desktopButtons: true, saveFolder: folder, photoSource: 'folder', photoFolder: folder, shortcut: 'Control+Alt+G'});
  assert.equal(s.intervalMinutes, 0); assert.equal(s.desktopButtons, true); assert.equal(s.saveFolder, folder); assert.equal(s.shortcut, 'Control+Alt+G');
  assert.equal(core.settings().desktopButtons, false); assert.equal(core.settings().shortcut, '');
  assert.equal(core.settings({intervalMinutes: -5}).intervalMinutes, 60);
});
test('shortcut needs a modifier and a supported key', () => {
  for (const key of ['G', 'Shift+G', 'Alt+exec()', 'Alt+G;rm', null]) assert.equal(core.validShortcut(key), false);
  for (const key of ['', 'Control+Alt+G', 'Super+F12', 'Alt+Space']) assert.equal(core.validShortcut(key), true);
});
test('atomic persistence handles Unicode and repeated writes without leftover files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-test-')); t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'settings.json');
  await core.atomicJSON(file, {photoFolder: 'Фото'}); await core.atomicJSON(file, {saveFolder: 'Работы'});
  assert.deepEqual(JSON.parse(await fs.readFile(file)), {saveFolder: 'Работы'}); assert.deepEqual(await fs.readdir(dir), ['settings.json']);
});
test('seeds are stable per display and distinct', () => { assert.equal(core.seedFor(7, 'sim0'), core.seedFor(7, 'sim0')); assert.notEqual(core.seedFor(7, 'sim0'), core.seedFor(7, 'sim1')); });
test('nested compositions retain all used photo IDs', () => assert.deepEqual([...core.photoIDs({composition: {sources: [{photo: 'a'}, {nested: {photo: 'b'}}, {photo: 'a'}]}})].sort(), ['a','b']));
test('export embeds only used photographs and preserves an existing destination', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-export-')); t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const source = path.join(dir, 'original.png'); await fs.writeFile(source, 'fixture'); const folder = path.join(dir, 'work');
  const options = {art: path.resolve(__dirname, '../art'), folder, work: {path: source, record: {seed: 7, renderSize: [640, 360], photo: 'used'}}, photos: [{id: 'used', url: 'data:image/png;base64,USED'}, {id: 'private-unused', url: 'PRIVATE_UNUSED_IMAGE'}]};
  await core.exportWork(options);
  const js = await fs.readFile(path.join(folder, 'sketch.js'), 'utf8'); assert.ok(js.includes('data:image/png;base64,USED')); assert.ok(!js.includes('PRIVATE_UNUSED_IMAGE'));
  await assert.rejects(core.exportWork(options)); assert.equal(await fs.readFile(path.join(folder, 'wallpaper.png'), 'utf8'), 'fixture');
});
test('failed export cleans up only its own new directory', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-export-')); t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const folder = path.join(dir, 'broken'); await assert.rejects(core.exportWork({folder, art: '/does-not-exist', work: {}})); await assert.rejects(fs.access(folder));
});
test('GNOME applies light and dark URI using argument arrays with escaped paths', async () => {
  const calls = [], file = "/tmp/фото с ' апострофом.png";
  const result = await applyLinux([{primary: true, path: file}], {XDG_CURRENT_DESKTOP: 'GNOME'}, async (bin, args) => { calls.push([bin, args]); return {stdout: args[0] === 'list-keys' ? 'picture-uri\npicture-uri-dark\n' : ''}; });
  assert.equal(result, ''); assert.equal(calls.length, 3); assert.equal(calls[0][1][2], 'picture-uri'); assert.equal(calls[2][1][2], 'picture-uri-dark'); assert.ok(calls[0][1][3].includes('%D1%84'));
});
test('KDE passes separate per-screen images and safely embeds paths in script', async () => {
  let script;
  await applyLinux([{index: 0, primary: true, path: '/tmp/a.png'}, {index: 1, path: '/tmp/b.png'}], {XDG_CURRENT_DESKTOP: 'KDE'}, async (_bin, args) => { script = args.at(-1); return {stdout: ''}; });
  assert.ok(script.includes('file:///tmp/a.png')); assert.ok(script.includes('file:///tmp/b.png')); assert.ok(script.includes('d.screen'));
});
test('unsupported Linux desktop reports that automatic wallpaper application is unavailable', async () => { await assert.rejects(applyLinux([{path: '/tmp/a.png'}], {XDG_CURRENT_DESKTOP: 'unknown'}), /не поддерживает/); });
