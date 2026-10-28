if (!window.wallpapers && window.webkit?.messageHandlers?.settings) {
  const pending = new Map(), listeners = new Set(); let next = 1;
  const invoke = (operation, value) => new Promise((resolve, reject) => { const id = next++; pending.set(id, {resolve, reject}); window.webkit.messageHandlers.settings.postMessage({id, operation, value: value ?? null}); });
  window.nativeReply = (id, value, error) => { const promise = pending.get(id); if (!promise) return; pending.delete(id); if (value?.settings) for (const listener of listeners) listener(value); if (error) promise.reject(Error(error)); else promise.resolve(value); };
  window.wallpapers = {state: () => invoke('state'), update: value => invoke('settings', value), choose: kind => invoke('choose', kind), connectPhotos: () => invoke('connect'), change: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}
