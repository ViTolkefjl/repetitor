// Минимальный мок firebase compat (app + database + auth) поверх localStorage, синхронизация между вкладками через storage-событие
(function () {
  if (window.firebase && window.firebase.__mock) return;
  const KEY = 'mockdb';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const listeners = [];
  const split = p => String(p || '').split('/').filter(Boolean);
  function get(root, path) { let n = root; for (const k of split(path)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; }
  function clean(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v['.sv'] === 'timestamp') return Date.now();
    if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { if (x != null) o[i] = clean(x); }); return Object.keys(o).length ? o : null; }
    if (v && typeof v === 'object') { const o = {}; for (const k in v) { const c = clean(v[k]); if (c != null) o[k] = c; } return Object.keys(o).length ? o : null; }
    return v === undefined ? null : v;
  }
  function setIn(root, path, v) {
    const ks = split(path);
    if (!ks.length) return clean(v) || {};
    let n = root;
    for (let i = 0; i < ks.length - 1; i++) { if (!n[ks[i]] || typeof n[ks[i]] !== 'object') n[ks[i]] = {}; n = n[ks[i]]; }
    const c = clean(v);
    if (c == null) delete n[ks[ks.length - 1]]; else n[ks[ks.length - 1]] = c;
    return root;
  }
  // массивы в RTDB возвращаются как массивы, если ключи 0..n-1
  function arrify(v) {
    if (!v || typeof v !== 'object') return v;
    const ks = Object.keys(v);
    for (const k in v) v[k] = arrify(v[k]);
    if (ks.length && ks.every((k, i) => String(i) === k)) return ks.map(k => v[k]);
    return v;
  }
  function write(fn) {
    const root = load(); const r = fn(root) || root;
    localStorage.setItem(KEY, JSON.stringify(r));
    setTimeout(notify, 0);
    return Promise.resolve();
  }
  function snap(path, root) { const v = arrify(JSON.parse(JSON.stringify(get(root, path)))); return { val: () => v, exists: () => v != null, key: split(path).pop() || null }; }
  function notify() {
    const root = load();
    listeners.forEach(l => {
      const s = JSON.stringify(get(root, l.path));
      if (s !== l.last) { l.last = s; l.cb(snap(l.path, root)); }
    });
  }
  window.addEventListener('storage', e => { if (e.key === KEY) notify(); });
  let pushN = 0, conn = true; const connCbs = [];
  window.__setConnected = v => { conn = v; connCbs.forEach(c => c({ val: () => v })); };
  function ref(path) {
    path = split(path).join('/');
    return {
      key: split(path).pop() || null,
      child: p => ref(path + '/' + p),
      on(ev, cb) {
        if (path === '.info/serverTimeOffset') { setTimeout(() => cb({ val: () => 0 }), 0); return cb; }
        if (path === '.info/connected') { connCbs.push(cb); setTimeout(() => cb({ val: () => conn }), 0); return cb; }
        const l = { path, cb, last: undefined }; listeners.push(l);
        setTimeout(() => { const root = load(); l.last = JSON.stringify(get(root, path)); cb(snap(path, root)); }, 0);
        return cb;
      },
      off(ev, cb) { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].path === path && (!cb || listeners[i].cb === cb)) listeners.splice(i, 1); },
      once() { return Promise.resolve(snap(path, load())); },
      set(v) { return write(root => setIn(root, path, v)); },
      update(o) { return write(root => { for (const k in o) setIn(root, path ? path + '/' + k : k, o[k]); return root; }); },
      remove() { return write(root => setIn(root, path, null)); },
      push() { return ref(path + '/-L' + Date.now().toString(36) + (pushN++)); },
      onDisconnect() { return { update: () => Promise.resolve(), set: () => Promise.resolve(), remove: () => Promise.resolve() }; }
    };
  }
  const dbObj = { ref, INTERNAL: { forceLongPolling() {} } };
  const database = () => dbObj;
  database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  const authCbs = [];
  const user = () => { try { return JSON.parse(localStorage.getItem('mockuser')); } catch (e) { return null; } };
  const authObj = {
    onAuthStateChanged(cb) { authCbs.push(cb); setTimeout(() => cb(user()), 0); },
    signInWithPopup() { const u = { uid: 'teacher-uid', email: 'vitaly@example.com' }; localStorage.setItem('mockuser', JSON.stringify(u)); authCbs.forEach(c => c(u)); return Promise.resolve({ user: u }); },
    signOut() { localStorage.removeItem('mockuser'); return Promise.resolve(); }
  };
  const auth = () => authObj;
  auth.GoogleAuthProvider = function () {};
  window.firebase = { __mock: true, initializeApp() {}, database, auth };
})();
