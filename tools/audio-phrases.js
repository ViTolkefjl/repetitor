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
# Озвучка английских слов для сайта «Репетитор» живым голосом macOS (Jamie / Ava / Zoe — «высшее качество»).
# Создаёт на Рабочем столе архив repetitor-audio.zip — его нужно прислать Claude.
# Фраз: ${list.length}. Сгенерировано tools/audio-phrases.js — не правь вручную.
set -e
V=""
for name in "Jamie (Premium)" "Ava (Premium)" "Zoe (Premium)" "Jamie (Enhanced)" "Ava (Enhanced)" "Zoe (Enhanced)" "Samantha (Enhanced)"; do
  if say -v '?' | grep -q "^$name "; then V="$name"; break; fi
done
if [ -z "$V" ]; then
  V="$(say -v '?' | grep -E 'en_(US|GB)' | grep -Ei 'premium|enhanced|улучш|премиум|высш' | head -1 | sed -E 's/[[:space:]]+en_(US|GB).*//')"
fi
if [ -z "$V" ]; then
  echo "Не нашёл голос высшего качества. Английские голоса на этом Маке:"
  say -v '?' | grep -E 'en_(US|GB)' || true
  echo "Скачай: Настройки → Универсальный доступ → Чтение вслух → Системный голос → ⓘ → Английский → Джейми (высшее качество)."
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

/* ---------- ElevenLabs: tools/eleven.sh ----------
   bash eleven.sh          — образцы трёх голосов на Рабочий стол (repetitor-voices/)
   bash eleven.sh alice    — вся озвучка выбранным голосом → repetitor-audio.zip
   Ключ API вводится скрыто и никуда не сохраняется. Скорость — родная настройка ElevenLabs (без растягивания звука). */
const elText = s => /[.!?]$/.test(s) ? s : s + '.';        // точка в конце — ровная интонация у одиночных слов
const elLines = list.map(p => 'gen ' + audioId(p) + ' ' + q(elText(p)) + '   # ' + p.replace(/\n/g, ' '));
const el = `#!/bin/bash
# Озвучка английских фраз сайта «Репетитор» голосом ElevenLabs. Фраз: ${list.length}.
# Сгенерировано tools/audio-phrases.js — не правь вручную.
set -e
VOICE_alice=Xb7hH8MSUJpSbSDYk0k2      # Alice — британский, чёткий, для обучения
VOICE_lily=pFZP5JQG7iQjIQuC4Bku       # Lily — британский, тёплый, чёткий
VOICE_matilda=XrExE9yKIg1WjnnlVkGX    # Matilda — спокойный, профессиональный
MODEL=eleven_multilingual_v2
NORMAL=0.9
SLOW=0.75

read -rsp "Вставь API-ключ ElevenLabs и нажми Enter (символы не видны): " KEY; echo
[ -n "$KEY" ] || { echo "Ключ пустой."; exit 1; }

tts() {   # голос скорость текст файл
  local t; t=$(printf '%s' "$3" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')
  local body="{\\"text\\":\\"$t\\",\\"model_id\\":\\"$MODEL\\",\\"voice_settings\\":{\\"stability\\":0.6,\\"similarity_boost\\":0.8,\\"style\\":0,\\"use_speaker_boost\\":true,\\"speed\\":$2}}"
  local code; code=$(curl -sS -o "$4" -w "%{http_code}" -X POST "https://api.elevenlabs.io/v1/text-to-speech/$1?output_format=mp3_44100_128" \\
    -H "xi-api-key: $KEY" -H "Content-Type: application/json" -d "$body")
  if [ "$code" != "200" ]; then
    echo; echo "ElevenLabs ответил ошибкой $code:"; cat "$4"; echo
    echo "Проверь ключ (нужно право Text to Speech), остаток кредитов и включённый VPN."
    rm -f "$4"; exit 1
  fi
}

if [ -z "$1" ]; then
  D="$HOME/Desktop/repetitor-voices"; rm -rf "$D"; mkdir -p "$D"
  for v in alice lily matilda; do
    id=$(eval echo \\$VOICE_$v)
    printf "Образец: %s… " "$v"
    tts "$id" "$NORMAL" "I. You. Your. Yours. She is reading now." "$D/$v.mp3"
    tts "$id" "$SLOW" "Your. Yours. She is reading now." "$D/$v-slow.mp3"
    echo "готово"
  done
  echo "Послушай файлы в папке repetitor-voices на Рабочем столе и напиши Claude, какой голос взять."
  open "$D"; exit 0
fi

V=$(eval echo \\$VOICE_$1)
[ -n "$V" ] || { echo "Нет такого голоса: $1 (есть alice, lily, matilda)"; exit 1; }
D="$HOME/Desktop/repetitor-audio"; rm -rf "$D"; mkdir -p "$D"
echo "Голос: $1. Записываю ${list.length} фраз (обычно и медленно)…"
gen() { tts "$V" "$NORMAL" "$2" "$D/$1.mp3"; tts "$V" "$SLOW" "$2" "$D/$1-s.mp3"; printf "."; }
${elLines.join('\n')}
echo
cd "$HOME/Desktop" && rm -f repetitor-audio.zip && zip -qr repetitor-audio.zip repetitor-audio
echo "Готово: на Рабочем столе repetitor-audio.zip — пришли его Claude."
open -R "$HOME/Desktop/repetitor-audio.zip"
`;
fs.writeFileSync(path.join(__dirname, 'eleven.sh'), el, { mode: 0o755 });
console.log('eleven.sh: символов на одну скорость ≈', list.map(elText).join('').length);
