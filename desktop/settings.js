const $ = id => document.getElementById(id);
let state, recording = false;
function render(value) {
  state = value;
  const s = value.settings;
  $('interval').value = s.intervalMinutes; $('source').value = s.photoSource; $('buttons').checked = s.desktopButtons;
  if (!recording) $('shortcut').value = s.shortcut;
  $('photo-path').textContent = s.photoSource === 'none' ? 'Только процедурная графика' : s.photoSource === 'system' ? value.pictures : s.photoFolder || 'Папка не выбрана';
  $('save-path').textContent = s.saveFolder;
  $('generate').disabled = value.busy; $('save').disabled = value.busy || !value.hasWork;
  $('status').textContent = value.error || value.status || 'Готово'; $('status').className = value.error ? 'error' : '';
}
async function act(action) { try { const result = await action(); if (result) render(result); } catch (e) { $('status').textContent = e.message; $('status').className = 'error'; } }
const update = patch => act(() => wallpapers.update({...state.settings, ...patch}));
$('interval').onchange = () => update({intervalMinutes: Number($('interval').value)});
$('source').onchange = () => update({photoSource: $('source').value});
$('buttons').onchange = () => update({desktopButtons: $('buttons').checked});
$('choose-photo').onclick = () => act(() => wallpapers.choose('photo'));
$('choose-save').onclick = () => act(() => wallpapers.choose('save'));
$('open').onclick = () => act(() => wallpapers.openFolder());
$('generate').onclick = () => act(() => wallpapers.generate());
$('save').onclick = () => act(() => wallpapers.save());
$('clear-shortcut').onclick = () => { recording = false; update({shortcut: ''}); };
$('shortcut').onclick = () => { recording = true; $('shortcut').value = ''; $('shortcut').placeholder = 'Нажмите комбинацию…'; };
$('shortcut').onblur = () => { recording = false; if (state) $('shortcut').value = state.settings.shortcut; };
$('shortcut').onkeydown = e => {
  if (!recording) return;
  e.preventDefault();
  if (e.key === 'Escape') { recording = false; render(state); return; }
  if (!e.ctrlKey && !e.altKey && !e.metaKey) return;
  const key = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : /^F\d{1,2}$/.test(e.code) ? e.code : e.code === 'Space' ? 'Space' : '';
  if (!key) return;
  const combination = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.metaKey && 'Super', e.shiftKey && 'Shift', key].filter(Boolean).join('+');
  recording = false; update({shortcut: combination});
};
wallpapers.change(render);
act(() => wallpapers.state());
