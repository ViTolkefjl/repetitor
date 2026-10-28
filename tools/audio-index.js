// Пересобирает audio/index.json по файлам в audio/ (берём id, у которых есть и обычная, и медленная запись).
// Запуск после того, как файлы из repetitor-audio.zip положены в audio/: node tools/audio-index.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'audio');
const files = new Set(fs.readdirSync(dir));
const ids = [...files].filter(f => /^[0-9a-f]{8}\.m4a$/.test(f)).map(f => f.slice(0, 8)).filter(id => files.has(id + '-s.m4a')).sort();
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(ids) + '\n');
console.log('Записей:', ids.length);
