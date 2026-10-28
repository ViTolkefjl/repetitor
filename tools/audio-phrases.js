// Собирает английские фразы из уроков (то, у чего на сайте есть 🔊) и пишет скрипт озвучки для Mac.
// Запуск: node tools/audio-phrases.js  →  tools/make-audio.sh
// Правила разбиения и идентификатор файла совпадают с english.js (splitParts, audioId).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const isEn = s => /[A-Za-z]/.test(s || '') && !/[А-Яа-яЁё]/.test(s || '');
const splitParts = s => String(s).replace(/[«»"]/g, '').trim().split(/\s*(?:\/|→|—|–|·)\s*/).filter(Boolean);
function audioId(s) {                       // FNV-1a 32 бит
  let h = 0x811c9dc5;
  const t = String(s).trim().replace(/\s+/g, ' ');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const phrases = new Set();
const add = s => { if (isEn(s)) splitParts(s).forEach(p => phrases.add(p)); };
for (const f of fs.readdirSync(path.join(ROOT, 'lessons'))) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons', f), 'utf8'));
  for (const t of d.tasks || []) {
    (t.table || []).forEach(r => { add(r.en); add(r.ex); });
    (t.groups || []).forEach(g => { if (typeof g === 'object') { add(g.name); add(g.formula); (g.cards || []).forEach(r => { add(r.en); add(r.ex); }); } });
    (t.pairs || []).forEach(p => add(p.l));
  }
}

const list = [...phrases].sort();
const q = s => "'" + s.replace(/'/g, "'\\''") + "'";
const spoken = s => /^I[.!?]?$/.test(s) ? 'eye' : s;     // одиночная I — читаем как [ай]
const lines = list.map(p => 'gen ' + audioId(p) + ' ' + q(spoken(p)) + '   # ' + p.replace(/\n/g, ' '));

const sh = `#!/bin/bash
# Озвучка английских слов для сайта «Репетитор» живым голосом macOS (Ava/Zoe Premium).
# Создаёт на Рабочем столе архив repetitor-audio.zip — его нужно прислать Claude.
# Фраз: ${list.length}. Сгенерировано tools/audio-phrases.js — не правь вручную.
set -e
V=""
for name in "Ava (Premium)" "Zoe (Premium)" "Ava (Enhanced)" "Zoe (Enhanced)" "Samantha (Enhanced)"; do
  if say -v '?' | grep -q "^$name "; then V="$name"; break; fi
done
if [ -z "$V" ]; then
  V="$(say -v '?' | grep -E 'en_(US|GB)' | grep -Ei 'premium|enhanced|улучш|премиум' | head -1 | sed -E 's/[[:space:]]+en_(US|GB).*//')"
fi
if [ -z "$V" ]; then
  echo "Не нашёл голос Ava/Zoe (Premium). Скачай его: Настройки → Универсальный доступ → Чтение вслух → Системный голос → ⓘ → Английский (США)."
  exit 1
fi
echo "Голос: $V"
D="$HOME/Desktop/repetitor-audio"
rm -rf "$D"; mkdir -p "$D"
gen() {
  say -v "$V" -r 145 -o "$D/$1.m4a" --file-format=m4af --data-format=aac "$2"
  say -v "$V" -r 95  -o "$D/$1-s.m4a" --file-format=m4af --data-format=aac "$2"
  printf "."
}
${lines.join('\n')}
echo
cd "$HOME/Desktop" && rm -f repetitor-audio.zip && zip -qr repetitor-audio.zip repetitor-audio
echo "Готово: на Рабочем столе repetitor-audio.zip — пришли его Claude."
open -R "$HOME/Desktop/repetitor-audio.zip"
`;
fs.writeFileSync(path.join(__dirname, 'make-audio.sh'), sh, { mode: 0o755 });
console.log('Фраз:', list.length);
