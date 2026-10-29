#!/bin/bash
# Озвучка английских фраз сайта «Репетитор» нейросетью Kokoro прямо на этом Маке. Фраз: 56.
# Сгенерировано tools/audio-phrases.js — не правь вручную.
set -e
if ! command -v node >/dev/null 2>&1; then
  echo "Нужен Node.js. Открываю nodejs.org — скачай версию LTS, установи и запусти команду ещё раз."
  open https://nodejs.org/
  exit 1
fi
W="$HOME/.repetitor-tts"
mkdir -p "$W"; cd "$W"
if [ ! -d node_modules/kokoro-js ]; then
  echo "Устанавливаю нейросеть (один раз, пара минут)…"
  [ -f package.json ] || npm init -y >/dev/null
  npm install kokoro-js@1.2.1 --no-audit --no-fund --loglevel=error
fi
cat > gen.mjs <<'KOKORO_JS'
import { KokoroTTS } from 'kokoro-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const VOICES = { heart: 'af_heart', bella: 'af_bella', emma: 'bf_emma' };
const NORMAL = 0.9, SLOW = 0.75;
const PHRASES = [{"id":"cc0c0364","text":"I."},{"id":"18c782d9","text":"I help him."},{"id":"eadb3e76","text":"I know her."},{"id":"202e515f","text":"I like them."},{"id":"8d18ea96","text":"I see you."},{"id":"a4feb5a5","text":"Listen!"},{"id":"e8bd4f78","text":"Look at us!"},{"id":"ce343eb5","text":"Look!"},{"id":"47689cbf","text":"Mum loves me."},{"id":"b7348ecf","text":"Present Continuous."},{"id":"635fbe86","text":"Present Simple."},{"id":"aa1ba727","text":"She is reading now."},{"id":"253d9769","text":"She reads every day."},{"id":"79ca5b3a","text":"Take it!"},{"id":"571b5f28","text":"The bag is yours."},{"id":"95c5a7b1","text":"The book is hers."},{"id":"0abca32f","text":"The car is theirs."},{"id":"ee528baf","text":"The cat is mine."},{"id":"7c97926c","text":"The dog is his."},{"id":"f2b20a4b","text":"The house is ours."},{"id":"6736afe4","text":"always."},{"id":"89f57381","text":"at the moment."},{"id":"152f19e6","text":"every day."},{"id":"5c3ae3b6","text":"he."},{"id":"f4b48d8c","text":"her."},{"id":"dfdb1129","text":"her book."},{"id":"373b886d","text":"hers."},{"id":"0bd2c6d5","text":"him."},{"id":"fdd2b0cb","text":"his."},{"id":"1fcc1e45","text":"his dog."},{"id":"47388410","text":"it."},{"id":"682e2aa7","text":"me."},{"id":"7e89edb6","text":"mine."},{"id":"4c2dfe93","text":"my."},{"id":"8c801e5b","text":"my cat."},{"id":"0ac95089","text":"never."},{"id":"28b19af7","text":"now."},{"id":"9a6320f7","text":"often."},{"id":"a91a3339","text":"our."},{"id":"2e6252c5","text":"our house."},{"id":"7e3ebd7e","text":"ours."},{"id":"e92df9e1","text":"she."},{"id":"5d689621","text":"sometimes."},{"id":"cbfd3c67","text":"their."},{"id":"239ddae1","text":"their car."},{"id":"33a5937c","text":"theirs."},{"id":"e422e7e3","text":"them."},{"id":"d822d4ff","text":"they."},{"id":"420372be","text":"today."},{"id":"46430fd9","text":"us."},{"id":"0391d612","text":"usually."},{"id":"5c47afa9","text":"we."},{"id":"50b8d09c","text":"you."},{"id":"00f0e6aa","text":"your."},{"id":"762ed318","text":"your bag."},{"id":"543b679b","text":"yours."}];
const mode = process.argv[2] || '';
const desk = os.homedir() + '/Desktop';
console.log('Загружаю модель (первый раз скачивается ~90 МБ)…');
let tts;
try {
  tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
} catch (e) {
  console.error('Не удалось скачать модель с huggingface.co: ' + e.message + '\nВключи VPN и запусти ещё раз.');
  process.exit(1);
}
async function save(text, voice, speed, file) {
  const audio = await tts.generate(text, { voice, speed });
  const wav = file.replace(/\.m4a$/, '.wav');
  audio.save(wav);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', wav, file]);
  fs.unlinkSync(wav);
}
if (!mode) {
  const dir = desk + '/repetitor-voices';
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [name, v] of Object.entries(VOICES)) {
    process.stdout.write('Образец: ' + name + '… ');
    await save('I. You. Your. Yours. She is reading now.', v, NORMAL, dir + '/' + name + '.m4a');
    await save('Your. Yours. She is reading now.', v, SLOW, dir + '/' + name + '-slow.m4a');
    console.log('готово');
  }
  console.log('Послушай файлы в папке repetitor-voices на Рабочем столе и напиши Claude, какой голос взять.');
  execFileSync('open', [dir]);
} else {
  const v = VOICES[mode];
  if (!v) { console.error('Нет такого голоса: ' + mode + ' (есть heart, bella, emma)'); process.exit(1); }
  const dir = desk + '/repetitor-audio';
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  console.log('Голос: ' + mode + '. Записываю ' + PHRASES.length + ' фраз (обычно и медленно)…');
  for (const p of PHRASES) {
    await save(p.text, v, NORMAL, dir + '/' + p.id + '.m4a');
    await save(p.text, v, SLOW, dir + '/' + p.id + '-s.m4a');
    process.stdout.write('.');
  }
  console.log();
  fs.rmSync(desk + '/repetitor-audio.zip', { force: true });
  execFileSync('zip', ['-qr', 'repetitor-audio.zip', 'repetitor-audio'], { cwd: desk });
  console.log('Готово: на Рабочем столе repetitor-audio.zip — пришли его Claude.');
  execFileSync('open', ['-R', desk + '/repetitor-audio.zip']);
}
KOKORO_JS
node gen.mjs "$@"
