import { IraqiBadWordsFilter, IraqiBadWordsFilterOptions } from '../src/index';
import assert from 'assert';
import words from '../src/words.json';
import insults from '../src/insults.json';
import phrases from '../src/phrases.json';
import safeStems from '../src/safe-stems.json';

// Checks the word lists themselves, so a list change that adds a duplicate,
// an entry the filter already catches, or a safe stem that guards nothing
// fails here instead of slipping into a release.

const OPTIONS: IraqiBadWordsFilterOptions = { includeInsults: true };
const SUFFIXES = ['', 'ي', 'ك', 'ج', 'ه', 'ها', 'نا', 'كم', 'هم'];

// Safe stems that guard a word apps commonly add themselves, not a built-in one
const GUARDED_CUSTOM_WORDS: Record<string, string[]> = {
  بالعجل: ['عجل'],
};

describe('Word lists', () => {
  const lists = { 'words.json': words, 'insults.json': insults, 'phrases.json': phrases, 'safe-stems.json': safeStems };

  for (const [name, list] of Object.entries(lists)) {
    it(`${name} has only trimmed, non-empty strings`, () => {
      for (const entry of list as unknown[]) {
        assert.ok(typeof entry === 'string' && entry.trim() === entry && entry !== '', `${name}: ${JSON.stringify(entry)}`);
      }
    });
  }

  it('has no entry that normalizes to the same word as an earlier one, in either list', () => {
    const filter = new IraqiBadWordsFilter(OPTIONS);
    const duplicates = [...words, ...insults]
      .map((entry) => ({ entry, matched: filter.inspect(entry)[0]?.entry }))
      .filter(({ entry, matched }) => matched !== entry)
      .map(({ entry, matched }) => `${entry} (same as ${matched})`);
    assert.deepStrictEqual(duplicates, []);
  });

  it('has no entry the filter already catches without it (a prefix form, a spelling variant)', () => {
    const redundant = [...words, ...insults].filter((entry) => {
      const filter = new IraqiBadWordsFilter(OPTIONS);
      filter.removeWords([entry]);
      return filter.isProfane(entry);
    }).map((entry) => {
      const filter = new IraqiBadWordsFilter(OPTIONS);
      filter.removeWords([entry]);
      const [match] = filter.inspect(entry);
      return `${entry} (${match.entry}, ${match.rules.join(', ')})`;
    });
    assert.deepStrictEqual(redundant, []);
  });

  it('has no safe stem that clears nothing', () => {
    const unused = safeStems.filter((stem) => {
      const filter = new IraqiBadWordsFilter({
        ...OPTIONS, stripSuffixes: true, customWords: GUARDED_CUSTOM_WORDS[stem] ?? [],
      });
      return !SUFFIXES.some((suffix) => filter.inspect(stem + suffix, { includeSuppressed: true })
        .some((match) => match.suppressedBy === stem));
    });
    assert.deepStrictEqual(unused, []);
  });

  it('has no safe stem that is flagged itself', () => {
    const filter = new IraqiBadWordsFilter({ ...OPTIONS, stripSuffixes: true });
    assert.deepStrictEqual(safeStems.filter((stem) => filter.isProfane(stem)), []);
  });

  it('has phrases of at least two words', () => {
    assert.deepStrictEqual(phrases.filter((phrase) => phrase.split(/\s+/).length < 2), []);
  });
});
