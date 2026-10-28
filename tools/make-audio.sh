#!/bin/bash
# Озвучка английских слов для сайта «Репетитор» живым голосом macOS (Jamie / Ava / Zoe — «высшее качество»).
# Создаёт на Рабочем столе архив repetitor-audio.zip — его нужно прислать Claude.
# Фраз: 56. Сгенерировано tools/audio-phrases.js — не правь вручную.
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
gen cc0c0364 'eye'   # I
gen 18c782d9 'I help him.'   # I help him.
gen eadb3e76 'I know her.'   # I know her.
gen 202e515f 'I like them.'   # I like them.
gen 8d18ea96 'I see you.'   # I see you.
gen a4feb5a5 'Listen!'   # Listen!
gen e8bd4f78 'Look at us!'   # Look at us!
gen ce343eb5 'Look!'   # Look!
gen 47689cbf 'Mum loves me.'   # Mum loves me.
gen b7348ecf 'Present Continuous'   # Present Continuous
gen 635fbe86 'Present Simple'   # Present Simple
gen aa1ba727 'She is reading now.'   # She is reading now.
gen 253d9769 'She reads every day.'   # She reads every day.
gen 79ca5b3a 'Take it!'   # Take it!
gen 571b5f28 'The bag is yours.'   # The bag is yours.
gen 95c5a7b1 'The book is hers.'   # The book is hers.
gen 0abca32f 'The car is theirs.'   # The car is theirs.
gen ee528baf 'The cat is mine.'   # The cat is mine.
gen 7c97926c 'The dog is his.'   # The dog is his.
gen f2b20a4b 'The house is ours.'   # The house is ours.
gen 6736afe4 'always'   # always
gen 89f57381 'at the moment'   # at the moment
gen 152f19e6 'every day'   # every day
gen 5c3ae3b6 'he'   # he
gen f4b48d8c 'her'   # her
gen dfdb1129 'her book'   # her book
gen 373b886d 'hers'   # hers
gen 0bd2c6d5 'him'   # him
gen fdd2b0cb 'his'   # his
gen 1fcc1e45 'his dog'   # his dog
gen 47388410 'it'   # it
gen 682e2aa7 'me'   # me
gen 7e89edb6 'mine'   # mine
gen 4c2dfe93 'my'   # my
gen 8c801e5b 'my cat'   # my cat
gen 0ac95089 'never'   # never
gen 28b19af7 'now'   # now
gen 9a6320f7 'often'   # often
gen a91a3339 'our'   # our
gen 2e6252c5 'our house'   # our house
gen 7e3ebd7e 'ours'   # ours
gen e92df9e1 'she'   # she
gen 5d689621 'sometimes'   # sometimes
gen cbfd3c67 'their'   # their
gen 239ddae1 'their car'   # their car
gen 33a5937c 'theirs'   # theirs
gen e422e7e3 'them'   # them
gen d822d4ff 'they'   # they
gen 420372be 'today'   # today
gen 46430fd9 'us'   # us
gen 0391d612 'usually'   # usually
gen 5c47afa9 'we'   # we
gen 50b8d09c 'you'   # you
gen 00f0e6aa 'your'   # your
gen 762ed318 'your bag'   # your bag
gen 543b679b 'yours'   # yours
echo
cd "$HOME/Desktop" && rm -f repetitor-audio.zip && zip -qr repetitor-audio.zip repetitor-audio
echo "Готово: на Рабочем столе repetitor-audio.zip — пришли его Claude."
open -R "$HOME/Desktop/repetitor-audio.zip"
