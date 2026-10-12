# iraqi-dialect-bad-words

[![npm version](https://img.shields.io/npm/v/iraqi-dialect-bad-words.svg)](https://www.npmjs.com/package/iraqi-dialect-bad-words)
[![CI](https://github.com/karam-fikre/iraqi-dialect-bad-words/actions/workflows/ci.yml/badge.svg)](https://github.com/karam-fikre/iraqi-dialect-bad-words/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/iraqi-dialect-bad-words.svg)](LICENSE)

A profanity filter for the Iraqi Arabic dialect. Detects and masks bad words in user-generated text.

Works in **React Native / Expo**, **React** (Vite, Next.js, CRA, …) and **Node.js**, with TypeScript types included. No dependencies.

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

## API

### `new IraqiBadWordsFilter(options?)`

Creates a filter with the built-in word list.

```ts
new IraqiBadWordsFilter();                               // profanity only
new IraqiBadWordsFilter({ includeInsults: true });       // also milder insults
new IraqiBadWordsFilter({ stripSuffixes: true });        // also unlisted suffix forms
new IraqiBadWordsFilter({ customWords: ['word1', 'word2'] });
new IraqiBadWordsFilter(['word1', 'word2']);             // same as customWords
```

| Option | Default | Description |
|---|---|---|
| `customWords` | `[]` | Extra words to filter. |
| `includeInsults` | `false` | Also filter milder insults like كلب, حمار, قندرة, نعال. Off by default because many of them are everyday words, so turning it on flags sentences like `عندي كلب` ("I have a dog"). |
| `stripSuffixes` | `false` | Also match words with a pronoun suffix (ي ك ج ه ها نا كم هم) that the list doesn't spell out, e.g. `طيزهم` → `طيز`. Off by default because it widens matching: a clean word that ends like a bad word plus a suffix gets flagged too. |

### `isProfane(text: string): boolean`

Returns `true` if any word in the text is on the list.

### `clean(text: string, placeholder = '*'): string`

Replaces each bad word with the placeholder, repeated to the word's length. Spaces and punctuation are kept.

### `inspect(text: string, options?): ProfanityMatch[]`

Lists each bad word in the text and explains why it matched. Use it to highlight words, to treat lists differently (e.g. block `words` but only warn on `insults`), or to let someone review a match before your app blocks it.

```ts
filter.inspect('روح للكواد!');
// [{ token: 'للكواد', start: 4, end: 10, normalized: 'لكواد',
//    entry: 'كواد', source: 'words', prefix: 'ل' }]
```

| Field | Description |
|---|---|
| `token` | The word exactly as written. |
| `start`, `end` | Offsets in the **original** text, so `text.slice(start, end) === token`. Counted in JavaScript string units (UTF-16); convert them if another platform counts characters differently. |
| `normalized` | The word after normalization (Arabizi is folded too, so `Qa7ba` shows as `gahba`). |
| `entry` | The list entry it matched, spelled as in the list. |
| `source` | `'words'`, `'insults'` or `'custom'`. A word on more than one list keeps the first: built-in, then insults, then custom. |
| `prefix` | The attached prefix stripped before matching (after normalization, so `لل` shows as `ل`), or `''` for a direct match. |
| `suffix` | The suffix stripped before matching (only with `stripSuffixes`), or `''`. |
| `suppressedBy` | Only with `includeSuppressed`: the safe stem that cleared this match. |

Pass `{ includeSuppressed: true }` to also see words that matched but were cleared by a safe stem. They are not profane (`isProfane` and `clean` ignore them), but they show why a word *wasn't* flagged:

```ts
filter.inspect('وبعيرك', { includeSuppressed: true });
// [{ token: 'وبعيرك', …, entry: 'عيرك', prefix: 'وب', suppressedBy: 'بعير' }]
```

Including the output of `inspect` in a [“Clean word flagged” issue](https://github.com/karam-fikre/iraqi-dialect-bad-words/issues/new?template=false-positive.yml) shows exactly which entry and prefix rule fired.

### `addWords(words: string[]): void`

Adds words to this filter.

### `removeWords(words: string[]): void`

Removes words from this filter, for example a built-in word you don't want flagged in your app.

## What it catches

Matching is done per whole word, after normalizing both the text and the word list, so these all match the same entry:

| Variation | Example |
|---|---|
| Diacritics (tashkeel) | `عَارَة` |
| Stretched letters | `عاااارة` |
| Tatweel | `عـــارة` |
| ة / ه, ى / ي, أ / إ / آ / ا | `عاره` |
| Attached prefixes و ف ب ل ك ال | `والعارة`, `للعارة` |
| Pronoun suffixes (with `stripSuffixes`) | `طيزهم`, `وطيزكم` |
| Punctuation next to the word | `عارة!` `عارة،` |
| Arabizi (Latin letters and numbers), including spelling variants | `ga7ba` = `qahba` = `gahba`, `kosomak` = `kusumak`, `3ayri` = `ayri` |

Because matching is whole-word, a clean word that merely contains a bad word is not flagged.

## Known limitations

- Phrases (multiple words) can't be list entries; each entry is a single word.
- Words glued together without a space (e.g. the same word typed twice) aren't detected.
- No word list is complete. Use this as one layer of moderation, not the only one.

## Contributing

The word list is the heart of this package, and native speakers are the best judges of it.

- **A word is missing:** open a [“Suggest a word” issue](https://github.com/karam-fikre/iraqi-dialect-bad-words/issues/new?template=add-word.yml), or add it to [`src/words.json`](src/words.json) in a pull request.
- **A clean word is flagged:** open a [“Clean word flagged” issue](https://github.com/karam-fikre/iraqi-dialect-bad-words/issues/new?template=false-positive.yml).
  If it's flagged only because of a prefix (e.g. `بعير` "camel" = `ب` + a bad word), the fix is adding it to [`src/safe-stems.json`](src/safe-stems.json).

- **A sentence is judged wrong:** add it to [`test/fixtures/sentences.json`](test/fixtures/sentences.json) with the verdict a native speaker expects (`"profane": true` or `false`, plus `"options"` if it needs `includeInsults` or `stripSuffixes`). Every sentence there runs as a test, so later word-list changes can't silently flip it.

Words that also have a common, normal meaning (like كلب "dog") belong in [`src/insults.json`](src/insults.json), which is opt-in, not in `words.json`.

### Development

```bash
npm install
npm test           # run tests
npm run typecheck  # type-check
npm run build      # build dist/
```

## License

[MIT](LICENSE)
