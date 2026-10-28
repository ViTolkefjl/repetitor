/* Репетитор — задания с выбором и перетаскиванием (ученик) и карточки-правила.
   Типы: choice, fill, match, sort, order, theory.
   Перетаскивание сделано на Pointer Events (мышь, трекпад, палец) + режим «нажми слово → нажми место». */
(function () {
  const { esc } = REP;
  const GAP = /_{2,}/g;
  const COLORS = ['#e8890c', '#1f9d55', '#7a4fd6', '#2f7fe0', '#d6457f', '#d9472b', '#0f9aa6', '#8a6d1f'];

  const pic = p => p ? '<div class="pic" aria-hidden="true">' + esc(p) + '</div>' : '';
  const tr = t => t ? '<div class="tr">' + esc(t) + '</div>' : '';

  /* ---------- озвучка (синтез речи браузера) ----------
     Берём самый живой английский голос, какой есть на устройстве (Premium/Enhanced, Google, Samantha…),
     говорим медленно, «your / yours» — по отдельности с паузой; повторное нажатие — ещё медленнее. */
  const canSay = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const ROBOT = /compact|eloquence|albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|good news|jester|organ|superstar|trinoids|whisper|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy/i;
  function score(v) {
    if (!/^en/i.test(v.lang)) return -1e3;
    let s = 0;
    if (/premium|enhanced|natural|neural/i.test(v.name)) s += 50;
    if (/^google (us|uk) english/i.test(v.name)) s += 40;
    if (/ava|zoe|samantha|allison|susan|serena|daniel|karen|moira|tessa|evan|nathan/i.test(v.name)) s += 30;
    if (ROBOT.test(v.name)) s -= 60;
    if (/^en[-_]US/i.test(v.lang)) s += 10; else if (/^en[-_]GB/i.test(v.lang)) s += 6;
    return s;
  }
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let voice = null;
  function voices() {
    if (!canSay) return [];
    return (speechSynthesis.getVoices() || []).filter(v => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a));
  }
  function pickVoice() {
    const vs = voices();
    const saved = store.get('rep_voice');
    voice = (saved && vs.find(v => v.name === saved)) || vs[0] || null;
  }
  if (canSay) { pickVoice(); try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {} }
  function setVoice(name) { store.set('rep_voice', name); pickVoice(); }

  let last = { text: '', at: 0 }, queueId = 0;
  function say(text, opts) {
    if (!canSay || !text) return;
    if (!voice) pickVoice();
    const clean = String(text).replace(/[«»"]/g, '').trim();
    const n = Date.now();
    // нажал ещё раз то же слово — скажем совсем медленно (и дальше чередуем)
    const slow = (opts && opts.slow) || (last.text === clean && n - last.at < 4000 && !last.slow);
    last = { text: clean, at: n, slow };
    // «your / yours», «I → me», «my cat — The cat is mine» — по частям с паузой
    const parts = clean.split(/\s*(?:\/|→|—|–|·)\s*/).filter(Boolean);
    const id = ++queueId;
    speechSynthesis.cancel();
    const next = i => {
      if (id !== queueId || i >= parts.length) return;
      const words = parts[i].split(/\s+/).length;
      // одиночную «I» голоса Apple читают как «capital I» — подставляем «eye», это то же звучание [ай]
      const u = new SpeechSynthesisUtterance(/^I[.!?]?$/.test(parts[i]) ? 'eye' : parts[i]);
      u.lang = voice ? voice.lang : 'en-US';
      if (voice) u.voice = voice;
      u.rate = slow ? 0.5 : words <= 2 ? 0.68 : 0.78;
      u.pitch = 1;
      let done = false;
      const go = () => { if (done) return; done = true; setTimeout(() => next(i + 1), 550); };
      u.onend = go; u.onerror = go;
      setTimeout(go, 1500 + parts[i].length * (slow ? 220 : 140));   // если браузер не сообщил о конце
      speechSynthesis.speak(u);
    };
    next(0);
  }
  const isEn = s => /[A-Za-z]/.test(s || '') && !/[А-Яа-яЁё]/.test(s || '');
  const sayBtn = text => canSay && isEn(text) ? '<button type="button" class="say" data-say="' + esc(text) + '" aria-label="Послушать, как произносится">🔊</button>' : '';

  /* ---------- правило ---------- */
  // карточка: обычная или «перевёртыш» (спереди английское слово и 🔊, сзади перевод)
  function card(r, i, flip, color) {
    const c = color || COLORS[i % COLORS.length];
    if (!flip) {
      return '<div class="rule-cell" style="--c:' + c + '">' + pic(r.pic)
        + (r.en ? '<div class="en">' + esc(r.en) + sayBtn(r.en) + '</div>' : '')
        + (r.ru ? '<div class="ru">' + esc(r.ru) + '</div>' : '')
        + (r.ex ? '<div class="ex">' + esc(r.ex) + sayBtn(r.ex) + '</div>' : '')
        + '</div>';
    }
    return '<div class="flip" style="--c:' + c + '" data-flip tabindex="0" role="button" aria-label="Перевернуть карточку ' + esc(r.en || '') + '">'
      + '<div class="flip-in"><div class="face front">' + pic(r.pic) + '<div class="en">' + esc(r.en || '') + '</div>' + sayBtn(r.en)
      + '<div class="turn" aria-hidden="true">↻</div></div>'
      + '<div class="face back"><div class="ru">' + esc(r.ru || '') + '</div>' + (r.ex ? '<div class="ex">' + esc(r.ex) + '</div>' : '') + '</div></div></div>';
  }

  function theoryHtml(t) {
    let h = '';
    if (t.text) h += '<p class="task-text">' + esc(t.text) + '</p>';
    const flip = !!t.flip;
    if (flip) h += '<p class="flip-hint">Нажми на карточку — она перевернётся и покажет перевод. 🔊 — послушать.</p>';
    if (Array.isArray(t.groups) && t.groups.length) {
      h += '<div class="vs">' + t.groups.map((g, gi) => {
        const c = g.color || COLORS[(gi * 3) % COLORS.length];
        return (gi ? '<div class="vs-or" aria-hidden="true">или</div>' : '')
          + '<div class="vs-col" style="--c:' + c + '"><div class="vs-head">'
          + (g.icon ? '<span class="vs-icon">' + esc(g.icon) + '</span>' : '')
          + '<div><div class="vs-name">' + esc(g.name || '') + sayBtn(g.name) + '</div>' + (g.sub ? '<div class="vs-sub">' + esc(g.sub) + '</div>' : '') + '</div></div>'
          + (g.desc ? '<p class="vs-desc">' + esc(g.desc) + '</p>' : '')
          + (g.formula ? '<div class="vs-formula">' + esc(g.formula) + sayBtn(g.formula) + '</div>' : '')
          + '<div class="vs-cards">' + (g.cards || []).map((r, i) => card(r, i, flip, c)).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    if (Array.isArray(t.table) && t.table.length) {
      h += '<div class="rule-grid">' + t.table.map((r, i) => card(r, i, flip)).join('') + '</div>';
    }
    if (Array.isArray(t.how) && t.how.length) {
      h += '<div class="how"><b>Как выбрать — по шагам</b><ol>' + t.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol></div>';
    }
    if (Array.isArray(t.tricks) && t.tricks.length) {
      h += '<div class="tricks">' + t.tricks.map(x => '<div class="trick"><span class="tr-icon" aria-hidden="true">' + esc(x.icon || '💡') + '</span><div><b>Лайфхак</b><p>' + esc(x.text || '') + '</p></div></div>').join('') + '</div>';
    }
    if (t.note) h += '<div class="remember"><b>Запомни</b>' + esc(t.note) + '</div>';
    return h;
  }

  // перевёртыши и 🔊 работают в любом задании
  function bindCommon(sec) {
    if (sec._common) return;
    sec._common = true;
    sec.addEventListener('click', e => {
      const sb = e.target.closest('[data-say]');
      if (sb) { e.stopPropagation(); say(sb.dataset.say); return; }
      const f = e.target.closest('[data-flip]');
      if (f) f.classList.toggle('flipped');
    });
    sec.addEventListener('keydown', e => {
      const f = e.target.closest && e.target.closest('[data-flip]');
      if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); f.classList.toggle('flipped'); }
    });
  }

  /* ---------- разметка заданий ---------- */
  function html(t, a) {
    const parts = (a && a.parts) || [];
    if (t.type === 'theory') return theoryHtml(t);

    if (t.type === 'choice') {
      return '<div class="choice-list">' + (t.items || []).map((it, i) => {
        const q = esc(it.q || '').replace(GAP, '<span class="blank">' + (parts[i] ? esc(parts[i]) : '&nbsp;') + '</span>');
        return '<div class="choice-item">' + pic(it.pic) + '<div class="ci-body"><div class="sent">' + q + '</div>' + tr(it.tr)
          + '<div class="opts">' + (it.options || []).map(o =>
            '<button type="button" class="opt' + (parts[i] === o ? ' on' : '') + '" data-ci="' + i + '" data-opt="' + esc(o) + '">' + esc(o) + '</button>').join('')
          + '</div></div></div>';
      }).join('') + '</div>';
    }

    let body = '';
    if (t.type === 'fill') {
      let g = 0;
      body = '<div class="fill-list">' + (t.items || []).map(it =>
        '<div class="fill-item">' + pic(it.pic) + '<div><div class="sent">'
        + esc(it.q || '').replace(GAP, () => '<span class="slot one inline" data-slot="g' + (g++) + '"></span>')
        + '</div>' + tr(it.tr) + '</div></div>').join('') + '</div>'
        + '<div class="bank" data-slot="B"></div>';
    }
    if (t.type === 'match') {
      body = '<div class="match-list">' + (t.left || []).map((l, i) =>
        '<div class="match-row"><span class="left">' + esc(l) + sayBtn(l) + '</span><span class="arrow" aria-hidden="true">→</span><span class="slot one" data-slot="m' + i + '"></span></div>').join('')
        + '</div><div class="bank" data-slot="B"></div>';
    }
    if (t.type === 'sort') {
      body = '<div class="groups">' + (t.groups || []).map((g, i) =>
        '<div class="group" style="--c:' + COLORS[(i * 3) % COLORS.length] + '"><div class="g-name">' + esc(g) + '</div><div class="slot many" data-slot="G' + i + '"></div></div>').join('')
        + '</div><div class="bank" data-slot="B"></div>';
    }
    if (t.type === 'order') {
      body = '<div class="order-list">' + (t.items || []).map((it, i) =>
        '<div class="order-item">' + pic(it.pic) + '<div class="oi-body">' + tr(it.tr)
        + '<div class="line-wrap"><div class="slot many line" data-slot="L' + i + '"></div>' + (it.end ? '<span class="end">' + esc(it.end) + '</span>' : '') + '</div>'
        + '<div class="bank" data-slot="B' + i + '"></div></div></div>').join('') + '</div>';
    }
    return '<div class="board">' + body + '</div>';
  }

  /* ---------- фишки: из чего состоит задание ---------- */
  function chipsOf(t) {
    if (t.type === 'fill') return (t.bank || []).map(w => ({ w, home: 'B' }));
    if (t.type === 'match') return (t.right || []).map(w => ({ w, home: 'B' }));
    if (t.type === 'sort') return (t.words || []).map(w => ({ w, home: 'B' }));
    if (t.type === 'order') {
      const out = [];
      (t.items || []).forEach((it, i) => (it.words || []).forEach(w => out.push({ w, home: 'B' + i })));
      return out;
    }
    return [];
  }

  /* ---------- подключение интерактива ---------- */
  function mount(sec, t, a, onChange, isLocked) {
    bindCommon(sec);
    if (t.type === 'theory') return;
    if (t.type === 'choice') return mountChoice(sec, t, a, onChange, isLocked);

    const board = sec.querySelector('.board');
    const chips = chipsOf(t);
    const slotEls = {};
    board.querySelectorAll('[data-slot]').forEach(el => { slotEls[el.dataset.slot] = el; });
    const state = {};
    Object.keys(slotEls).forEach(k => { state[k] = []; });
    chips.forEach((c, i) => state[c.home].push(i));
    let sel = null;
    const els = {};

    const where = i => Object.keys(state).find(k => state[k].includes(i));
    // зелёное после самопроверки закреплено: его не двигаем и не вытесняем
    const fixedEl = el => !!(el && (el.classList.contains('fb-ok') || el.closest('.fb-ok')));
    const chipFixed = i => isLocked() || fixedEl(els[i]);
    const isBank = k => k[0] === 'B';
    const isOne = k => slotEls[k].classList.contains('one');
    function takeOut(i) { const k = where(i); if (k) state[k].splice(state[k].indexOf(i), 1); }
    function move(i, to, before) {
      if (isBank(to)) to = chips[i].home;            // в любой банк — значит «вернуть домой»
      if (t.type === 'order' && !isBank(to) && to.slice(1) !== chips[i].home.slice(1)) return; // чужая строка
      if (fixedEl(slotEls[to]) && !isBank(to)) return;
      if (isOne(to) && state[to].length && chipFixed(state[to][0])) return;
      takeOut(i);
      if (isOne(to) && state[to].length) state[chips[state[to][0]].home].push(state[to].shift());
      const arr = state[to];
      const at = before != null ? arr.indexOf(before) : -1;
      if (at >= 0) arr.splice(at, 0, i); else arr.push(i);
    }

    // восстановление по сохранённому ответу
    const parts = (a && a.parts) || [];
    const fromBank = (bank, w) => state[bank].find(i => chips[i].w === w);
    if (t.type === 'fill' || t.type === 'match') {
      const pre = t.type === 'fill' ? 'g' : 'm';
      parts.forEach((w, k) => { const i = w ? fromBank('B', w) : undefined; if (i != null && state[pre + k]) move(i, pre + k); });
    } else if (t.type === 'sort') {
      parts.forEach((g, i) => { const gi = (t.groups || []).indexOf(g); if (gi >= 0 && chips[i]) move(i, 'G' + gi); });
    } else if (t.type === 'order') {
      parts.forEach((s, k) => String(s || '').split(' ').filter(Boolean).forEach(w => {
        const i = state['B' + k] && fromBank('B' + k, w); if (i != null) move(i, 'L' + k);
      }));
    }

    function draw() {
      Object.keys(state).forEach(k => {
        const el = slotEls[k];
        state[k].forEach(i => el.appendChild(chipEl(i)));
      });
      board.querySelectorAll('.wchip').forEach(c => c.classList.toggle('sel', +c.dataset.chip === sel));
      board.classList.toggle('picking', sel != null);
      board.classList.toggle('locked', isLocked());
    }
    function chipEl(i) {
      if (!els[i]) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'wchip'; b.dataset.chip = i; b.textContent = chips[i].w;
        b.addEventListener('pointerdown', down);
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } });
        els[i] = b;
      }
      return els[i];
    }

    function result() {
      let p, text;
      if (t.type === 'fill' || t.type === 'match') {
        const pre = t.type === 'fill' ? 'g' : 'm';
        const n = Object.keys(state).filter(k => k[0] === pre).length;
        p = Array.from({ length: n }, (_, k) => { const s = state[pre + k]; return s && s.length ? chips[s[0]].w : ''; });
        text = t.type === 'match' ? (t.left || []).map((l, k) => l + ' → ' + (p[k] || '…')).join('\n') : p.join(', ');
      } else if (t.type === 'sort') {
        p = chips.map((_, i) => { const k = where(i); return k && k[0] === 'G' ? t.groups[+k.slice(1)] : ''; });
        text = (t.groups || []).map((g, gi) => g + ': ' + state['G' + gi].map(i => chips[i].w).join(', ')).join('\n');
      } else {
        p = (t.items || []).map((_, k) => state['L' + k].map(i => chips[i].w).join(' '));
        text = p.join('\n');
      }
      return { parts: p, text };
    }
    function changed() { sel = null; draw(); const r = result(); onChange(r.parts, r.text); }

    function tap(i) {
      if (chipFixed(i)) return;
      const k = where(i);
      if (!isBank(k)) { move(i, chips[i].home); return changed(); }
      if (t.type === 'order') { move(i, 'L' + chips[i].home.slice(1)); return changed(); }
      sel = sel === i ? null : i; draw();
    }
    board.addEventListener('click', e => {
      if (sel == null || isLocked() || e.target.closest('.wchip')) return;
      const s = e.target.closest('[data-slot]');
      if (s && !isBank(s.dataset.slot)) { move(sel, s.dataset.slot); changed(); }
    });

    function down(e) {
      const chip = e.currentTarget, i = +chip.dataset.chip;
      if (chipFixed(i) || e.button > 0) return;
      e.preventDefault();
      try { chip.setPointerCapture(e.pointerId); } catch (_) {}
      const st = { x: e.clientX, y: e.clientY, drag: false, ghost: null, over: null };
      const mv = ev => {
        if (!st.drag && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > 6) {
          st.drag = true;
          const r = chip.getBoundingClientRect();
          st.dx = st.x - r.left; st.dy = st.y - r.top;
          st.ghost = chip.cloneNode(true); st.ghost.classList.add('ghost');
          st.ghost.style.width = r.width + 'px';
          document.body.appendChild(st.ghost);
          chip.classList.add('dragging');
        }
        if (st.drag) {
          // у края окна — подкручиваем страницу, чтобы можно было дотащить до дальнего места
          if (ev.clientY < 70) window.scrollBy(0, -14); else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
          st.ghost.style.left = (ev.clientX - st.dx) + 'px';
          st.ghost.style.top = (ev.clientY - st.dy) + 'px';
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const s = el && el.closest('[data-slot]');
          const over = s && board.contains(s) ? s : null;
          if (over !== st.over) { st.over && st.over.classList.remove('over'); over && over.classList.add('over'); st.over = over; }
        }
      };
      const up = ev => {
        chip.removeEventListener('pointermove', mv); chip.removeEventListener('pointerup', up); chip.removeEventListener('pointercancel', up);
        if (!st.drag) { if (ev.type === 'pointerup') tap(i); return; }
        st.ghost.remove(); chip.classList.remove('dragging'); st.over && st.over.classList.remove('over');
        if (ev.type !== 'pointerup') return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const s = el && el.closest('[data-slot]');
        if (!s || !board.contains(s)) return;
        const tgt = el.closest('.wchip');
        move(i, s.dataset.slot, tgt && tgt !== chip && s.classList.contains('many') ? +tgt.dataset.chip : null);
        changed();
      };
      chip.addEventListener('pointermove', mv); chip.addEventListener('pointerup', up); chip.addEventListener('pointercancel', up);
    }

    draw();
    sec._redraw = draw;
  }

  function mountChoice(sec, t, a, onChange, isLocked) {
    const parts = ((a && a.parts) || []).slice();
    sec.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
      if (isLocked() || b.closest('.fb-ok')) return;
      const i = +b.dataset.ci;
      parts[i] = b.dataset.opt;
      for (let k = 0; k < (t.items || []).length; k++) if (parts[k] == null) parts[k] = '';
      sec.querySelectorAll('.opt[data-ci="' + i + '"]').forEach(x => x.classList.toggle('on', x === b));
      const blank = sec.querySelectorAll('.choice-item')[i].querySelector('.blank');
      if (blank) blank.textContent = b.dataset.opt;
      const text = (t.items || []).map((it, k) => String(it.q || '').replace(GAP, parts[k] || '___')).join('\n');
      onChange(parts.slice(), text);
    }));
    sec._redraw = () => sec.querySelector('.choice-list').classList.toggle('locked', isLocked());
    sec._redraw();
  }

  /* Элемент на каждый пункт ответа (для подсветки после самопроверки) и место для объяснения «почему» */
  function itemEls(sec, t) {
    const all = sel => Array.from(sec.querySelectorAll(sel));
    if (t.type === 'choice') return all('.choice-item');
    if (t.type === 'fill') return all('[data-slot^="g"]').sort((a, b) => +a.dataset.slot.slice(1) - +b.dataset.slot.slice(1));
    if (t.type === 'match') return all('.match-row');
    if (t.type === 'sort') return (t.words || []).map((_, i) => sec.querySelector('.wchip[data-chip="' + i + '"]'));
    if (t.type === 'order') return all('.order-item');
    return [];
  }
  function whyHost(el, t) {
    if (!el) return null;
    if (t.type === 'choice') return el.querySelector('.ci-body');
    if (t.type === 'fill') return el.closest('.fill-item').lastElementChild;
    if (t.type === 'match') return el;
    if (t.type === 'order') return el.querySelector('.oi-body');
    return null;
  }

  window.EN = { html, mount, itemEls, whyHost, say, canSay, voices, setVoice, currentVoice: () => voice, TYPES: ['choice', 'fill', 'match', 'sort', 'order', 'theory'] };
})();
