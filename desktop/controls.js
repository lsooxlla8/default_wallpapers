const generate = document.getElementById('generate'), save = document.getElementById('save');
generate.onclick = () => wallpapers.generate().catch(console.error);
save.onclick = () => wallpapers.save().catch(console.error);
const changed = state => { generate.disabled = state.busy; save.disabled = state.busy || !state.hasWork; };
wallpapers.change(changed); wallpapers.state().then(changed);
