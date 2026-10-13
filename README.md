# iraqi-dialect-bad-words

[![npm version](https://img.shields.io/npm/v/iraqi-dialect-bad-words.svg)](https://www.npmjs.com/package/iraqi-dialect-bad-words)
[![CI](https://github.com/karam-fikre/iraqi-dialect-bad-words/actions/workflows/ci.yml/badge.svg)](https://github.com/karam-fikre/iraqi-dialect-bad-words/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/iraqi-dialect-bad-words.svg)](LICENSE)

A profanity filter for the Iraqi Arabic dialect. Detects and masks bad words in user-generated text.

Works in **React Native / Expo**, **React** (Vite, Next.js, CRA, …), **Vue** (Vite, Nuxt) and **Node.js**, with TypeScript types included. No dependencies.

## Install

```bash
npm install iraqi-dialect-bad-words
# or
yarn add iraqi-dialect-bad-words
# or
npx expo install iraqi-dialect-bad-words
```

## Usage

```ts
import IraqiBadWordsFilter from 'iraqi-dialect-bad-words';
// CommonJS: const { IraqiBadWordsFilter } = require('iraqi-dialect-bad-words');

const filter = new IraqiBadWordsFilter();

filter.isProfane('مرحبا بك');      // false
filter.isProfane('هذا كلام عارة');  // true

filter.clean('هذا كلام عارة');       // 'هذا كلام ****'
filter.clean('هذا كلام عارة', '#');  // 'هذا كلام ####'
filter.clean('هذا كلام عارة', '');       // 'هذا كلام '
```

### React Native example

```tsx
import { useState } from 'react';
import { TextInput, Text } from 'react-native';
import IraqiBadWordsFilter from 'iraqi-dialect-bad-words';

const filter = new IraqiBadWordsFilter(); // create once, outside the component

export function CommentInput() {
  const [text, setText] = useState('');

  return (
    <>
      <TextInput value={text} onChangeText={setText} />
      {filter.isProfane(text) && <Text>Please keep it respectful.</Text>}
    </>
  );
}
```

### Vue example

Create the filter once in its own module and import it where you need it. Keep it out of `ref()` and `reactive()`: the filter never changes, and wrapping it in reactive proxies only slows every check down.

```ts
// src/profanity.ts
import IraqiBadWordsFilter from 'iraqi-dialect-bad-words';

export const filter = new IraqiBadWordsFilter();
```

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { filter } from '@/profanity';

const text = ref('');
const isProfane = computed(() => filter.isProfane(text.value));
</script>

<template>
  <textarea v-model="text" dir="auto" />
  <p v-if="isProfane">Please keep it respectful.</p>
  <button :disabled="isProfane">Send</button>
</template>
```

To highlight bad words, render the text in pieces split at the `start` and `end` of each match from [`inspect()`](#inspecttext-string-options-profanitymatch) rather than with `v-html`, so user text can't inject HTML.

In any framework, check the text on your server too (a Nuxt server route or any Node backend can use the same package): a check in the browser can be skipped by calling your API directly.

## API

### `new IraqiBadWordsFilter(options?)`

Creates a filter with the built-in word list.

```ts
new IraqiBadWordsFilter();                               // profanity only
new IraqiBadWordsFilter({ includeInsults: true });       // also milder insults
new IraqiBadWordsFilter({ includePhrases: true });       // also vulgar phrases
new IraqiBadWordsFilter({ stripSuffixes: true });        // also unlisted suffix forms
new IraqiBadWordsFilter({ dialects: ['mosul'] });        // also Mosul ر → غ forms
new IraqiBadWordsFilter({ customWords: ['word1', 'word2'] });
new IraqiBadWordsFilter({ safeWords: ['word3'] });        // clean words not to flag
new IraqiBadWordsFilter(['word1', 'word2']);             // same as customWords
```

| Option | Default | Description |
|---|---|---|
| `customWords` | `[]` | Extra words to filter, on top of the built-in list. Can come from your own JSON file (see below). |
| `safeWords` | `[]` | Extra safe stems, on top of the built-in [`safe-stems.json`](src/safe-stems.json): clean words that would otherwise match once a prefix or suffix is stripped, like the built-in `بعير` ("camel" = `ب` + `عير`). Use it for clean words your app sees flagged, especially ones your own `customWords` cause. Their prefixed and suffixed forms are safe too (`وبعيرك`). Can come from your own JSON file (see below). |
| `includeInsults` | `false` | Also filter milder insults like كلب, حمار, قندرة, نعال. Off by default because many of them are everyday words, so turning it on flags sentences like `عندي كلب` ("I have a dog"). |
| `includePhrases` | `false` | Also filter the phrases in [`phrases.json`](src/phrases.json): clean words that are vulgar together, like `تعال العب بيه`. Off by default because the same words can be meant literally ("come play with it"). |
| `customPhrases` | `[]` | Extra phrases to filter, whether or not `includePhrases` is on. Can come from your own JSON file. |
| `stripSuffixes` | `false` | Also match words with a pronoun suffix (ي ك ج ه ها نا كم هم) that the list doesn't spell out, e.g. `طيزهم` → `طيز`. Off by default because it widens matching: a clean word that ends like a bad word plus a suffix gets flagged too. |
| `dialects` | `[]` | Regional pronunciations to also match. `'mosul'`: ر said as غ, so every entry with ر also matches its غ form (`شرموطة` → `شغموطة`); the ر forms keep matching. Safe stems get their غ form too. |

#### Using your own word files

Keep your app's extra words, and clean words you don't want flagged, in JSON files: arrays of single words, the same format as [`src/words.json`](src/words.json) and [`src/safe-stems.json`](src/safe-stems.json).

```json
["زفت", "نذل"]
```

Import them and pass them as `customWords` and `safeWords`. The built-in lists stay on, and your words are added to them:

```ts
import IraqiBadWordsFilter from 'iraqi-dialect-bad-words';
import myWords from './my-words.json'; // TypeScript needs "resolveJsonModule": true
import mySafeWords from './my-safe-words.json';
// CommonJS: const myWords = require('./my-words.json');

const filter = new IraqiBadWordsFilter({ customWords: myWords, safeWords: mySafeWords });
```

Your words go through the same normalization as the built-in lists, so you don't need to list diacritic, ة/ه, stretched or prefixed spellings. Whitespace around a word is trimmed and blank entries are skipped. `inspect()` reports a match from your word file with `source: 'custom'`, and a match cleared by your safe words with `suppressedBy` set to that safe word.

A safe word only clears a match that needed a prefix or suffix stripped, like the built-in safe stems. To stop a listed word itself from being flagged, use `removeWords()`.

React Native, Expo, Vite and Next.js bundle the JSON files into your app, so this works the same in each. The filter doesn't read files at runtime. If your lists come from a server, fetch them and pass the arrays to `addWords()` and `addSafeWords()`.

### `isProfane(text: string): boolean`

Returns `true` if any word in the text is on the list.

### `clean(text: string, placeholder = '*'): string`

Replaces each bad word with the placeholder, repeated to the word's length. Spaces and punctuation are kept.

### `inspect(text: string, options?): ProfanityMatch[]`

Lists each bad word in the text and explains why it matched. Use it to highlight words, to treat lists differently (e.g. block `words` but only warn on `insults`), or to let someone review a match before your app blocks it.

```ts
filter.inspect('روح للكواد!');
// [{ token: 'للكواد', start: 4, end: 10, normalized: 'لكواد', entry: 'كواد',
//    source: 'words', prefix: 'ل', suffix: '', rules: ['stretched', 'prefix'] }]
```

| Field | Description |
|---|---|
| `token` | The word exactly as written. |
| `start`, `end` | Offsets in the **original** text, so `text.slice(start, end) === token`. Counted in JavaScript string units (UTF-16); convert them if another platform counts characters differently. |
| `normalized` | The word after normalization (Arabizi is folded too, so `Qa7ba` shows as `gahba`). For a word with گ, the reading that matched (ق or ك). |
| `entry` | The list entry it matched, spelled as in the list. For a Mosul form, the listed ر spelling. |
| `source` | `'words'`, `'insults'`, `'phrases'` or `'custom'`. A word on more than one list keeps the first: built-in, then insults, then custom. |
| `prefix` | The attached prefix stripped before matching (after normalization, so `لل` shows as `ل`), or `''` for a direct match. |
| `suffix` | The suffix stripped before matching (only with `stripSuffixes`), or `''`. |
| `rules` | The rules the word needed to match the entry (see below). Empty when it's spelled exactly like the entry. |
| `suppressedBy` | Only with `includeSuppressed`: the safe stem that cleared this match. |

Pass `{ includeSuppressed: true }` to also see words that matched but were cleared by a safe stem. They are not profane (`isProfane` and `clean` ignore them), but they show why a word *wasn't* flagged:

```ts
filter.inspect('وبعيرك', { includeSuppressed: true });
// [{ token: 'وبعيرك', …, entry: 'عيرك', prefix: 'وب', rules: ['prefix'], suppressedBy: 'بعير' }]
```

`rules` lists only the rules that made a difference between the typed word and the entry, so a report shows straight away why something matched:

| Rule | Example |
|---|---|
| `unicode-forms` | `ﻋﻴﺮ`, `ｇａｈｂａ`, `𝐠𝐚𝐡𝐛𝐚` (presentation forms, full-width and mathematical letters) |
| `diacritics` | `عَارَة`, `عـــارة` |
| `invisible` | `عا‌رة` (zero-width character inside) |
| `spelling` | `عاره` (ة/ه, ى/ي, أ/ا) |
| `keyboard` | `عیر`, `کس` (Persian/Kurdish letters) |
| `lookalike` | `gаhba` (Cyrillic `а` in a Latin word) |
| `arabic-digits` | `ga٧ba` |
| `stretched` | `عاااارة`, `للكواد` |
| `glued-digits` | `عارة3` |
| `arabizi` | `qa7ba` → `gahba` |
| `gaf-as-qaf` / `gaf-as-kaf` | `گحبة` → قحبة, `گسها` → كسها |
| `prefix` / `suffix` | `بطيزك`, `ياعارة`, `طيزهم` (with `stripSuffixes`) |
| `mosul` | `شغموطة` → شرموطة (with `dialects: ['mosul']`) |
| `phrase` | `تعال العب بيه` (with `includePhrases`) |
| `split` | `ع*ي*ر`, `ع ي ر` (pieces joined again) |
| `symbols` | `g@hba`, `$harmoota` (@ as a, $ as s) |

Including the output of `inspect` in a [“Clean word flagged” issue](https://github.com/karam-fikre/iraqi-dialect-bad-words/issues/new?template=false-positive.yml) shows exactly which entry matched and which rules it needed; the issue form has a field for it.

### `addWords(words: string[]): void`

Adds words to this filter.

### `addSafeWords(words: string[]): void`

Adds safe stems to this filter, like the `safeWords` option.

### `removeWords(words: string[]): void`

Removes words from this filter, for example a built-in word you don't want flagged in your app.

### `addPhrases(phrases: string[]): void` / `removePhrases(phrases: string[]): void`

Adds phrases to this filter, like the `customPhrases` option, or removes them, including built-in ones.

A phrase is its words separated by spaces. A word can list alternatives separated by `|`, so one entry covers every combination:

```json
[
  "قوم|كوم بيه|بينو"
]
```

matches `قوم بيه`, `قوم بينو`, `كوم بيه` and `كوم بينو`. A phrase matches when its words appear one after another with only spaces or punctuation between them (`تعال، العب بيه!`). Each word is normalized like any other, so `گوم` matches the `قوم` alternative without listing it. The first word can carry an attached prefix (`وتعال العب بيه`) or the Iraqi progressive `د` (`دقوم بيه`). Other forms aren't stripped or guessed, so list each one you want as an alternative.

The whole phrase is reported as one match with the rule `phrase`, its `entry` being the line as listed, and `clean()` masks all of it. `removePhrases()` takes a line as listed; the order of its alternatives doesn't matter.

## What it catches

Matching is done per whole word, after normalizing both the text and the word list, so these all match the same entry:

| Variation | Example |
|---|---|
| Diacritics (tashkeel) | `عَارَة` |
| Stretched letters | `عاااارة` |
| Tatweel | `عـــارة` |
| ة / ه, ى / ي, أ / إ / آ / ا | `عاره` |
| Persian/Kurdish keyboard letters ی ک ە | `عیر`, `کس` |
| گ read as ق (Iraqi) and as ك (Kurdish typists) | `گحبة` = `قحبة`, `گس` = `كس` |
| Invisible characters hidden inside a word (zero-width, direction marks, soft hyphen) | `عا‌رة` |
| Letters split by symbols, or by spaces between single letters | `ع*ي*ر`, `ع.ي.ر`, `ع ي ر`, `عي * ر`, `شرم.وطة`, `g-a-h-b-a` |
| Arabic presentation forms, full-width and mathematical letters | `ﻋﻴﺮ`, `ｇａｈｂａ`, `𝐠𝐚𝐡𝐛𝐚` |
| Greek or Cyrillic look-alike letters in a Latin word | `gаhba` (Cyrillic `а`) |
| Attached prefixes و ف ب ل ك ال, and يا / ويا | `والعارة`, `للعارة`, `ياعارة`, `يالعارة`, `وياعارة` |
| Pronoun suffixes (with `stripSuffixes`) | `طيزهم`, `وطيزكم` |
| Punctuation next to the word | `عارة!` `عارة،` |
| Digits glued to or inside an Arabic word | `عارة3`, `عا٣رة` |
| Arabizi (Latin letters and numbers, Western or Arabic-Indic), including spelling variants | `ga7ba` = `ga٧ba` = `qahba` = `gahba`, `kosomak` = `kusumak`, `3ayri` = `ayri`, `6eezak` = `teezak` (6 = ط), `9awad` = `8awad` = `gawad` (9, 8 = ق) |
| @ and $ standing in for letters in Arabizi | `g@hba`, `$harmoota` |

Because matching is whole-word, a clean word that merely contains a bad word is not flagged.

Split words are found by joining neighbouring pieces when the gap between them is short, on one line, and either has no spaces (`عي*ر`), sits between single letters (`ع ي ر`), or has a symbol between pieces of one or two letters (`عي * ر`). Normal sentences like `انا و انت` or `د. علي` stay apart, and the joined word must match an entry exactly. A split safe stem stays safe: `ب ع ي ر` is بعير (camel).

## Known limitations

- Phrases match only as listed, word for word: another word in between (`تعال هنا العب بيه`) or an unlisted form (`بيهم`) isn't matched.
- Words glued together without a space (e.g. the same word typed twice) aren't detected.
- A letter replaced by a symbol (`ع*ر`, `ك*بة`) isn't detected: the symbol could stand for any letter, and `ع*ر` could just as well be عمر.
- Longer pieces split with spaces around the symbol (`شرم * وطة`) aren't joined, so normal sentences aren't either.
- No word list is complete. Use this as one layer of moderation, not the only one.

## Contributing

The word list is the heart of this package, and native speakers are the best judges of it.

- **A word is missing:** open a [“Suggest a word” issue](https://github.com/karam-fikre/iraqi-dialect-bad-words/issues/new?template=add-word.yml), or add it to [`src/words.json`](src/words.json) in a pull request.
- **A clean word is flagged:** open a [“Clean word flagged” issue](https://github.com/karam-fikre/iraqi-dialect-bad-words/issues/new?template=false-positive.yml).
  If it's flagged only because of a prefix (e.g. `بعير` "camel" = `ب` + a bad word), the fix is adding it to [`src/safe-stems.json`](src/safe-stems.json).
  A safe stem written with گ protects only words spelled with گ, so `گلب` ("heart", Iraqi spelling of قلب) can be safe while `كلب` is not.

- **A sentence is judged wrong:** add it to [`test/fixtures/sentences.json`](test/fixtures/sentences.json) with the verdict a native speaker expects (`"profane": true` or `false`, plus `"options"` if it needs `includeInsults`, `includePhrases` or `stripSuffixes`). Every sentence there runs as a test, so later word-list changes can't silently flip it.

Words that also have a common, normal meaning (like كلب "dog") belong in [`src/insults.json`](src/insults.json), which is opt-in, not in `words.json`. Phrases of clean words that are vulgar together belong in [`src/phrases.json`](src/phrases.json), also opt-in.

### Development

```bash
npm install
npm test           # run tests
npm run typecheck  # type-check
npm run build      # build dist/
npm run check -- article.txt --phrases   # list every match in a text file
```

`npm run check` runs the filter over a text file (or stdin, e.g. `pbpaste | npm run check`) and prints each match with its line and column, the entry it matched, its source and rules, and the text around it. Flags turn on options: `--insults`, `--phrases`, `--suffixes`, `--mosul`, and `--clean` to also print the masked text. Running it on articles you know are clean is the quickest way to find false positives: each match is either a missing safe stem or a word that belongs in an opt-in list.

## License

[MIT](LICENSE)
