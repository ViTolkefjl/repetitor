const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const BASE = 'http://localhost:8765/';
const mock = fs.readFileSync(path.join(OUT, 'mockfb.js'), 'utf8');

const sample = {
  title: 'Домашка на 29 октября',
  tasks: [
    { subject: 'Математика', title: '№ 245, стр. 61', text: 'Вычисли.', type: 'short',
      items: [{ q: '36 : 4 =', a: '9' }, { q: '7 · 8 =', a: '56' }], hint: 'Вспомни таблицу умножения.' },
    { subject: 'Математика', title: 'Задача № 247', text: 'Мотоциклист проехал 3 часа по 4 км в час. Сколько километров он проехал?\nЗапиши решение и ответ.', type: 'steps', answer: '12 км' },
    { subject: 'Русский язык', title: 'Упр. 112', text: 'Вставь пропущенные буквы.', type: 'letters', template: 'к_рова, м_л_ко, б_рёза', answer: 'корова, молоко, берёза' },
    { subject: 'Окружающий мир', title: 'Вопрос 3, стр. 40', text: 'Какая планета ближе всех к Солнцу?', type: 'short', answer: 'Меркурий' }
  ]
};

const log = [];
const ok = (cond, msg) => { log.push((cond ? 'PASS ' : 'FAIL ') + msg); };

async function prep(ctx) {
  await ctx.route(/gstatic\.com\/firebasejs\/.*\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
}

(async () => {
  const browser = await chromium.launch();
  // общий localStorage нужен обеим страницам -> один контекст, разные страницы
  const ctx = await browser.newContext();
  await prep(ctx);
  const T = await ctx.newPage();
  const errs = [];
  T.on('pageerror', e => errs.push('T: ' + e.message));
  await T.setViewportSize({ width: 820, height: 1180 });
  await T.goto(BASE + 'pult.html');
  await T.click('#signin');
  await T.waitForSelector('#pult:not(.hide)');
  const link = await T.textContent('#linkText');
  ok(/s\.html#k=[a-z0-9]{24}$/.test(link), 'ссылка ученика: ' + link);

  // ошибка импорта
  await T.click('#newBtn');
  await T.fill('#importText', 'привет');
  await T.click('#importBtn');
  ok((await T.textContent('#importErr')).includes('фигурных'), 'ошибка импорта понятна');
  await T.fill('#importText', 'Вот блок:\n```json\n' + JSON.stringify(sample, null, 2) + '\n```');
  await T.click('#importBtn');
  await T.waitForSelector('#row-t4');
  ok(true, 'занятие импортировано, 4 задания');

  const S = await ctx.newPage();
  S.on('pageerror', e => errs.push('S: ' + e.message));
  await S.setViewportSize({ width: 1440, height: 900 });
  await S.goto(link);
  await S.waitForSelector('[data-task="t4"]');
  ok((await S.$$('.sheet')).length === 4, 'у ученика 4 карточки');
  await S.screenshot({ path: path.join(OUT, 'out-s-empty.png'), fullPage: true });

  ok(await S.$$eval('[data-key]', els => els.every(e => e.getAttribute('autocorrect') === 'off' && e.getAttribute('spellcheck') === 'false')), 'автозамена Safari выключена во всех полях');
  await S.focus('[data-key="t1:0"]');
  await S.keyboard.press('Enter');
  ok(await S.evaluate(() => document.activeElement.dataset.key) === 't1:1', 'Enter переводит к следующему полю');
  // ученик печатает
  await S.fill('[data-key="t1:0"]', '9');
  await S.type('[data-key="t1:1"]', '54', { delay: 60 });
  await T.waitForTimeout(300);
  const live1 = await T.textContent('#live-t1');
  ok(live1.includes('54'), 'учитель видит ввод вживую: ' + live1.replace(/\s+/g, ' '));
  ok((await T.textContent('#chips-t1')).includes('не совпало'), 'автосверка ловит 7·8=54');
  ok((await T.textContent('#stText')) === 'Печатает', 'статус «Печатает»: ' + await T.textContent('#stText'));
  ok(await T.$eval('#row-t1', e => e.classList.contains('typing-now')), 'подсветка текущего задания');

  const gaps = await S.$$('[data-task="t3"] .gap');
  await gaps[0].focus();
  for (const ch of ['о', 'а', 'о', 'е']) await S.keyboard.type(ch, { delay: 40 });
  await S.fill('[data-key="t2"]', '4 · 3 = 12 (км)\nОтвет: 12 км');
  await S.click('[data-hint="t1"]');
  await S.type('[data-key="t4"]', 'меркурий', { delay: 30 });
  await T.waitForTimeout(400);
  const live3 = await T.innerHTML('#live-t3');
  ok(/class="bad">а</.test(live3), 'в пропусках неверная буква подсвечена');
  ok((await T.textContent('#chips-t2')).includes('совпало с ключом'), 'ход решения совпал с итогом');
  ok((await T.textContent('#chips-t4')).includes('совпало с ключом'), 'регистр не мешает (меркурий)');
  ok((await T.textContent('#chips-t1')).includes('открыл подсказку'), 'видно открытую подсказку');
  await T.screenshot({ path: path.join(OUT, 'out-t-live.png'), fullPage: true });

  // отметки
  await T.fill('#cmt-t1', 'Проверь 7 · 8');
  await T.click('[data-mark="fix"][data-t="t1"]');
  await T.click('[data-mark="fix"][data-t="t3"]');
  await T.click('[data-mark="ok"][data-t="t2"]');
  await T.click('[data-mark="ok"][data-t="t4"]');
  await S.waitForTimeout(300);
  ok((await S.textContent('#mark-t1')).includes('Проверь 7 · 8'), 'ученик видит комментарий');
  ok(await S.$eval('[data-key="t2"]', e => e.readOnly), 'верное задание закрыто от правок');
  ok(await S.$eval('#done', e => e.classList.contains('hide')), 'баннера пока нет');
  await S.screenshot({ path: path.join(OUT, 'out-s-marked.png'), fullPage: true });

  // исправляет
  await S.fill('[data-key="t1:1"]', '56');
  const g2 = (await S.$$('[data-task="t3"] .gap'))[1];
  await g2.fill('о');
  await g2.dispatchEvent('input');
  await T.waitForTimeout(300);
  ok((await T.textContent('#chips-t1')).includes('изменил после отметки'), 'видно правку после отметки');
  ok((await T.textContent('#chips-t3')).includes('совпало с ключом'), 'буквы исправлены и совпали');
  await T.click('[data-mark="ok"][data-t="t1"]');
  await T.click('[data-mark="ok"][data-t="t3"]');
  await S.waitForTimeout(300);
  ok(!(await S.$eval('#done', e => e.classList.contains('hide'))), 'баннер «переписывай в тетрадь»');
  ok((await T.textContent('#mDone')) === '4 из 4', 'счётчик верных: ' + await T.textContent('#mDone'));

  // бездействие
  await T.waitForTimeout(6000);
  ok(['Думает', 'Бездействует'].includes(await T.textContent('#stText')), 'после паузы статус: ' + await T.textContent('#stText'));

  // уход в другое окно
  await S.evaluate(() => { Object.defineProperty(document, 'hasFocus', { value: () => false }); window.dispatchEvent(new Event('blur')); });
  await T.waitForTimeout(400);
  ok((await T.textContent('#stText')) === 'Ушёл в другое окно', 'уход в другое окно: ' + await T.textContent('#stText'));

  // учитель теряет связь
  await T.evaluate(() => window.__setConnected(false));
  await T.waitForTimeout(1000);
  ok((await T.textContent('#stText')) !== 'Нет связи', 'короткий обрыв не пугает статусом');
  await T.waitForTimeout(2600);
  ok((await T.textContent('#stText')) === 'Нет связи', 'долгий обрыв: «Нет связи»');
  await T.evaluate(() => window.__setConnected(true));
  await T.waitForTimeout(1100);
  ok((await T.textContent('#stText')) !== 'Нет связи', 'связь вернулась — статус обновился');
  ok(await S.$eval('#net', e => e.classList.contains('hide')), 'у ученика нет ложной плашки «Нет связи»');
  // ручное задание, пока ученик печатает в поле — фокус не должен слететь
  await S.evaluate(() => { delete document.hasFocus; });
  await S.click('[data-key="t4"]');
  await T.selectOption('#fType', 'items');
  await T.fill('#fTitle', '№ 250');
  await T.fill('#fItems', '10 + 5 = | 15\n20 - 7 = | 13');
  await T.click('#fAdd');
  await S.waitForSelector('[data-key$=":1"][data-key^="t"]');
  await S.waitForTimeout(300);
  ok((await S.$$('.sheet')).length === 5, 'вручную добавленное задание появилось у ученика');
  ok(await S.$eval('#hint-t1', e => !e.classList.contains('hide')), 'подсказка не пропала после пересборки');

  ok(await S.evaluate(() => document.activeElement && document.activeElement.dataset.key) === 't4', 'фокус ученика сохранился при добавлении задания');
  // ученик после перезагрузки видит свои ответы
  await S.reload();
  await S.waitForSelector('[data-task="t4"]');
  ok((await S.inputValue('[data-key="t4"]')) === 'меркурий', 'ответы сохраняются после перезагрузки');

  // плохая ссылка
  const S2 = await ctx.newPage();
  await S2.goto(BASE + 's.html');
  ok((await S2.textContent('h1')).includes('ссылка'), 'без ключа — просьба о ссылке');

  await S.screenshot({ path: path.join(OUT, 'out-s-done.png'), fullPage: true });
  await T.screenshot({ path: path.join(OUT, 'out-t-done.png'), fullPage: false });
  await T.setViewportSize({ width: 390, height: 844 });
  await T.screenshot({ path: path.join(OUT, 'out-t-phone.png'), fullPage: false });
  const overflow = await T.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, 'нет горизонтальной прокрутки на узком экране');

  errs.forEach(e => log.push('JSERR ' + e));
  console.log(log.join('\n'));
  await browser.close();
})().catch(e => { console.log(log.join('\n')); console.error(e); process.exit(1); });
