/* Репетитор — образец «как записать в тетрадь».
   task.copy = {
     paper: 'cell' (клетка, математика) | 'line' (линейка, русский),
     lines: [ 'текст' | { t: 'текст', align: 'center'|'left', indent: число клеток/букв } ],   '' — пустая строка (пропуск)
     tips:  [ 'Пропусти 2 клетки вниз', … ]
   }
   В тексте [[о]] — выделить (орфограмма, ответ). */
(function () {
  const { esc } = REP;
  const COLS = 28;

  const marked = s => esc(s).replace(/\[\[(.+?)\]\]/g, '<b class="nb-mark">$1</b>');
  const plain = s => String(s).replace(/\[\[(.+?)\]\]/g, '$1');
  const line = l => typeof l === 'string' ? { t: l } : (l || { t: '' });

  // Цифры и знаки — по одной в клетку; слова пишутся слитно и занимают целое число клеток
  const CELL = 24, LETTER = 12.5;
  function cellLine(l) {
    const toks = [];
    String(l.t || '').replace(/\[\[(.+?)\]\]|([\s\S])/g, (m, mk, ch) => {
      (mk ? Array.from(mk) : [ch]).forEach(c => toks.push({ c, mk: !!mk }));
      return m;
    });
    // склеиваем буквы (и точку/двоеточие после них) в слова
    const runs = [];
    const isLetter = c => /[A-Za-zА-Яа-яЁё№]/.test(c);
    toks.forEach((x, i) => {
      const last = runs[runs.length - 1];
      if (x.c === ' ') {
        // пробел внутри фразы из слов — часть слова; между словом и цифрой — пустая клетка; между цифрами и знаками — без клетки
        const next = toks.slice(i + 1).find(y => y.c !== ' ');
        if (last && last.word && next && isLetter(next.c) && last.mk === next.mk) last.s += ' ';
        else if (last && next && (last.word || isLetter(next.c)) && last.s.slice(-1) !== ' ') runs.push({ s: ' ', word: false, mk: false });
        return;
      }
      const letter = isLetter(x.c) || (/[.:,!?]/.test(x.c) && last && last.word);
      if (letter && last && last.word && last.mk === x.mk) last.s += x.c;
      else runs.push({ s: x.c, word: !!letter, mk: x.mk });
    });
    const cellsOf = r => r.word ? Math.max(1, Math.ceil(r.s.length * LETTER / CELL)) : 1;
    const width = runs.reduce((n, r) => n + cellsOf(r), 0);
    let start = l.indent != null ? +l.indent : 2;
    if (l.align === 'center') start = Math.max(0, Math.floor((COLS - width) / 2));
    let h = '';
    for (let i = 0; i < start; i++) h += '<i></i>';
    runs.forEach(r => {
      const cls = r.mk ? ' nb-mark' : '';
      if (r.word) h += '<span class="nb-word' + cls + '" style="width:' + cellsOf(r) * CELL + 'px">' + esc(r.s) + '</span>';
      else h += '<i' + (cls ? ' class="' + cls.trim() + '"' : '') + '>' + (r.s === ' ' ? '' : esc(r.s)) + '</i>';
    });
    return '<div class="nb-row">' + h + '</div>';
  }

  function lineLine(l) {
    const style = l.align === 'center' ? 'text-align:center' : 'padding-left:' + (l.indent != null ? +l.indent : 1) + 'em';
    return '<div class="nb-ln" style="' + style + '">' + (l.t ? marked(l.t) : '&nbsp;') + '</div>';
  }

  function html(copy) {
    if (!copy || !Array.isArray(copy.lines) || !copy.lines.length) return '';
    const cell = copy.paper !== 'line';
    const rows = copy.lines.map(line).map(cell ? cellLine : lineLine).join('');
    const tips = Array.isArray(copy.tips) && copy.tips.length
      ? '<ul class="nb-tips">' + copy.tips.map(t => '<li>' + marked(t) + '</li>').join('') + '</ul>' : '';
    return '<div class="nb-wrap"><div class="nb ' + (cell ? 'nb-cell' : 'nb-line') + '">' + rows + '</div></div>' + tips;
  }

  window.NB = { html };
})();
