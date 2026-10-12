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

### `new IraqiBadWordsFilter(customWords?: string[])`

Creates a filter with the built-in word list plus any extra words you pass.

### `isProfane(text: string): boolean`

Returns `true` if any word in the text is on the list.

### `clean(text: string, placeholder = '*'): string`

Replaces each bad word with the placeholder, repeated to the word's length. Spaces and punctuation are kept.

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
| Punctuation next to the word | `عارة!` `عارة،` |
| Arabizi (Latin letters and numbers) | `ga7ba`, `3ayri` |

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

Please avoid adding words that have a common, normal meaning; they cause false positives for everyone.

### Development

```bash
npm install
npm test           # run tests
npm run typecheck  # type-check
npm run build      # build dist/
```

## License

[MIT](LICENSE)
