// Сквозной сценарий «домашка»: блоки, живой ввод, самопроверка с лесенкой подсказок, отметки учителя,
// завершение блока, живое добавление заданий, статусы, тетрадь, переход со старого формата.
// Запуск: python3 -m http.server 8765 (в корне репозитория), затем node tests/run.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const BASE = 'http://localhost:8765/';
const mock = fs.readFileSync(path.join(OUT, 'mockfb.js'), 'utf8');

const math = {
  title: 'Математика на 29 октября',
  tasks: [
    { subject: 'Математика', title: '№ 245, стр. 61', text: 'Вычисли.', type: 'short',
      items: [{ q: '36 : 4 =', a: '9' }, { q: '7 · 8 =', a: '56', why: 'Вспомни: 7 · 8 — это 7 раз по 8.' }],
      why: 'Проверь по таблице умножения.' },
    { subject: 'Математика', title: 'Задача № 247', text: 'Мотоциклист ехал 3 часа по 4 км в час. Сколько км он проехал?', type: 'steps', answer: '12 км',
      copy: { paper: 'cell', lines: [{ t: '29 октября', align: 'center' }, { t: 'Домашняя работа', align: 'center' }, '', '№ 247', '4 · 3 = 12 (км)', 'Ответ: [[12 км]].'], tips: ['Между заданиями пропусти 2 клетки вниз.'] } },
    { subject: 'Русский язык', title: 'Упр. 112', text: 'Вставь пропущенные буквы.', type: 'letters', template: 'к_рова, м_л_ко', answer: 'корова, молоко', why: 'Безударную гласную проверяй ударением.' },
    { subject: 'Окружающий мир', title: 'Вопрос 3', text: 'Какая планета ближе всех к Солнцу?', type: 'short', answer: 'Меркурий' }
  ]
};

const log = [];
const ok = (c, m) => log.push((c ? 'PASS ' : 'FAIL ') + m);

async function ctxWith(browser, opts) {
  const ctx = await browser.newContext(opts || {});
  await ctx.route(/gstatic\.com\/firebasejs\/.*\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return ctx;
}

(async () => {
  const browser = await chromium.launch();
  const errs = [];

  /* ---------- переход со старого формата ---------- */
  {
    const ctx = await ctxWith(browser);
    const P = await ctx.newPage();
    P.on('pageerror', e => errs.push('M: ' + e.message));
    await P.goto(BASE + 'style.css');
    const room = 'oldroomoldroomoldroom123';
    await P.evaluate(r => localStorage.setItem('mockdb', JSON.stringify({
      owner: 'teacher-uid', teacher: { room: r },
      keys: { [r]: { L1: { t1: '5' } } },
      rooms: { [r]: { meta: { created: 1 }, current: 'L1', lessons: { L1: { title: 'Старое', created: 1, tasks: { t1: { n: 1, type: 'short', title: 'Т' } } } } } }
    })), room);
    await P.goto(BASE + 'pult.html');
    await P.click('#signin');
    await P.waitForSelector('#pult:not(.hide)');
    await P.waitForTimeout(400);
    const db = await P.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));
    ok(db.rooms[room].open && db.rooms[room].open.L1 === true && !db.rooms[room].current, 'старое «текущее» занятие стало открытым блоком');
    ok(db.rooms[room].check && db.rooms[room].check.L1 && db.rooms[room].check.L1.t1, 'для старого занятия появился ключ самопроверки');
    await ctx.close();
  }

  const ctx = await ctxWith(browser);
  const T = await ctx.newPage();
  T.on('pageerror', e => errs.push('T: ' + e.message));
  await T.setViewportSize({ width: 820, height: 1180 });
  await T.goto(BASE + 'pult.html');
  await T.click('#signin');
  await T.waitForSelector('#pult:not(.hide)');
  const link = await T.textContent('#linkText');

  await T.click('#newBtn');
  await T.fill('#importText', 'Вот блок:\n```json\n' + JSON.stringify(math, null, 2) + '\n```');
  await T.click('#importBtn');
  await T.waitForSelector('#row-t4');
  ok(true, 'блок математики создан');
  ok(await T.$eval('.teacher', b => getComputedStyle(b).fontFamily.includes('Golos')), 'у учителя обычный шрифт');

  const S = await ctx.newPage();
  S.on('pageerror', e => errs.push('S: ' + e.message));
  await S.setViewportSize({ width: 1440, height: 900 });
  await S.goto(link);
  await S.waitForSelector('.block');
  ok((await S.textContent('.block')).includes('Математика'), 'у брата на главном экране — блок');
  await T.waitForTimeout(200);
  ok((await T.textContent('#stText')) === 'Выбирает блок', 'учитель видит: выбирает блок');
  await S.click('.block');
  await S.waitForSelector('[data-task="t4"]');

  // живой ввод + ключи напротив
  await S.fill('[data-key="t1:0"]', '9');
  await S.type('[data-key="t1:1"]', '54', { delay: 40 });
  await T.waitForTimeout(250);
  const row2 = await T.$$eval('#cmp-t1 tbody tr', trs => trs.map(tr => Array.from(tr.cells).map(c => c.textContent.trim())));
  ok(row2[1][0] === '7 · 8 =' && row2[1][1].includes('54') && row2[1][2] === '56', 'ответ брата и ключ в одной строке: ' + JSON.stringify(row2[1]));
  ok(!(await T.$eval('#cmp-t1 td.kcol', e => getComputedStyle(e).display !== 'none')), 'ключ скрыт, пока не попросишь');
  await T.click('#keysBtn');
  ok(await T.$eval('#cmp-t1 td.kcol', e => getComputedStyle(e).display !== 'none'), 'кнопка «Показать ключи» открывает колонку ключа');
  ok((await T.textContent('#stText')) === 'Работает', 'статус «Работает»');
  ok((await T.textContent('#stSub')).includes('Математика'), 'видно, в каком блоке брат');

  // лесенка: 1-я проверка
  await S.click('[data-check="t1"]');
  await S.waitForTimeout(150);
  let fb = await S.textContent('#fb-t1');
  ok(fb.includes('Верно 1 из 2') && fb.includes('одну ошибку'), 'шаг 1: счёт без указания, где ошибка');
  ok(!(await S.$('[data-task="t1"] .fb-bad')), 'шаг 1: ошибка не подсвечена');
  ok(fb.includes('таблице умножения'), 'шаг 1: напоминание правила');
  // 2-я
  await S.click('[data-check="t1"]');
  await S.waitForTimeout(150);
  ok(await S.$eval('[data-task="t1"] .item-wrap:nth-child(1)', e => e.classList.contains('fb-ok')), 'шаг 2: верное зелёное');
  ok(await S.$eval('[data-key="t1:0"]', e => e.readOnly), 'шаг 2: верное закреплено');
  ok(await S.$eval('[data-task="t1"] .item-wrap:nth-child(2)', e => e.classList.contains('fb-bad')), 'шаг 2: ошибка подсвечена');
  ok((await S.textContent('[data-task="t1"] .item-wrap:nth-child(2)')).includes('7 раз по 8'), 'шаг 2: объяснение «почему» у ошибки');
  ok(!(await S.textContent('[data-task="t1"]')).includes('Правильно:'), 'шаг 2: ответ не показан');
  await T.waitForTimeout(200);
  ok((await T.textContent('#auto-t1')).includes('попытка 2 из 3'), 'учитель видит номер попытки');
  // 3-я
  await S.click('[data-check="t1"]');
  await S.waitForTimeout(150);
  ok((await S.textContent('[data-task="t1"]')).includes('Правильно: 56'), 'шаг 3: показан правильный ответ');
  ok((await S.textContent('#fb-t1')).includes('Разобрали вместе'), 'шаг 3: «разобрали вместе»');
  ok(await S.$eval('[data-key="t1:1"]', e => e.readOnly), 'шаг 3: задание закрыто');
  await T.waitForTimeout(200);
  ok((await T.textContent('#auto-t1')).includes('с подсказкой'), 'учитель видит «с подсказкой»');

  // буквы — верно с первого раза
  const gaps = await S.$$('[data-task="t3"] .gap');
  await gaps[0].focus();
  for (const ch of ['о', 'о', 'о']) await S.keyboard.type(ch, { delay: 30 });
  await S.click('[data-check="t3"]');
  await S.waitForTimeout(150);
  ok((await S.textContent('#fb-t3')).includes('Верно!'), 'буквы: сразу «Верно!»');
  await T.waitForTimeout(200);
  ok((await T.textContent('#auto-t3')).includes('с первого раза'), 'учитель: «сам проверил — с первого раза»');

  // пустое — не проверяется
  await S.click('[data-check="t4"]');
  ok((await S.textContent('#msg-t4')).includes('Сначала'), 'пустой ответ: просьба сначала ответить');
  await S.fill('[data-key="t4"]', 'меркурий');
  await S.click('[data-check="t4"]');
  await S.waitForTimeout(150);
  ok((await S.textContent('#fb-t4')).includes('Верно!'), 'короткий ответ без учёта регистра — верно');

  // задача: ответ сходится → ждёт учителя
  await S.fill('[data-key="t2"]', '4 · 3 = 12 (км)\nОтвет: 12км.');
  await S.click('[data-check="t2"]');
  await S.waitForTimeout(150);
  ok((await S.textContent('#fb-t2')).includes('Ответ сходится'), 'задача: «ответ сходится, учитель посмотрит»');
  await T.waitForTimeout(200);
  ok((await T.textContent('#auto-t2')).includes('посмотри запись'), 'учитель: просьба посмотреть запись');
  // «Доработать» без комментария нельзя
  await T.click('[data-mark="fix"][data-t="t2"]');
  ok(await T.$eval('#cmt-t2', e => e.classList.contains('need')), '«Доработать» без комментария не отправляется');
  await T.fill('#cmt-t2', 'Напиши наименование в скобках у действия');
  await T.click('[data-mark="fix"][data-t="t2"]');
  await S.waitForTimeout(250);
  ok((await S.textContent('#fb-t2')).includes('Напиши наименование'), 'брат видит, что именно доработать');
  ok(!(await S.$eval('[data-key="t2"]', e => e.readOnly)), 'после «Доработать» можно править');
  ok((await S.textContent('#finish')).includes('Осталось 1'), 'кнопка «Завершить» ждёт: осталось 1 задание');
  await S.fill('[data-key="t2"]', '4 · 3 = 12 (км)\nОтвет: 12 км.');
  await S.click('[data-check="t2"]');
  await T.waitForTimeout(250);
  ok((await T.textContent('#auto-t2')).includes('посмотри запись'), 'после правки снова ждёт учителя');
  await T.click('[data-mark="ok"][data-t="t2"]');
  await S.waitForTimeout(250);
  ok((await S.textContent('#fb-t2')).includes('Верно!'), 'учитель подтвердил — брат видит «Верно»');

  // тетрадь
  ok(!!(await S.$('#nb-t2 [data-nb]')), 'появилась кнопка «Как записать в тетрадь»');
  await S.click('#nb-t2 [data-nb]');
  ok((await S.$$('#nb-t2 .nb-row')).length === 6, 'образец записи нарисован по клеткам');
  ok((await S.$$eval('#nb-t2 .nb-row:nth-child(1) i', els => els.filter(e => e.textContent).map(e => e.textContent).join(''))) === '29', 'цифры — по одной в клетке');
  ok((await S.textContent('#nb-t2 .nb-row:nth-child(1) .nb-word')) === 'октября', 'слова пишутся слитно');
  ok((await S.$$eval('#nb-t2 .nb-word', els => els.every(e => e.getBoundingClientRect().width % 24 === 0))), 'слова занимают целое число клеток');
  await S.screenshot({ path: path.join(OUT, 'out-s-math.png'), fullPage: true });
  await T.screenshot({ path: path.join(OUT, 'out-t-math.png'), fullPage: true });

  // живое добавление задания в открытый блок
  await T.selectOption('#fType', 'short');
  await T.fill('#fTitle', '№ 250');
  await T.fill('#fText', '10 + 5 =');
  await T.fill('#fAns', '15');
  await T.click('#fAdd');
  await S.waitForSelector('[data-task^="t"]:nth-of-type(5)', { timeout: 3000 }).catch(() => {});
  await S.waitForTimeout(300);
  ok((await S.$$('.sheet')).length === 5, 'новое задание появилось у брата без перезагрузки');
  ok((await S.textContent('#finish')).includes('Осталось 1'), 'и «Завершить» снова ждёт');
  await S.fill('.sheet:last-of-type [data-key]', '15');
  await S.click('.sheet:last-of-type [data-check]');
  await S.waitForTimeout(200);

  // второй блок, пока брат в первом
  await T.click('#newBtn');
  await T.fill('#importText', JSON.stringify({ title: 'Русский на 29 октября', tasks: [{ subject: 'Русский язык', title: 'Упр. 5', type: 'short', text: 'Слово', answer: 'кот' }] }));
  await T.click('#importBtn');
  await S.waitForTimeout(400);
  ok((await S.textContent('#toast')).includes('Русский'), 'брату пришло: учитель добавил блок');

  // завершение
  ok(!!(await S.$('[data-finish]')), 'всё зелёное — можно завершить');
  await S.click('[data-finish]');
  await S.waitForSelector('.block');
  ok((await S.$$('.block')).length === 2, 'на главном экране два блока');
  ok((await S.textContent('.block.done')).includes('Завершено'), 'первый блок отмечен завершённым');
  await T.waitForTimeout(300);
  ok((await T.textContent('#lessonList')).includes('завершён'), 'учитель видит «завершён»');
  await S.screenshot({ path: path.join(OUT, 'out-s-home.png') });

  // статусы
  await S.click('.block:not(.done)');
  await S.waitForSelector('[data-task="t1"]');
  await T.waitForTimeout(250);
  ok((await T.textContent('#stSub')).includes('Русский'), 'учитель видит переход в другой блок');
  await S.evaluate(() => { Object.defineProperty(document, 'hasFocus', { value: () => false, configurable: true }); window.dispatchEvent(new Event('blur')); });
  await T.waitForTimeout(300);
  ok((await T.textContent('#stText')) === 'Ушёл в другое окно', 'уход в другое окно');
  await S.evaluate(() => { delete document.hasFocus; window.dispatchEvent(new Event('focus')); });
  await T.evaluate(() => window.__setConnected(false));
  await T.waitForTimeout(3400);
  ok((await T.textContent('#stText')) === 'Нет связи', 'долгий обрыв: «Нет связи»');
  await T.evaluate(() => window.__setConnected(true));
  await T.waitForTimeout(1100);
  ok((await T.textContent('#stText')) !== 'Нет связи', 'связь вернулась');

  // скрыть блок у брата
  await T.click('[data-view]:not(.done)');
  await T.waitForSelector('[data-open="0"]');
  await T.click('[data-open="0"]');
  await S.waitForTimeout(300);
  ok(!!(await S.$('.block')), 'скрытый блок закрылся у брата — он на главном экране');
  ok((await S.$$('.block')).length === 1, 'остался один блок');

  // без ключа ссылки
  const S2 = await ctx.newPage();
  await S2.goto(BASE + 's.html');
  ok((await S2.textContent('h1')).includes('ссылка'), 'без ключа — просьба о ссылке');

  await T.setViewportSize({ width: 390, height: 844 });
  ok(!(await T.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'пульт без горизонтальной прокрутки на узком экране');

  errs.forEach(e => log.push('JSERR ' + e));
  console.log(log.join('\n'));
  console.log(log.filter(l => !l.startsWith('PASS')).length ? 'HAS FAILURES' : 'ALL HOMEWORK OK');
  await browser.close();
})().catch(e => { console.log(log.join('\n')); console.error(e); process.exit(1); });
