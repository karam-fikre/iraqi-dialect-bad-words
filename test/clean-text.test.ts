import { IraqiBadWordsFilter, IraqiBadWordsFilterOptions } from '../src/index';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

// Everyday Iraqi, Mosul and news text, plus clean words close to list entries.
// None of it may be flagged, so a list or matching change that brings back a
// false positive fails here. Insults are left out: they're meant to match
// everyday words.
const lines = readFileSync(join(__dirname, 'fixtures/clean-text.txt'), 'utf8')
  .split('\n')
  .filter((line) => !line.startsWith('#'));

const optionSets: IraqiBadWordsFilterOptions[] = [
  {},
  { stripSuffixes: true, includePhrases: true, dialects: ['mosul'] },
];

describe('Clean text', () => {
  for (const options of optionSets) {
    it(`flags nothing in clean-text.txt with ${JSON.stringify(options)}`, () => {
      const filter = new IraqiBadWordsFilter(options);
      const flagged = lines.flatMap((line) => filter.inspect(line)
        .map((match) => `${match.token} → ${match.entry} [${match.rules.join(', ')}] in: ${line}`));
      assert.deepStrictEqual(flagged, []);
    });
  }
});
