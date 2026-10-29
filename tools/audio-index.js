// Пересобирает audio/index.json по файлам в audio/: { ext, ids } — id, у которых есть и обычная, и медленная запись.
// Запуск после того, как файлы из repetitor-audio.zip положены в audio/: node tools/audio-index.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'audio');
const files = new Set(fs.readdirSync(dir));
const ext = [...files].some(f => /^[0-9a-f]{8}\.mp3$/.test(f)) ? 'mp3' : 'm4a';
const re = new RegExp('^[0-9a-f]{8}\\.' + ext + '$');
const ids = [...files].filter(f => re.test(f)).map(f => f.slice(0, 8)).filter(id => files.has(id + '-s.' + ext)).sort();
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ ext, ids }) + '\n');
console.log('Записей:', ids.length, '(' + ext + ')');
