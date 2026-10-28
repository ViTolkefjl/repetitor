// Обновление уже созданного блока до новой версии готового урока: ответы и порядок слов сохраняются.
// Запуск: python3 -m http.server 8765 (в корне репозитория), затем node tests/update.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:8765/';
const mock = fs.readFileSync(path.join(__dirname, 'mockfb.js'), 'utf8');
const v1 = fs.readFileSync(path.join(__dirname, 'fixture-pronouns-v1.json'), 'utf8');
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
  T.on('dialog', d => d.accept());
  await T.setViewportSize({ width: 820, height: 1180 });
  await T.goto(BASE + 'pult.html');
  await T.evaluate(() => localStorage.clear());
  await T.reload();
  await T.click('#signin');
  await T.waitForSelector('#pult:not(.hide)');
  const link = await T.textContent('#linkText');

  // старая копия урока (как у Виталия): создана вставкой блока, без отметки о версии
  await T.click('#newBtn');
  await T.fill('#importText', v1);
  await T.click('#importBtn');
  await T.waitForSelector('#row-t11');
  await T.waitForSelector('#updBtn');
  ok(true, 'на пульте появилась кнопка «Обновить урок до новой версии»');

  // брат уже сделал часть работы
  const S = await ctx.newPage();
  S.on('pageerror', e => errs.push('S: ' + e.message));
  await S.setViewportSize({ width: 1440, height: 900 });
  await S.goto(link);
  await S.click('.block');
  await S.waitForSelector('[data-task="t11"]');
  await S.click('[data-task="t2"] .opt[data-ci="0"][data-opt="he"]');
  await S.locator('[data-task="t5"] .wchip').filter({ hasText: /^me$/ }).click();
  await S.click('[data-task="t5"] [data-slot="g0"]');
  await S.locator('[data-task="t10"] .wchip').filter({ hasText: /^now$/ }).click();
  await S.click('[data-task="t10"] [data-slot="G1"]');
  const before = await S.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));
  const room = Object.keys(before.rooms)[0];
  const lid = Object.keys(before.rooms[room].lessons)[0];
  const oldWords = before.rooms[room].lessons[lid].tasks.t10.words;
  ok(!before.rooms[room].lessons[lid].tasks.t9.groups, 'до обновления правило про времена старое');

  await T.click('#updBtn');
  await S.waitForSelector('[data-task="t9"] .vs-col', { timeout: 5000 }).catch(() => {});
  ok((await S.$$('[data-task="t9"] .vs-col')).length === 2, 'у брата правило обновилось само, без перезагрузки');
  const after = await S.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));
  const L = after.rooms[room].lessons[lid];
  ok(L.title.includes('времена') && L.ver === 2 && L.src === 'pronouns-murzik.json', 'урок помечен новой версией');
  ok(JSON.stringify(L.tasks.t10.words) === JSON.stringify(oldWords), 'порядок слов в задании на группы сохранён');
  ok(!!(L.tasks.t11.alt && L.tasks.t11.items[0].why), 'появились новые объяснения');
  ok((await S.textContent('[data-task="t5"] [data-slot="g0"]')) === 'me', 'ответ в пропуске на месте');
  ok((await S.textContent('[data-task="t10"] [data-slot="G1"]')).includes('now'), 'ответ в группах на месте');
  ok(await S.$eval('[data-task="t2"] .opt[data-ci="0"][data-opt="he"]', e => e.classList.contains('on')), 'выбор на месте');
  ok(!!after.rooms[room].check[lid].t11, 'ключи самопроверки обновлены');
  await T.waitForTimeout(300);
  ok(!(await T.$('#updBtn')), 'кнопка обновления исчезла — урок уже свежий');

  errs.forEach(e => log.push('JSERR ' + e));
  console.log(log.join('\n'));
  console.log(log.filter(l => !l.startsWith('PASS')).length ? 'HAS FAILURES' : 'ALL UPDATE OK');
  await browser.close();
})().catch(e => { console.log(log.join('\n')); console.error(e); process.exit(1); });
