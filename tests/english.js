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

  // выбор
  await S.click('[data-task="t2"] .opt[data-ci="0"][data-opt="he"]');
  await S.click('[data-task="t2"] .opt[data-ci="1"][data-opt="they"]');
  await T.waitForTimeout(250);
  ok((await T.textContent('#live-t2')).includes('Tom → he'), 'выбор виден учителю вживую');
  ok((await T.innerHTML('#live-t2')).includes('class="bad">they'), 'неверный выбор подсвечен');
  ok((await T.textContent('#stText')) === 'Печатает', 'статус «Печатает» и при нажатиях');

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
  ok((await T.textContent('#chips-t3')).includes('совпало с ключом'), 'пары собраны верно — ключ совпал');

  // слово в пропуск (одно намеренно неверно)
  await drag('t5', 'me', '[data-slot="g0"]');
  await drag('t5', 'us', '[data-slot="g1"]');
  await drag('t5', 'her', '[data-slot="g2"]');
  await drag('t5', 'them', '[data-slot="g3"]');
  await T.waitForTimeout(250);
  const l5 = await T.innerHTML('#live-t5');
  ok(/class="bad">her/.test(l5) && /class="good">me/.test(l5), 'в пропусках видно верные и неверные слова');

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
  ok((await T.textContent('#live-t8')).includes('Mum loves me.'), 'учитель видит собранное предложение');

  // по группам
  await drag('t10', 'now', '[data-slot="G1"]');
  await drag('t10', 'always', '[data-slot="G0"]');
  await drag('t10', 'never', '[data-slot="G1"]');
  await T.waitForTimeout(250);
  const l10 = await T.innerHTML('#live-t10');
  ok(/class="bad">never/.test(l10) && /не разложены/.test(l10), 'группы: ошибка и неразложенные видны');

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
  ok((await S.$$eval('[data-task="t10"] [data-slot="G1"] .wchip', els => els.map(e => e.textContent).sort().join(','))) === 'never,now', 'группы восстановлены');

  // планшет/телефон: перетаскивание пальцем
  const ctx2 = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await ctx2.route(/gstatic\.com\/firebasejs\/.*\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const P = await ctx2.newPage();
  P.on('pageerror', e => errs.push('P: ' + e.message));
  await P.goto(BASE + 'style.css');
  await P.evaluate(s => localStorage.setItem('mockdb', s), await S.evaluate(() => localStorage.getItem('mockdb')));
  await P.goto(link); await P.waitForSelector('[data-task="t11"]');
  await P.locator('[data-task="t10"] .wchip').filter({ hasText: /^every day$/ }).tap();
  await P.locator('[data-task="t10"] [data-slot="G0"]').tap();
  ok((await P.textContent('[data-task="t10"] [data-slot="G0"]')).includes('every day'), 'касанием на телефоне тоже работает');
  ok(!(await P.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'на узком экране нет горизонтальной прокрутки');
  await P.screenshot({ path: path.join(OUT, 'out-en-phone.png'), fullPage: false });

  errs.forEach(e => log.push('JSERR ' + e));
  console.log(log.join('\n'));
  console.log(log.filter(l => !l.startsWith('PASS')).length ? 'HAS FAILURES' : 'ALL ENGLISH OK');
  await browser.close();
})().catch(e => { console.log(log.join('\n')); console.error(e); process.exit(1); });
