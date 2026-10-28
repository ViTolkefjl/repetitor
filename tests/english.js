// Сквозной тест заданий для английского: выбор, перетаскивание мышью и «нажми-нажми», правило, восстановление.
// Запуск: python3 -m http.server 8765 (в корне репозитория), затем node tests/english.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const BASE = 'http://localhost:8765/';
const mock = fs.readFileSync(path.join(OUT, 'mockfb.js'), 'utf8');
const log = [];
const ok = (c, m) => log.push((c ? 'PASS ' : 'FAIL ') + m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  // заглушка синтеза речи: запоминаем, что «произнесли»
  await ctx.addInitScript(() => {
    window.__said = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak: u => window.__said.push({ text: u.text, rate: u.rate, voice: u.voice && u.voice.name }), cancel() {},
      getVoices: () => [{ lang: 'en-US', name: 'Fred' }, { lang: 'en-US', name: 'Samantha' }, { lang: 'en-US', name: 'Ava (Premium)' }, { lang: 'ru-RU', name: 'Milena' }],
      addEventListener() {} } });
  });
  await ctx.route(/gstatic\.com\/firebasejs\/.*\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const errs = [];

  const T = await ctx.newPage();
  T.on('pageerror', e => errs.push('T: ' + e.message));
  await T.setViewportSize({ width: 820, height: 1180 });
  await T.goto(BASE + 'pult.html');
  await T.evaluate(() => localStorage.clear());
  await T.reload();
  await T.click('#signin');
  await T.waitForSelector('#pult:not(.hide)');
  const link = await T.textContent('#linkText');

  // готовый урок из папки lessons/
  await T.click('#newBtn');
  await T.waitForSelector('[data-ready]');
  ok((await T.textContent('#ready')).includes('местоимения'), 'готовый урок виден в списке');
  await T.click('[data-ready="0"]');
  await T.waitForSelector('#row-t11');
  ok((await T.$$('.row.theory')).length === 4, 'на пульте 4 правила свёрнуты');

  // ошибка в блоке понятна
  await T.click('#newBtn');
  await T.fill('#importText', JSON.stringify({ title: 'x', tasks: [{ type: 'choice', title: 'Т', items: [{ q: '___', options: ['a', 'b'], a: 'c' }] }] }));
  await T.click('#importBtn');
  ok((await T.textContent('#importErr')).includes('не из вариантов'), 'импорт ловит ответ не из вариантов');
  await T.click('#newBtn');

  const S = await ctx.newPage();
  S.on('pageerror', e => errs.push('S: ' + e.message));
  await S.setViewportSize({ width: 1440, height: 900 });
  await S.goto(link);
  await S.waitForSelector('.block');
  ok(!!(await S.$('#voiceSel')) && (await S.$eval('#voiceSel', e => e.value)) === 'Ava (Premium)', 'по умолчанию выбран самый живой голос (Premium)');
  ok(!(await S.$$eval('#voiceSel option', os => os.some(o => o.value === 'Milena'))), 'в списке только английские голоса');
  await S.click('.block');
  await S.waitForSelector('[data-task="t11"]');
  ok((await S.$$('.sheet.theory')).length === 4, 'у брата 4 карточки-правила');
  ok((await S.$$('#dots i')).length === 7, 'в прогрессе только 7 заданий, без правил');
  await S.screenshot({ path: path.join(OUT, 'out-en-start.png'), fullPage: true });

  const chip = (task, word) => S.locator('[data-task="' + task + '"] .wchip').filter({ hasText: new RegExp('^' + word.replace(/[!?.]/g, '\\$&') + '$') }).first();
  async function drag(task, word, slotSel) {
    await S.locator('[data-task="' + task + '"] ' + slotSel).first().scrollIntoViewIfNeeded();
    await chip(task, word).scrollIntoViewIfNeeded();
    const c = await chip(task, word).boundingBox();
    const s = await S.locator('[data-task="' + task + '"] ' + slotSel).first().boundingBox();
    await S.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await S.mouse.down();
    for (let k = 1; k <= 8; k++) await S.mouse.move(c.x + (s.x + s.width / 2 - c.x) * k / 8, c.y + (s.y + s.height / 2 - c.y) * k / 8);
    await S.mouse.up();
  }

  // правило про времена: две группы рядом, перевёртыши, озвучка, лайфхаки
  ok((await S.$$('[data-task="t9"] .vs-col')).length === 2 && !!(await S.$('[data-task="t9"] .vs-or')), 'Simple и Continuous — две колонки рядом');
  const fc = S.locator('[data-task="t9"] [data-flip]').first();
  await fc.scrollIntoViewIfNeeded();
  await fc.locator('[data-say]').click();
  let said = await S.evaluate(() => window.__said.slice(-1)[0]);
  ok(said.text === 'always' && said.rate <= 0.7 && said.voice === 'Ava (Premium)', '🔊 произносит слово медленно лучшим голосом: ' + JSON.stringify(said));
  await fc.locator('[data-say]').click();
  said = await S.evaluate(() => window.__said.slice(-1)[0]);
  ok(said.rate <= 0.5, 'повторное нажатие — ещё медленнее');
  ok(!(await fc.evaluate(e => e.classList.contains('flipped'))), '🔊 не переворачивает карточку');
  await fc.click({ position: { x: 10, y: 10 } });
  ok(await fc.evaluate(e => e.classList.contains('flipped')), 'нажатие переворачивает карточку');
  await S.waitForTimeout(500);
  ok(await fc.locator('.back').isVisible() && (await fc.locator('.back .ru').textContent()) === 'всегда', 'на обороте перевод');
  ok((await S.$$('[data-task="t9"] .trick')).length === 4 && !!(await S.$('[data-task="t9"] .how ol')), 'есть лайфхаки и «как выбрать по шагам»');
  await S.locator('[data-task="t3"] .left [data-say]').first().click();
  ok((await S.evaluate(() => window.__said.slice(-1)[0].text)) === 'I', '🔊 и в задании на пары');
  // «your / yours» — по отдельности, с паузой
  await S.evaluate(() => { window.__said = []; });
  const yy = S.locator('[data-task="t6"] [data-say="your / yours"]');
  await yy.scrollIntoViewIfNeeded();
  await yy.click();
  await S.waitForTimeout(400);
  ok((await S.evaluate(() => window.__said.map(x => x.text).join('|'))) === 'your', 'сначала только «your»');
  await S.waitForTimeout(2600);
  ok((await S.evaluate(() => window.__said.map(x => x.text).join('|'))) === 'your|yours', 'потом, после паузы, «yours»');

  // выбор
  await S.click('[data-task="t2"] .opt[data-ci="0"][data-opt="he"]');
  await S.click('[data-task="t2"] .opt[data-ci="1"][data-opt="they"]');
  await T.waitForTimeout(250);
  const rows = async id => T.$$eval('#cmp-' + id + ' tbody tr', trs => trs.map(tr => ({ cls: tr.className, cells: Array.from(tr.cells).map(c => c.textContent.trim()) })));
  let r2 = await rows('t2');
  ok(r2[0].cells[1].includes('he') && r2[0].cls === 'match', 'выбор виден учителю вживую, напротив задания');
  ok(r2[1].cells[1].includes('they') && r2[1].cls === 'miss' && r2[1].cells[2] === 'she', 'неверный выбор подсвечен, ключ в той же строке');
  ok((await T.textContent('#stText')) === 'Работает', 'статус «Работает» и при нажатиях');

  // пары: мышью
  await drag('t3', 'я', '[data-slot="m0"]');
  await drag('t3', 'мы', '[data-slot="m1"]');
  ok((await S.textContent('[data-task="t3"] [data-slot="m0"]')) === 'я', 'перетаскивание мышью кладёт в слот');
  // пары: нажми слово → нажми место
  await chip('t3', 'он').click();
  ok(await chip('t3', 'он').evaluate(e => e.classList.contains('sel')), 'нажатие выбирает слово');
  await S.click('[data-task="t3"] [data-slot="m3"]');
  ok((await S.textContent('[data-task="t3"] [data-slot="m3"]')) === 'он', 'нажми-нажми кладёт в слот');
  // замена в занятом слоте: старое слово возвращается в банк
  await drag('t3', 'она', '[data-slot="m0"]');
  ok((await S.textContent('[data-task="t3"] [data-slot="m0"]')) === 'она', 'новое слово заменяет старое');
  ok((await S.$$eval('[data-task="t3"] [data-slot="B"] .wchip', els => els.map(e => e.textContent))).includes('я'), 'вытесненное слово вернулось в банк');
  await drag('t3', 'я', '[data-slot="m0"]');
  await drag('t3', 'она', '[data-slot="m4"]');
  await drag('t3', 'ты, вы', '[data-slot="m2"]');
  await drag('t3', 'они', '[data-slot="m5"]');
  await T.waitForTimeout(250);
  ok((await rows('t3')).every(r => r.cls === 'match'), 'пары собраны верно — все строки совпали');

  // слово в пропуск (одно намеренно неверно)
  await drag('t5', 'me', '[data-slot="g0"]');
  await drag('t5', 'us', '[data-slot="g1"]');
  await drag('t5', 'her', '[data-slot="g2"]');
  await drag('t5', 'them', '[data-slot="g3"]');
  await T.waitForTimeout(250);
  const r5 = await rows('t5');
  ok(r5[2].cls === 'miss' && r5[2].cells[1].includes('her') && r5[2].cells[2] === 'him' && r5[0].cls === 'match', 'пропуски: каждое слово напротив своего предложения и ключа');

  // собери предложение: нажатиями по порядку
  for (const w of ['Mum', 'loves', 'me']) await chip('t8', w).click();
  // второе — мышью, с вставкой перед словом
  await drag('t8', 'cat', '[data-slot="L1"]');
  await drag('t8', 'is', '[data-slot="L1"]');
  await drag('t8', 'mine', '[data-slot="L1"]');
  // «The» вставляем перед «cat»
  {
    const c = await chip('t8', 'The').boundingBox();
    const tgt = await S.locator('[data-task="t8"] [data-slot="L1"] .wchip').filter({ hasText: /^cat$/ }).boundingBox();
    await S.mouse.move(c.x + 5, c.y + 5); await S.mouse.down();
    for (let k = 1; k <= 8; k++) await S.mouse.move(c.x + (tgt.x + 4 - c.x) * k / 8, c.y + (tgt.y + 6 - c.y) * k / 8);
    await S.mouse.up();
  }
  ok((await S.textContent('[data-task="t8"] [data-slot="L1"]')) === 'Thecatismine', 'вставка перед словом работает');
  // слово из чужого предложения в строку не попадает
  await drag('t8', 'This', '[data-slot="L0"]');
  ok(!(await S.textContent('[data-task="t8"] [data-slot="L0"]')).includes('This'), 'чужое слово в строку не кладётся');
  // нажатие на слово в строке возвращает его
  await S.locator('[data-task="t8"] [data-slot="L0"] .wchip').filter({ hasText: /^me$/ }).click();
  ok((await S.textContent('[data-task="t8"] [data-slot="L0"]')) === 'Mumloves', 'нажатие возвращает слово из строки');
  await chip('t8', 'me').click();
  await T.waitForTimeout(250);
  ok((await T.textContent('#cmp-t8')).includes('Mum loves me.'), 'учитель видит собранное предложение');

  // по группам
  await drag('t10', 'now', '[data-slot="G1"]');
  await drag('t10', 'always', '[data-slot="G0"]');
  await drag('t10', 'never', '[data-slot="G1"]');
  await T.waitForTimeout(250);
  const r10 = await rows('t10');
  ok(r10.find(r => r.cells[0] === 'never').cls === 'miss' && r10.some(r => r.cells[1] === '—'), 'группы: ошибка и неразложенные видны');

  // лесенка на выборе
  await S.click('[data-task="t11"] .opt[data-ci="0"][data-opt="reads"]');
  await S.click('[data-task="t11"] .opt[data-ci="1"][data-opt="reads"]');
  await S.click('[data-check="t11"]');
  ok((await S.textContent('#fb-t11')).includes('Верно 1 из 2'), 'выбор, шаг 1: счёт');
  ok((await S.textContent('#fb-t11 .alt')).includes('Объясню по-другому') && (await S.textContent('#fb-t11 .alt')).includes('мороженое'), 'шаг 1: другое объяснение, а не «перечитай правило»');
  await S.click('[data-check="t11"]');
  ok(await S.$eval('[data-task="t11"] .choice-item:nth-child(1)', e => e.classList.contains('fb-ok')), 'выбор, шаг 2: верное зелёное');
  await S.click('[data-task="t11"] .opt[data-ci="0"][data-opt="is reading"]');
  ok(await S.$eval('[data-task="t11"] .opt[data-ci="0"][data-opt="reads"]', e => e.classList.contains('on')), 'выбор, шаг 2: зелёное не переключить');
  await S.click('[data-check="t11"]');
  ok((await S.textContent('[data-task="t11"]')).includes('Правильно: is reading'), 'выбор, шаг 3: правильный ответ');
  ok((await S.textContent('#fb-t11')).includes('Запомни так'), 'шаг 3: повторяем объяснение «запомни так»');
  // перетаскивание: шаг 2 закрепляет верные слова
  await drag('t10', 'always', '[data-slot="G0"]');
  for (const w of ['Look!', 'at the moment', 'Listen!']) await drag('t10', w, '[data-slot="G1"]');
  for (const w of ['every day', 'sometimes']) await drag('t10', w, '[data-slot="G0"]');
  await S.click('[data-check="t10"]');
  await S.click('[data-check="t10"]');
  ok(await chip('t10', 'now').evaluate(e => e.classList.contains('fb-ok')), 'группы, шаг 2: верное слово зелёное');
  ok(await chip('t10', 'never').evaluate(e => e.classList.contains('fb-bad')), 'группы, шаг 2: ошибка выделена');
  await drag('t10', 'now', '[data-slot="B"]');
  ok((await S.textContent('[data-task="t10"] [data-slot="G1"]')).includes('now'), 'группы, шаг 2: зелёное не утащить');
  await drag('t10', 'never', '[data-slot="G0"]');
  await S.click('[data-check="t10"]');
  ok((await S.textContent('#fb-t10')).includes('Верно!'), 'исправил ошибку — «Верно!»');

  await T.screenshot({ path: path.join(OUT, 'out-en-teacher.png'), fullPage: true });
  await S.screenshot({ path: path.join(OUT, 'out-en-student.png'), fullPage: true });

  // отметка «верно» блокирует перетаскивание
  await T.click('[data-mark="ok"][data-t="t3"]');
  await S.waitForTimeout(300);
  ok(await S.$eval('[data-task="t3"] .board', e => e.classList.contains('locked')), 'после «Верно» доска закрыта');
  await drag('t3', 'я', '[data-slot="B"]');
  ok((await S.textContent('[data-task="t3"] [data-slot="m0"]')) === 'я', 'закрытую доску не изменить');
  await T.click('[data-mark="ok"][data-t="t2"]');
  await S.waitForTimeout(300);
  ok(await S.$eval('[data-task="t2"] .choice-list', e => e.classList.contains('locked')), 'после «Верно» выбор закрыт');

  // перезагрузка: всё на местах
  await S.reload();
  await S.waitForSelector('[data-task="t11"]');
  ok((await S.textContent('[data-task="t3"] [data-slot="m2"]')) === 'ты, вы', 'пары восстановлены после перезагрузки');
  ok((await S.textContent('[data-task="t8"] [data-slot="L1"]')) === 'Thecatismine', 'порядок слов восстановлен');
  ok((await S.textContent('[data-task="t5"] [data-slot="g2"]')) === 'her', 'пропуски восстановлены');
  ok(await S.$eval('[data-task="t2"] .opt[data-ci="0"][data-opt="he"]', e => e.classList.contains('on')), 'выбор восстановлен');
  ok((await S.$$eval('[data-task="t10"] [data-slot="G1"] .wchip', els => els.map(e => e.textContent).sort().join(','))) === 'Listen!,Look!,at the moment,now', 'группы восстановлены');

  // планшет/телефон: перетаскивание пальцем
  const ctx2 = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await ctx2.route(/gstatic\.com\/firebasejs\/.*\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const P = await ctx2.newPage();
  P.on('pageerror', e => errs.push('P: ' + e.message));
  await P.goto(BASE + 'style.css');
  await P.evaluate(s => localStorage.setItem('mockdb', s), await S.evaluate(() => localStorage.getItem('mockdb')));
  await P.goto(link); await P.waitForSelector('.block'); await P.tap('.block'); await P.waitForSelector('[data-task="t11"]');
  await P.locator('[data-task="t5"] [data-slot="g2"] .wchip').tap();
  await P.locator('[data-task="t5"] .wchip').filter({ hasText: /^him$/ }).tap();
  await P.locator('[data-task="t5"] [data-slot="g2"]').tap();
  ok((await P.textContent('[data-task="t5"] [data-slot="g2"]')) === 'him', 'касанием на телефоне тоже работает');
  ok(!(await P.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'на узком экране нет горизонтальной прокрутки');
  await P.screenshot({ path: path.join(OUT, 'out-en-phone.png'), fullPage: false });

  errs.forEach(e => log.push('JSERR ' + e));
  console.log(log.join('\n'));
  console.log(log.filter(l => !l.startsWith('PASS')).length ? 'HAS FAILURES' : 'ALL ENGLISH OK');
  await browser.close();
})().catch(e => { console.log(log.join('\n')); console.error(e); process.exit(1); });
