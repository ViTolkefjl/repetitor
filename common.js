/* Репетитор — общие настройки и помощники для страниц ученика и учителя */
(function () {
  const CFG = {
    apiKey: "AIzaSyANv8Jq6HAWwSdSAsTCBFwsc4nYlrRcCGo",
    authDomain: "repetitor-2b389.firebaseapp.com",
    databaseURL: "https://repetitor-2b389-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "repetitor-2b389",
    storageBucket: "repetitor-2b389.firebasestorage.app",
    messagingSenderId: "988353925699",
    appId: "1:988353925699:web:6fe51677aee60bb4b6faf6"
  };

  firebase.initializeApp(CFG);
  const db = firebase.database();

  let offset = 0;
  db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
  const now = () => Date.now() + offset;
  const TS = firebase.database.ServerValue.TIMESTAMP;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Нормализация ответа для автосверки: регистр, ё/е, пробелы, запятая/точка
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[×*⋅]/g, '·')
      .replace(/[\s ]+/g, ' ')
      .replace(/(\d) (?=\d)/g, '$1')
      .replace(/(\d) ?[xх] ?(?=\d)/g, '$1·')
      .replace(/\s*([=+\-·:\/,.;()])\s*/g, '$1')
      .replace(/,/g, '.')
      .replace(/[.;]+$/, '')
      .trim();
  }
  const same = (ans, key) => String(key).split('|').some(k => norm(k) === norm(ans));

  // Ожидаемые буквы для типа «вставь букву»: позиции «_» шаблона, взятые из ключа
  function lettersFromKey(template, key) {
    if (typeof key !== 'string' || key.length !== template.length) return null;
    const out = [];
    for (let i = 0; i < template.length; i++) if (template[i] === '_') out.push(key[i]);
    return out;
  }

  /* Автосверка. Возвращает { state: 'match'|'miss'|'empty'|'nokey', parts?: [...] } */
  function check(task, key, ans) {
    const has = ans && ((ans.text && ans.text.replace(/_/g, '').trim()) || (ans.parts && ans.parts.some(p => p)));
    if (key == null || key === '') return { state: has ? 'nokey' : 'empty' };
    if (!has) return { state: 'empty' };

    if (task.type === 'short' && Array.isArray(task.items)) {
      const keys = Array.isArray(key) ? key : [];
      const parts = task.items.map((_, i) => {
        const a = (ans.parts || [])[i];
        if (!a) return 'empty';
        if (keys[i] == null) return 'nokey';
        return same(a, keys[i]) ? 'match' : 'miss';
      });
      const state = parts.every(p => p === 'match') ? 'match' : parts.some(p => p === 'miss') ? 'miss' : 'empty';
      return { state, parts };
    }
    if (task.type === 'letters') {
      const exp = lettersFromKey(task.text || '', key);
      if (!exp) return { state: same(ans.text, key) ? 'match' : 'miss' };
      const parts = exp.map((L, i) => {
        const a = (ans.parts || [])[i];
        if (!a) return 'empty';
        return norm(a) === norm(L) ? 'match' : 'miss';
      });
      const state = parts.every(p => p === 'match') ? 'match' : parts.some(p => p === 'miss') ? 'miss' : 'empty';
      return { state, parts };
    }
    if (task.type === 'steps') {
      const t = norm(ans.text).replace(/ /g, '');
      return { state: String(key).split('|').some(k => t.includes(norm(k).replace(/ /g, ''))) ? 'match' : 'miss' };
    }
    return { state: same(ans.text, key) ? 'match' : 'miss' };
  }

  function dur(ms) {
    ms = Math.max(0, ms || 0);
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + ' с';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' мин' + (s % 60 && m < 10 ? ' ' + (s % 60) + ' с' : '');
    return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
  }

  function clock(t) {
    if (!t) return '';
    const d = new Date(t);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function randomKey(n) {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, x => abc[x % abc.length]).join('');
  }

  // Порядок заданий в занятии
  const sortedTasks = lesson => Object.entries((lesson && lesson.tasks) || {})
    .map(([id, t]) => Object.assign({ id }, t))
    .sort((a, b) => (a.n || 0) - (b.n || 0));

  window.REP = { db, now, TS, esc, norm, check, dur, clock, randomKey, sortedTasks, lettersFromKey };
})();
